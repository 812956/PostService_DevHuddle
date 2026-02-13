import { ILikeService } from "../interfaces/ILikeService";
import { ILikeRepository } from "../../repositories/interface/ILikeRepository";
import { IPostRepository } from "../../repositories/interface/IPostRepository";
import { ICommentRepository } from "../../repositories/interface/ICommentRepository";
import { IOutboxService } from "../interfaces/IOutboxService";
import { CustomError } from "../../utils/error.util";
import logger from "../../utils/logger.util";
import { HttpStatus } from "../../constands/http.status";
import { RedisCacheService } from "../../utils/redis.util";
import { KAFKA_TOPICS } from "../../config/kafka.config";
import {
  OutboxAggregateType,
  OutboxEventType,
  ReactionTargetType,
} from "@prisma/client";

export class LikeService implements ILikeService {
  constructor(
    private _likeRepository: ILikeRepository,
    private _postRepository: IPostRepository,
    private _commentRepository: ICommentRepository,
    private _outboxService: IOutboxService
  ) {}

  // ========== PUBLIC METHODS - POST LIKES (Explicit API) ==========

  async likePost(postId: string, userId: string): Promise<void> {
    return this.likeInternal(ReactionTargetType.POST, postId, userId);
  }

  async unlikePost(postId: string, userId: string): Promise<void> {
    return this._unlikeInternal(ReactionTargetType.POST, postId, userId);
  }

  async isPostLiked(postId: string, userId: string): Promise<boolean> {
    return this._isLikedInternal(ReactionTargetType.POST, postId, userId);
  }

  async getPostLikeCount(postId: string): Promise<number> {
    return this._getLikeCountInternal(ReactionTargetType.POST, postId);
  }

  // ========== PUBLIC METHODS - COMMENT LIKES (Explicit API) ==========

  async likeComment(commentId: string, userId: string): Promise<void> {
    return this.likeInternal(ReactionTargetType.COMMENT, commentId, userId);
  }

  async unlikeComment(commentId: string, userId: string): Promise<void> {
    return this._unlikeInternal(ReactionTargetType.COMMENT, commentId, userId);
  }

  async isCommentLiked(commentId: string, userId: string): Promise<boolean> {
    return this._isLikedInternal(ReactionTargetType.COMMENT, commentId, userId);
  }

  async getCommentLikeCount(commentId: string): Promise<number> {
    return this._getLikeCountInternal(ReactionTargetType.COMMENT, commentId);
  }

  // ========== PRIVATE HELPERS (Shared Logic - DRY) ==========

  /**
   * Get event version for ordering and conflict resolution
   * Uses timestamp as version for simplicity
   * In production, you might want to use a sequence number from database
   */
  private _getEventVersion(): number {
    // Use timestamp as version for event ordering
    // This ensures events are ordered correctly even if Kafka delivers them out of order
    return Date.now();
  }

