import { IMentionService } from "../interfaces/IMentionService";
import { IMentionRepository } from "../../repositories/interface/IMentionRepository";
import logger from "../../utils/logger.util";
import * as grpc from "@grpc/grpc-js";
import { IOutboxService } from "../interfaces/IOutboxService";
import { KAFKA_TOPICS } from "../../config/kafka.config";
import {
  OutboxAggregateType,
  OutboxEventType,
} from "@prisma/client";
import { userClient } from "../../config/grpc.client";
import { grpcs } from "../../utils/grpc.client.call.util";
import { ResolveUsernamesRequest } from "../../grpc/generated/user";

export class MentionService implements IMentionService {
  constructor(
    private _mentionRepository: IMentionRepository,
    private _outboxService: IOutboxService
  ) {}

  async processMentions(
    content: string,
    postId?: string,
    commentId?: string,
    actorId?: string
  ): Promise<string[]> {
    try {
      if (!content || typeof content !== "string") {
        return [];
      }

      // Extract mentions using regex (@username pattern)
      // Matches @username where username is alphanumeric and underscores
      const mentionRegex = /@(\w+)/g;
      const matches = Array.from(content.matchAll(mentionRegex));
      const usernames = matches.map((match) => match[1]);

      if (usernames.length === 0) {
        return [];
      }

      // Remove duplicates
      const uniqueUsernames = [...new Set(usernames)];

      // Resolve usernames to user IDs via gRPC call to auth-service
      let mentionedUserIds: string[] = [];

      try {
        const resolveRequest: ResolveUsernamesRequest = {
          usernames: uniqueUsernames,
        };

        const resolveResponse = await grpcs(
          userClient,
          "resolveUsernames",
          resolveRequest
        );

        // Safely extract user IDs from resolveResponse (which may be of unknown type)
        if (
          typeof resolveResponse === "object" &&
          resolveResponse !== null &&
          Array.isArray((resolveResponse as any).users)
        ) {
          mentionedUserIds = (resolveResponse as any).users.map(
            (user: { id: string }) => user.id
          );
        } else {
          mentionedUserIds = [];
        }

        if (mentionedUserIds.length === 0) {
          logger.info("No valid users found for mentions", {
            usernames: uniqueUsernames,
          });
          return [];
        }
      } catch (error: any) {
        logger.error("Error resolving usernames via gRPC", {
          error: error.message,
          usernames: uniqueUsernames,
        });
        // If gRPC call fails, return empty array (fail gracefully)
        // In production, you might want to retry or use a fallback
        return [];
      }

      // Create mentions in database
      const createdMentions: string[] = [];

      if (postId && actorId) {
        for (const mentionedUserId of mentionedUserIds) {
          try {
            // Check if mention already exists (prevent duplicates)
            const existingMentions = await this._mentionRepository.getPostMentions(postId);
            const alreadyMentioned = existingMentions.some(
              (m) => m.mentionedUserId === mentionedUserId
            );

            if (!alreadyMentioned) {
              await this._mentionRepository.createPostMention({
                postId,
                mentionedUserId,
                actorId,
              });

              createdMentions.push(mentionedUserId);

              // Create outbox event for mention
              await this._outboxService.createOutboxEvent({
                aggregateType: OutboxAggregateType.MENTION,
                aggregateId: postId,
                type: OutboxEventType.POST_MENTION_IN_POST_CREATED,
                topic: KAFKA_TOPICS.USER_MENTIONED,
                key: mentionedUserId,
                payload: {
                  postId,
                  mentionedUserId,
                  actorId,
                },
              });

              logger.info("Post mention created", {
                postId,
                mentionedUserId,
                actorId,
              });
            }
          } catch (error: any) {
            logger.error("Error creating post mention", {
              error: error.message,
              postId,
              mentionedUserId,
              actorId,
            });
            // Continue with other mentions even if one fails
          }
        }
      }

      if (commentId && actorId) {
        for (const mentionedUserId of mentionedUserIds) {
          try {
            // Check if mention already exists
            const existingMentions = await this._mentionRepository.getCommentMentions(commentId);
            const alreadyMentioned = existingMentions.some(
              (m) => m.mentionedUserId === mentionedUserId
            );

            if (!alreadyMentioned) {
              await this._mentionRepository.createCommentMention({
                commentId,
                mentionedUserId,
                actorId,
              });

              createdMentions.push(mentionedUserId);

              // Create outbox event for mention
              await this._outboxService.createOutboxEvent({
                aggregateType: OutboxAggregateType.MENTION,
                aggregateId: commentId,
                type: OutboxEventType.POST_MENTION_IN_COMMENT_CREATED,
                topic: KAFKA_TOPICS.USER_MENTIONED,
                key: mentionedUserId,
                payload: {
                  commentId,
                  mentionedUserId,
                  actorId,
                },
              });

              logger.info("Comment mention created", {
                commentId,
                mentionedUserId,
                actorId,
              });
            }
          } catch (error: any) {
            logger.error("Error creating comment mention", {
              error: error.message,
              commentId,
              mentionedUserId,
              actorId,
            });
            // Continue with other mentions even if one fails
          }
        }
      }

      logger.info("Processed mentions", {
        postId,
        commentId,
        actorId,
        mentionedCount: createdMentions.length,
        totalUsernames: uniqueUsernames.length,
        resolvedUserIds: mentionedUserIds.length,
      });

      return createdMentions;
    } catch (err: any) {
      logger.error("Error processing mentions", {
        error: err.message,
        postId,
        commentId,
        actorId,
        stack: err.stack,
      });
      // Return empty array on error to not break the flow
      return [];
    }
  }
}