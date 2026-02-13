import { ISendService } from "../interfaces/ISendService";
import { IPostRepository } from "../../repositories/interface/IPostRepository";
import { IOutboxService } from "../interfaces/IOutboxService";
import { CustomError } from "../../utils/error.util";
import * as grpc from "@grpc/grpc-js";
import logger from "../../utils/logger.util";
import { KAFKA_TOPICS } from "../../config/kafka.config";
import { OutboxAggregateType, OutboxEventType } from "@prisma/client";

/**
 * Send Service
 * Handles sending posts to connections (LinkedIn-style)
 * Creates notifications for each recipient
 */
export class SendService implements ISendService {
  constructor(
    private _postRepository: IPostRepository,
    private _outboxService: IOutboxService
  ) {}

  async sendPost(
    postId: string,
    senderId: string,
    recipientIds: string[],
    message?: string
  ): Promise<{
    success: boolean;
    sentTo: string[];
    message?: string;
  }> {
    try {
      // 1. Validate post exists
      const post = await this._postRepository.findPost(postId);
      if (!post) {
        throw new CustomError(grpc.status.NOT_FOUND, "Post not found");
      }

      // 2. Validate recipient IDs
      if (!recipientIds || recipientIds.length === 0) {
        throw new CustomError(
          grpc.status.INVALID_ARGUMENT,
          "At least one recipient is required"
        );
      }

      // 3. Remove sender from recipients (can't send to yourself)
      const validRecipients = recipientIds.filter((id) => id !== senderId);
      if (validRecipients.length === 0) {
        throw new CustomError(
          grpc.status.INVALID_ARGUMENT,
          "Cannot send post to yourself"
        );
      }

      // 4. Validate recipients are connections (optional - can be done via gRPC call to auth-service)
      // For now, we'll trust the frontend and validate in notification service if needed

      // 5. Get event version and timestamp for ordering
      const version = Date.now();
      const eventTimestamp = new Date().toISOString();

      // 6. Create outbox events for notifications
      // Each recipient gets a separate notification
      for (const recipientId of validRecipients) {
        try {
          await this._outboxService.createOutboxEvent({
            aggregateType: OutboxAggregateType.POST,
            aggregateId: postId,
            type: OutboxEventType.POST_SENT,
            topic: KAFKA_TOPICS.POST_SENT,
            key: recipientId, // Use recipientId as key for partitioning
            payload: {
              postId,
              senderId,
              recipientId,
              message: message || undefined,
              postAuthorId: post.userId,
              postContent: post.content.substring(0, 200), // Preview
              eventTimestamp,
              version,
              action: "POST_SENT",
            },
          });
        } catch (outboxError: any) {
          logger.error("Failed to create outbox event for recipient", {
            recipientId,
            postId,
            error: outboxError.message,
            stack: outboxError.stack,
          });
          // Continue with other recipients even if one fails
          // This ensures partial success
        }
      }

      logger.info(`Post ${postId} sent to ${validRecipients.length} recipients`, {
        postId,
        senderId,
        recipientCount: validRecipients.length,
      });

      return {
        success: true,
        sentTo: validRecipients,
        message: message || undefined,
      };
    } catch (error: any) {
      logger.error("Error sending post", {
        error: error.message,
        postId,
        senderId,
        recipientCount: recipientIds?.length || 0,
      });
      throw error instanceof CustomError
        ? error
        : new CustomError(grpc.status.INTERNAL, "Failed to send post");
    }
  }
}