  private async likeInternal(
    targetType: ReactionTargetType,
    targetId: string,
    userId: string
  ): Promise<void> {
    try {
      // Validate target exists
      const targetDetails = await this._getTargetDetails(targetType, targetId);
      if (!targetDetails) {
        throw new CustomError(HttpStatus.NOT_FOUND, "Target not found");
      }

      // Check if already liked (active like)
      const existingLike = await this._likeRepository.findLike(
        targetType,
        targetId,
        userId
      );
      if (existingLike) {
        // Already liked - return silently (idempotent behavior)
        logger.info(`${targetType} ${targetId} already liked by user ${userId}`);
        return;
      }

      // Check if there's a soft-deleted like (for re-liking)
      const softDeletedLike = await this._likeRepository.findSoftDeletedLike(
        targetType,
        targetId,
        userId
      );

      let like: any;
      const isRestore = !!softDeletedLike;
      
      if (softDeletedLike) {
        // Restore the soft-deleted like instead of creating a new one
        like = await this._likeRepository.restoreLike(softDeletedLike.id);
        logger.info(`Restored soft-deleted like for ${targetType} ${targetId} by user ${userId}`);
      } else {
        // Create new like
        try {
          if (targetType === ReactionTargetType.POST) {
            like = await this._likeRepository.createLike({
              userId,
              type: "LIKE",
              postId: targetId,
              targetType: ReactionTargetType.POST,
            });
          } else if (targetType === ReactionTargetType.COMMENT) {
            like = await this._likeRepository.createLike({
              userId,
              type: "LIKE",
              commentId: targetId,
              targetType: ReactionTargetType.COMMENT,
            });
          } else {
            throw new CustomError(
              HttpStatus.BAD_REQUEST,
              `Invalid target type: ${targetType}`
            );
          }
        } catch (createError: any) {
          // If unique constraint violation, check if like was created by another request
          if (createError.message?.includes("already exists") || createError.code === 'P2002') {
            logger.warn(`Like already exists for ${targetType} ${targetId} by user ${userId} (race condition)`);
            // Verify it exists now
            const verifyLike = await this._likeRepository.findLike(targetType, targetId, userId);
            if (verifyLike) {
              // Like exists now, treat as success
              return;
            }
          }
          throw createError;
        }
      }

      // Get event version and timestamp for ordering
      const version = this._getEventVersion();
      const eventTimestamp = new Date().toISOString();

      // Update counter and prepare event
      // Note: For restored likes, counters were decremented on unlike, so we need to increment them back
      // For new likes, we increment counters
      let eventType: OutboxEventType;
      let topic: string;
      let payload: any;

      if (targetType === ReactionTargetType.POST) {
        await this._postRepository.incrementLikesCount(targetId);
        await RedisCacheService.incrementPostLikes(targetId);
        eventType = OutboxEventType.POST_LIKE_CREATED;
        topic = KAFKA_TOPICS.POST_LIKE_CREATED;
        payload = {
          postId: targetId,
          userId,
          postAuthorId: targetDetails.authorId,
          eventTimestamp,
          version,
          action: isRestore ? "LIKE_RESTORED" : "LIKE",
        };
      } else if (targetType === ReactionTargetType.COMMENT) {
        // Verify comment exists before incrementing counter
        const comment = await this._commentRepository.findComment(targetId);
        if (!comment) {
          throw new CustomError(HttpStatus.NOT_FOUND, "Comment not found");
        }
        
        await this._commentRepository.incrementLikesCount(targetId);
        await RedisCacheService.incrementCommentLikes(targetId);
        // Invalidate comment list cache so refetches get fresh data with updated likesCount
        if (targetDetails.postId) {
          await RedisCacheService.invalidateCommentList(targetDetails.postId);
        }
        eventType = OutboxEventType.COMMENT_LIKE_CREATED;
        topic = KAFKA_TOPICS.COMMENT_LIKE_CREATED;
        payload = {
          commentId: targetId,
          userId,
          commentAuthorId: targetDetails.authorId,
          postId: targetDetails.postId,
          eventTimestamp,
          version,
          action: isRestore ? "LIKE_RESTORED" : "LIKE",
        };
      } else {
        throw new CustomError(
          HttpStatus.BAD_REQUEST,
          `Invalid target type: ${targetType}`
        );
      }

      // Create outbox event
      await this._createOutboxLikeEvent(
        targetId,
        eventType,
        topic,
        targetId,
        payload
      );

      logger.info(`${targetType} ${targetId} liked by user ${userId}`);
    } catch (err: any) {
      logger.error(`Error liking ${targetType}`, {
        error: err.message,
        targetType,
        targetId,
        userId,
      });
      throw err instanceof CustomError
        ? err
        : new CustomError(
            HttpStatus.INTERNAL_SERVER_ERROR,
            `Failed to like ${targetType}`
          );
    }
  }

  private async _createOutboxLikeEvent(
    aggregateId: string,
    type: OutboxEventType,
    topic: string,
    key: string,
    payload: any
  ): Promise<void> {
    await this._outboxService.createOutboxEvent({
      aggregateType: OutboxAggregateType.REACTION, // Use REACTION, not ReactionTargetType
      aggregateId,
      type,
      topic,
      key,
      payload,
    });
    logger.info(
      `Created outbox event: ${type} for reaction ${aggregateId} on topic ${topic}`
    );
  }

