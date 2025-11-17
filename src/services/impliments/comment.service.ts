import { ICommentService } from "../interfaces/ICommentService";
import { ICommentRepository } from "../../repositories/interface/ICommentRepository";
import { IPostRepository } from "../../repositories/interface/IPostRepository";
import { IMentionService } from "../interfaces/IMentionService";
import { IOutboxService } from "../interfaces/IOutboxService";
import { CustomError } from "../../utils/error.util";
import logger from "../../utils/logger.util";
import * as grpc from "@grpc/grpc-js";
import { sanitizeInput, validateContentLength } from "../../utils/xss.util";
import { RedisCacheService } from "../../utils/redis.util";
import { KAFKA_TOPICS } from "../../config/kafka.config";
import { Comment, OutboxAggregateType, OutboxEventType } from "@prisma/client";

export class CommentService implements ICommentService {
  constructor(
    private commentRepository: ICommentRepository,
    private postRepository: IPostRepository,
    private mentionService: IMentionService,
    private outboxService: IOutboxService
  ) {}

  async createComment(
    postId: string,
    userId: string,
    content: string,
    parentCommentId?: string
  ): Promise<any> {
    try {
      // Validate post exists
      const post = await this.postRepository.findPost(postId);
      if (!post) {
        throw new CustomError(grpc.status.NOT_FOUND, "Post not found");
      }

      // Validate parent comment if provided
      if (parentCommentId) {
        const parentComment = await this.commentRepository.findComment(
          parentCommentId
        );
        if (!parentComment || parentComment.postId !== postId) {
          throw new CustomError(
            grpc.status.NOT_FOUND,
            "Parent comment not found"
          );
        }
      }

      // Sanitize and validate content
      const sanitizedContent = sanitizeInput(content);
      if (!validateContentLength(sanitizedContent, 5000)) {
        throw new CustomError(
          grpc.status.INVALID_ARGUMENT,
          "Comment content too long"
        );
      }

      if (sanitizedContent.trim().length === 0) {
        throw new CustomError(
          grpc.status.INVALID_ARGUMENT,
          "Comment content cannot be empty"
        );
      }

      // Create comment
      const comment = await this.commentRepository.createComment({
        postId,
        userId,
        content: sanitizedContent,
        parentCommentId,
      });

      // Update counter
      await this.postRepository.incrementCommentsCount(postId);

      // Invalidate cache
      await RedisCacheService.invalidatePostCounter(postId, "comments");
      await RedisCacheService.invalidateCommentList(postId);

      // Process mentions
      const mentionedUserIds = await this.mentionService.processMentions(
        sanitizedContent,
        undefined,
        comment.id,
        userId
      );

      // Create outbox event for comment created
      await this.outboxService.createOutboxEvent({
        aggregateType: OutboxAggregateType.COMMENT,
        aggregateId: comment.id,
        type: OutboxEventType.POST_COMMENT_CREATED,
        topic: KAFKA_TOPICS.POST_COMMENT_CREATED,
        key: postId,
        payload: {
          commentId: comment.id,
          postId,
          userId,
          postAuthorId: post.userId,
          parentCommentId,
          content: sanitizedContent,
          mentionedUserIds,
        },
      });

      logger.info(`Comment created: ${comment.id} on post ${postId}`);
      return comment;
    } catch (err: any) {
      logger.error("Error creating comment", {
        error: err.message,
        postId,
        userId,
      });
      throw err instanceof CustomError
        ? err
        : new CustomError(grpc.status.INTERNAL, "Failed to create comment");
    }
  }

