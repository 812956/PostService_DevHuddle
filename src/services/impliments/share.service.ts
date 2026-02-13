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
  Visibility,
} from "@prisma/client";
import { sanitizeInput, validateContentLength } from "../../utils/xss.util";

export class ShareService implements IShareService {
  constructor(
    private _shareRepository: IShareRepository,
    private _postRepository: IPostRepository,
    private _outboxService: IOutboxService
  ) {}

  async sharePost(
    postId: string,
    userId: string,
    shareType: string,
    targetType?: string,
    caption?: string,
    visibility?: string,
    sharedToUserId?: string
  ): Promise<any> {
    try {
      // 1. Validate post exists
      const post = await this._postRepository.findPost(postId);
      if (!post) {
        throw new CustomError(grpc.status.NOT_FOUND, "Post not found");
      }

      // 2. Permission check - can user share this?
      await this.validateSharePermission(post, userId, shareType as ShareType, visibility as Visibility);

      // 3. Validate share type
      const validShareTypes = [
        ShareType.RESHARE,
        ShareType.QUOTE,
        ShareType.TO_FEED,
        ShareType.PRIVATE_MESSAGE,
        ShareType.TO_CONVERSATION,
      ];
      if (!validShareTypes.includes(shareType as ShareType)) {
        throw new CustomError(
          grpc.status.INVALID_ARGUMENT,
          "Invalid share type"
        );
      }

      // 4. Calculate effective visibility (prevent private → public leak)
      const effectiveVisibility = this.calculateEffectiveVisibility(
        post.visibility,
        visibility as Visibility || Visibility.PUBLIC
      );

      // 5. Sanitize caption if provided
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

      // 6. Determine targetType and targetId based on shareType
      let finalTargetType: TargetType = TargetType.USER;
      let finalTargetId: string | undefined;

      if (shareType === ShareType.PRIVATE_MESSAGE) {
        if (!sharedToUserId) {
          throw new CustomError(
            grpc.status.INVALID_ARGUMENT,
            "sharedToUserId is required for PRIVATE_MESSAGE"
          );
        }
        finalTargetType = TargetType.USER;
        finalTargetId = sharedToUserId;
      } else if (shareType === ShareType.TO_FEED) {
        finalTargetType = TargetType.USER;
        finalTargetId = userId; // User's own feed
      } else {
        finalTargetType = (targetType as TargetType) || TargetType.USER;
        finalTargetId = userId;
      }

      // 7. Create share (via repository which handles transaction)
      const share = await this._shareRepository.createShare({
        postId,
        userId,
        shareType,
        caption: sanitizedCaption,
        visibility: effectiveVisibility,
        targetType: finalTargetType,
        targetId: finalTargetId,
        sharedToUserId: finalTargetId,
      });

      // 8. Invalidate cache
      await RedisCacheService.invalidatePostCounter(postId, "shares");

      // 9. Create outbox event
      await this._outboxService.createOutboxEvent({
        aggregateType: OutboxAggregateType.SHARE,
        aggregateId: share.id,
        type: OutboxEventType.SHARE_CREATED,
        topic: KAFKA_TOPICS.POST_SENT, // Using POST_SENT as replacement for POST_SHARED
        key: postId,
        payload: {
          shareId: share.id,
          originalPostId: postId,
          originalAuthorId: post.userId,
          sharedById: userId,
          shareType,
          visibility: effectiveVisibility,
          sharedToUserId: finalTargetId,
          caption: sanitizedCaption,
        },
      });

      logger.info(`Post ${postId} shared by user ${userId}`, {
        shareId: share.id,
        shareType,
        visibility: effectiveVisibility,
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

  private async validateSharePermission(
    post: any,
    userId: string,
    shareType: ShareType,
    requestedVisibility?: Visibility
  ): Promise<void> {
    // Can't share if original author disabled sharing
    if (post.sharingDisabled) {
      throw new CustomError(
        grpc.status.PERMISSION_DENIED,
        "Sharing disabled for this post"
      );
    }

    // Can't share private post publicly
    if (
      post.visibility === "VISIBILITY_CONNECTIONS" &&
      requestedVisibility === "PUBLIC"
    ) {
      throw new CustomError(
        grpc.status.PERMISSION_DENIED,
        "Cannot share private post publicly"
      );
    }
  }

  private calculateEffectiveVisibility(
    originalVisibility: Visibility,
    requestedVisibility: Visibility
  ): Visibility {
    // Share visibility cannot be more permissive than original
    const visibilityHierarchy = {
      VISIBILITY_CONNECTIONS: 0,
      PUBLIC: 1,
    };

    const originalLevel = visibilityHierarchy[originalVisibility] ?? 0;
    const requestedLevel = visibilityHierarchy[requestedVisibility] ?? 1;

    return requestedLevel <= originalLevel
      ? requestedVisibility
      : originalVisibility;
  }

  async getShareCount(postId: string): Promise<number> {
    try {
      // Try cache first
      const cachedCount = await RedisCacheService.getPostShares(postId);
      if (cachedCount !== null) {
        return cachedCount;
      }

      // Cache miss - get from database
      const count = await this._shareRepository.getShareCount(postId);

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
      const share = await this._shareRepository.findShare(postId, userId);
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