  private async _unlikeInternal(
    targetType: ReactionTargetType,
    targetId: string,
    userId: string
  ): Promise<void> {
    try {
      // Check if like exists
      const existingLike = await this._likeRepository.findLike(
        targetType,
        targetId,
        userId
      );
      if (!existingLike) {
        throw new CustomError(HttpStatus.NOT_FOUND, "Like not found");
      }

      // Delete like
      await this._likeRepository.deleteLike(targetType, targetId, userId);

      // Get target details for event (before deleting)
      const targetDetails = await this._getTargetDetails(targetType, targetId);
      if (!targetDetails) {
        throw new CustomError(HttpStatus.NOT_FOUND, "Target not found");
      }

      // Get event version and timestamp for ordering
      const version = this._getEventVersion();
      const eventTimestamp = new Date().toISOString();

      // Update counter and prepare event
      let eventType: OutboxEventType;
      let topic: string;
      let payload: any;

      if (targetType === ReactionTargetType.POST) {
        await this._postRepository.decrementLikesCount(targetId);
        await RedisCacheService.decrementPostLikes(targetId);
        eventType = OutboxEventType.POST_LIKE_REMOVED;
        topic = KAFKA_TOPICS.POST_LIKE_REMOVED;
        payload = {
          postId: targetId,
          userId,
          postAuthorId: targetDetails.authorId,
          eventTimestamp, 
          version, 
          action: "UNLIKE", 
        };
      } else if (targetType === ReactionTargetType.COMMENT) {
        await this._commentRepository.decrementLikesCount(targetId);
        await RedisCacheService.decrementCommentLikes(targetId);
        // Invalidate comment list cache so refetches get fresh data with updated likesCount
        if (targetDetails.postId) {
          await RedisCacheService.invalidateCommentList(targetDetails.postId);
        }
        eventType = OutboxEventType.COMMENT_LIKE_REMOVED;
        topic = KAFKA_TOPICS.COMMENT_LIKE_REMOVED;
        payload = {
          commentId: targetId,
            userId,
          commentAuthorId: targetDetails.authorId,
          postId: targetDetails.postId,
          eventTimestamp, 
          version, 
          action: "UNLIKE", 
        };
      } else {
        throw new CustomError(
          HttpStatus.BAD_REQUEST,
          `Invalid target type: ${targetType}`
        );
      }

      // Create outbox event for unlike
      await this._createOutboxLikeEvent(
        targetId,
        eventType,
        topic,
        targetId,
        payload
      );

      logger.info(`${targetType} ${targetId} unliked by user ${userId}`);
    } catch (err: any) {
      logger.error(`Error unliking ${targetType}`, {
        error: err.message,
        targetType,
        targetId,
        userId,
      });
      throw err instanceof CustomError
        ? err
        : new CustomError(
            HttpStatus.INTERNAL_SERVER_ERROR,
            `Failed to unlike ${targetType}`
          );
    }
  }

  private async _isLikedInternal(
    targetType: ReactionTargetType,
    targetId: string,
    userId: string
  ): Promise<boolean> {
    try {
      const like = await this._likeRepository.findLike(
        targetType,
        targetId,
        userId
      );
      return !!like;
    } catch (err: any) {
      logger.error(`Error checking ${targetType} like status`, {
        error: err.message,
        targetType,
        targetId,
        userId,
      });
      return false;
    }
  }

  private async _getLikeCountInternal(
    targetType: ReactionTargetType,
    targetId: string
  ): Promise<number> {
    try {
      let cachedCount: number | null = null;

      if (targetType === ReactionTargetType.POST) {
        cachedCount = await RedisCacheService.getPostLikes(targetId);
      } else if (targetType === ReactionTargetType.COMMENT) {
        cachedCount = await RedisCacheService.getCommentLikes(targetId);
      }

      if (cachedCount !== null) {
        return cachedCount;
      }

      // Cache miss - get from database
      const count = await this._likeRepository.getLikeCount(
        targetType,
        targetId
      );

      // Cache the result (cache-aside pattern)
      if (targetType === ReactionTargetType.POST) {
        await RedisCacheService.cachePostLikes(targetId, count);
      } else if (targetType === ReactionTargetType.COMMENT) {
        await RedisCacheService.cacheCommentLikesCount(targetId, count);
      }

      return count;
    } catch (err: any) {
      logger.error(`Error getting ${targetType} like count`, {
        error: err.message,
        targetType,
        targetId,
      });
      throw new CustomError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `Failed to get ${targetType} like count`
      );
    }
  }

  private async _getTargetDetails(
    targetType: ReactionTargetType,
    targetId: string
  ): Promise<{ authorId: string; postId?: string } | undefined> {
    if (targetType === ReactionTargetType.POST) {
      const post = await this._postRepository.findPost(targetId);
      if (!post) {
        return undefined;
      }
      return { authorId: post.userId };
    } else if (targetType === ReactionTargetType.COMMENT) {
      const comment = await this._commentRepository.findComment(targetId);
      if (!comment) {
        return undefined;
      }
      return { authorId: comment.userId, postId: comment.postId };
    }
    return undefined;
  }
}
