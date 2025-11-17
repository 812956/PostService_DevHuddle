import { ILikeService } from "../interfaces/ILikeService";
import { ILikeRepository } from "../../repositories/interface/ILikeRepository";
import { IPostRepository } from "../../repositories/interface/IPostRepository";
import { ICommentRepository } from "../../repositories/interface/ICommentRepository";
import { IOutboxService } from "../interfaces/IOutboxService";
import { CustomError } from "../../utils/error.util";
import logger from "../../utils/logger.util";
import * as grpc from "@grpc/grpc-js";
import { RedisCacheService } from "../../utils/redis.util";
import { KAFKA_TOPICS } from "../../config/kafka.config";
import {
  OutboxAggregateType,
  OutboxEventType,
  ReactionTargetType,
} from "@prisma/client";

export class LikeService implements ILikeService {
  constructor(
    private likeRepository: ILikeRepository,
    private postRepository: IPostRepository,
    private commentRepository: ICommentRepository,
    private outboxService: IOutboxService
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

  private async likeInternal(
    targetType: ReactionTargetType,
    targetId: string,
    userId: string
  ): Promise<void> {
    try {
      // Validate target exists
      const targetDetails = await this._getTargetDetails(targetType, targetId);
      if (!targetDetails) {
        throw new CustomError(grpc.status.NOT_FOUND, "Target not found");
      }

      // Check if already liked
      const existingLike = await this.likeRepository.findLike(
        targetType,
        targetId,
        userId
      );
      if (existingLike) {
        throw new CustomError(
          grpc.status.ALREADY_EXISTS,
          `${targetType} already liked`
        );
      }

      // Create like
      if (targetType === ReactionTargetType.POST) {
        await this.likeRepository.createLike({
          userId,
          type: "LIKE",
          postId: targetId,
          targetType: ReactionTargetType.POST,
        });
      } else if (targetType === ReactionTargetType.COMMENT) {
        await this.likeRepository.createLike({
          userId,
          type: "LIKE",
          commentId: targetId,
          targetType: ReactionTargetType.COMMENT,
        });
      } else {
        throw new CustomError(
          grpc.status.INVALID_ARGUMENT,
          `Invalid target type: ${targetType}`
        );
      }

      // Update counter and prepare event
      let eventType: OutboxEventType;
      let topic: string;
      let payload: any;

      if (targetType === ReactionTargetType.POST) {
        await this.postRepository.incrementLikesCount(targetId);
        await RedisCacheService.incrementPostLikes(targetId);
        eventType = OutboxEventType.POST_LIKE_CREATED;
        topic = KAFKA_TOPICS.POST_LIKE_CREATED;
        payload = {
          postId: targetId,
          userId,
          postAuthorId: targetDetails.authorId,
        };
      } else if (targetType === ReactionTargetType.COMMENT) {
        await this.commentRepository.incrementLikesCount(targetId);
        await RedisCacheService.incrementCommentLikes(targetId);
        eventType = OutboxEventType.COMMENT_LIKE_CREATED;
        topic = KAFKA_TOPICS.COMMENT_LIKE_CREATED;
        payload = {
          commentId: targetId,
          userId,
          commentAuthorId: targetDetails.authorId,
          postId: targetDetails.postId,
        };
      } else {
        throw new CustomError(
          grpc.status.INVALID_ARGUMENT,
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
        : new CustomError(grpc.status.INTERNAL, `Failed to like ${targetType}`);
    }
  }

  private async _createOutboxLikeEvent(
    aggregateId: string,
    type: OutboxEventType,
    topic: string,
    key: string,
    payload: any
  ): Promise<void> {
    await this.outboxService.createOutboxEvent({
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
      const existingLike = await this.likeRepository.findLike(
        targetType,
        targetId,
        userId
      );
      if (!existingLike) {
        throw new CustomError(grpc.status.NOT_FOUND, "Like not found");
      }

      // Delete like
      await this.likeRepository.deleteLike(targetType, targetId, userId);

      // Get target details for event (before deleting)
      const targetDetails = await this._getTargetDetails(targetType, targetId);
      if (!targetDetails) {
        throw new CustomError(grpc.status.NOT_FOUND, "Target not found");
      }

      // Update counter and prepare event
      let eventType: OutboxEventType;
      let topic: string;
      let payload: any;

      if (targetType === ReactionTargetType.POST) {
        await this.postRepository.decrementLikesCount(targetId);
        await RedisCacheService.decrementPostLikes(targetId);
        eventType = OutboxEventType.POST_LIKE_REMOVED;
        topic = KAFKA_TOPICS.POST_LIKE_REMOVED;
        payload = {
          postId: targetId,
          userId,
          postAuthorId: targetDetails.authorId,
        };
      } else if (targetType === ReactionTargetType.COMMENT) {
        await this.commentRepository.decrementLikesCount(targetId);
        await RedisCacheService.decrementCommentLikes(targetId);
        eventType = OutboxEventType.COMMENT_LIKE_REMOVED;
        topic = KAFKA_TOPICS.COMMENT_LIKE_REMOVED;
        payload = {
          commentId: targetId,
          userId,
          commentAuthorId: targetDetails.authorId,
          postId: targetDetails.postId,
        };
      } else {
        throw new CustomError(
          grpc.status.INVALID_ARGUMENT,
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
            grpc.status.INTERNAL,
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
      const like = await this.likeRepository.findLike(
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
      const count = await this.likeRepository.getLikeCount(
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
        grpc.status.INTERNAL,
        `Failed to get ${targetType} like count`
      );
    }
  }

  private async _getTargetDetails(
    targetType: ReactionTargetType,
    targetId: string
  ): Promise<{ authorId: string; postId?: string } | undefined> {
    if (targetType === ReactionTargetType.POST) {
      const post = await this.postRepository.findPost(targetId);
      if (!post) {
        return undefined;
      }
      return { authorId: post.userId };
    } else if (targetType === ReactionTargetType.COMMENT) {
      const comment = await this.commentRepository.findComment(targetId);
      if (!comment) {
        return undefined;
      }
      return { authorId: comment.userId, postId: comment.postId };
    }
    return undefined;
  }
}