  async updateComment(
    commentId: string,
    userId: string,
    content: string
  ): Promise<any> {
    try {
      // Find comment
      const comment = await this.commentRepository.findComment(commentId);
      if (!comment) {
        throw new CustomError(grpc.status.NOT_FOUND, "Comment not found");
      }

      // Check ownership
      if (comment.userId !== userId) {
        throw new CustomError(
          grpc.status.PERMISSION_DENIED,
          "Not authorized to edit this comment"
        );
      }

      // Sanitize and validate content
      const sanitizedContent = sanitizeInput(content);
      if (!validateContentLength(sanitizedContent, 5000)) {
        throw new CustomError(
          grpc.status.INVALID_ARGUMENT,
          "Comment content too long"
        );
      }

      // Update comment
      const updatedComment = await this.commentRepository.updateComment(
        commentId,
        sanitizedContent
      );

      // Process mentions in updated content
      await this.mentionService.processMentions(
        sanitizedContent,
        undefined,
        commentId,
        userId
      );

      // Invalidate cache
      await RedisCacheService.invalidateCommentList(comment.postId);

      // Create outbox event
      await this.outboxService.createOutboxEvent({
        aggregateType: OutboxAggregateType.COMMENT,
        aggregateId: commentId,
        type: OutboxEventType.POST_COMMENT_EDITED,
        topic: KAFKA_TOPICS.POST_COMMENT_EDITED,
        key: comment.postId,
        payload: {
          commentId,
          postId: comment.postId,
          userId,
        },
      });

      logger.info(`Comment updated: ${commentId}`);
      return updatedComment;
    } catch (err: any) {
      logger.error("Error updating comment", {
        error: err.message,
        commentId,
        userId,
      });
      throw err instanceof CustomError
        ? err
        : new CustomError(grpc.status.INTERNAL, "Failed to update comment");
    }
  }

  async deleteComment(commentId: string, userId: string): Promise<void> {
    try {
      // Find comment
      const comment = await this.commentRepository.findComment(commentId);
      if (!comment) {
        throw new CustomError(grpc.status.NOT_FOUND, "Comment not found");
      }

      // Check ownership
      if (comment.userId !== userId) {
        throw new CustomError(
          grpc.status.PERMISSION_DENIED,
          "Not authorized to delete this comment"
        );
      }

      // Soft delete comment
      await this.commentRepository.deleteComment(commentId);

      // Update counter
      await this.postRepository.decrementCommentsCount(comment.postId);

      // Invalidate cache
      await RedisCacheService.invalidatePostCounter(comment.postId, "comments");
      await RedisCacheService.invalidateCommentList(comment.postId);

      // Create outbox event
      await this.outboxService.createOutboxEvent({
        aggregateType: "Comment",
        aggregateId: commentId,
        type: "POST_COMMENT_DELETED",
        topic: KAFKA_TOPICS.POST_COMMENT_DELETED,
        key: comment.postId,
        payload: {
          commentId,
          postId: comment.postId,
          userId,
        },
      });

      logger.info(`Comment deleted: ${commentId}`);
    } catch (err: any) {
      logger.error("Error deleting comment", {
        error: err.message,
        commentId,
        userId,
      });
      throw err instanceof CustomError
        ? err
        : new CustomError(grpc.status.INTERNAL, "Failed to delete comment");
    }
  }

  async getComments(
    postId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<Comment[]> {
    try {
      if (offset === 0) {
        const cachedComments = await RedisCacheService.getCachedCommentList(
          postId
        );
        if (cachedComments) {
          return cachedComments.slice(0, limit);
        }
      }

      // Get from database with clear parameters
      const comments = await this.commentRepository.getCommentsByPost(
        postId,
        limit,
        offset,
        true, // includeReplies
        true // includeMentions
      );

      // Cache if first page
      if (offset === 0 && comments.length > 0) {
        await RedisCacheService.cacheCommentList(postId, comments);
      }

      return comments;
    } catch (err: any) {
      logger.error("Error getting comments", {
        error: err.message,
        postId,
      });
      throw new CustomError(grpc.status.INTERNAL, "Failed to get comments");
    }
  }

  async getComment(commentId: string): Promise<Comment | null> {
    try {
      return await this.commentRepository.findComment(commentId);
    } catch (err: any) {
      logger.error("Error getting comment", {
        error: err.message,
        commentId,
      });
      throw new CustomError(grpc.status.INTERNAL, "Failed to get comment");
    }
  }

  async getCommentCount(postId: string): Promise<number> {
    try {
      const cachedCount = await RedisCacheService.getPostComments(postId);
      if (cachedCount !== null) {
        return cachedCount;
      }

      const count = await this.commentRepository.getCommentCount(postId);
      await RedisCacheService.cachePostCommentsCount(postId, count);
      return count;
    } catch (err: any) {
      logger.error("Error getting comment count", {
        error: err.message,
        postId,
      });
      throw new CustomError(
        grpc.status.INTERNAL,
        "Failed to get comment count"
      );
    }
  }
}
