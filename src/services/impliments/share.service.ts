import { IShareService } from "../interfaces/IShareService";
import { IShareRepository } from "../../repositories/interface/IShareRepository";
import { IPostRepository } from "../../repositories/interface/IPostRepository";
import { IOutboxService } from "../interfaces/IOutboxService";
import { CustomError } from "../../utils/error.util";
import logger from "../../utils/logger.util";
import * as grpc from "@grpc/grpc-js";
import { RedisCacheService } from "../../utils/redis.util";
import { KAFKA_TOPICS } from "../../config/kafka.config";
import {
  OutboxAggregateType,
  OutboxEventType,
  ShareType,
  TargetType,
} from "@prisma/client";
import { sanitizeInput, validateContentLength } from "../../utils/xss.util";

export class ShareService implements IShareService {
  constructor(
    private shareRepository: IShareRepository,
    private postRepository: IPostRepository,
    private outboxService: IOutboxService
  ) {}

  async sharePost(
    postId: string,
    userId: string,
    shareType: string,
    caption?: string
  ): Promise<any> {
    try {
      // Validate post exists
      const post = await this.postRepository.findPost(postId);
      if (!post) {
        throw new CustomError(grpc.status.NOT_FOUND, "Post not found");
      }

      // Validate share type
      if (
        shareType !== ShareType.RESHARE &&
        shareType !== ShareType.QUOTE
      ) {
        throw new CustomError(
          grpc.status.INVALID_ARGUMENT,
          "Invalid share type. Must be RESHARE or QUOTE"
        );
      }

      // Check if already shared (optional - depends on business logic)
      // Some platforms allow multiple shares, some don't
      // For now, we'll allow multiple shares

      // Sanitize caption if provided (for QUOTE shares)
      let sanitizedCaption: string | undefined;
      if (caption) {
        sanitizedCaption = sanitizeInput(caption);
        if (!validateContentLength(sanitizedCaption, 1000)) {
          throw new CustomError(
            grpc.status.INVALID_ARGUMENT,
            "Caption too long (max 1000 characters)"
          );
        }
      }

      // Create share
      const share = await this.shareRepository.createShare({
        postId,
        userId,
        shareType: shareType as ShareType,
        caption: sanitizedCaption,
        targetType: TargetType.USER, // Default to USER, can be extended
        targetId: userId, // User sharing to their own feed
      });

      // Update post shares counter
      await this.postRepository.incrementSharesCount(postId);

      // Update cache (write-through)
      await RedisCacheService.incrementPostShares(postId);

      // Create outbox event
      await this.outboxService.createOutboxEvent({
        aggregateType: OutboxAggregateType.SHARE,
        aggregateId: share.id,
        type: OutboxEventType.SHARE_CREATED,
        topic: KAFKA_TOPICS.POST_SHARED,
        key: postId,
        payload: {
          shareId: share.id,
          postId,
          userId,
          postAuthorId: post.userId,
          shareType,
          caption: sanitizedCaption,
        },
      });

      logger.info(`Post ${postId} shared by user ${userId}`, {
        shareId: share.id,
        shareType,
      });

      return share;
    } catch (err: any) {
      logger.error("Error sharing post", {
        error: err.message,
        postId,
        userId,
        shareType,
      });
      throw err instanceof CustomError
        ? err
        : new CustomError(grpc.status.INTERNAL, "Failed to share post");
    }
  }

  async getShareCount(postId: string): Promise<number> {
    try {
      // Try cache first
      const cachedCount = await RedisCacheService.getPostShares(postId);
      if (cachedCount !== null) {
        return cachedCount;
      }

      // Cache miss - get from database
      const count = await this.shareRepository.getShareCount(postId);

      // Cache the result (cache-aside pattern)
      // Note: We don't have a cachePostSharesCount method, but we can use increment
      // For now, we'll just return the count without caching
      // TODO: Add cachePostSharesCount method to RedisCacheService if needed

      return count;
    } catch (err: any) {
      logger.error("Error getting share count", {
        error: err.message,
        postId,
      });
      throw new CustomError(
        grpc.status.INTERNAL,
        "Failed to get share count"
      );
    }
  }

  async hasShared(postId: string, userId: string): Promise<boolean> {
    try {
      const share = await this.shareRepository.findShare(postId, userId);
      return !!share;
    } catch (err: any) {
      logger.error("Error checking share status", {
        error: err.message,
        postId,
        userId,
      });
      return false;
    }
  }
}