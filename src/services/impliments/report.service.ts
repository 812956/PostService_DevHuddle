import { IReportService } from "../interfaces/IReportService";
import { IReportRepository } from "../../repositories/interface/IReportRepository";
import { IPostRepository } from "../../repositories/interface/IPostRepository";
import { ICommentRepository } from "../../repositories/interface/ICommentRepository";
import { IOutboxService } from "../interfaces/IOutboxService";
import { CustomError } from "../../utils/error.util";
import logger from "../../utils/logger.util";
import * as grpc from "@grpc/grpc-js";
import { KAFKA_TOPICS } from "../../config/kafka.config";
import {
  OutboxAggregateType,
  OutboxEventType,
  ReportTargetType,
  ReportReason,
  ReportSeverity,
  ReportStatus,
} from "@prisma/client";
import redisClient from "../../config/redis.config";

export class ReportService implements IReportService {
  constructor(
    private _reportRepository: IReportRepository,
    private _postRepository: IPostRepository,
    private _commentRepository: ICommentRepository,
    private _outboxService: IOutboxService
  ) {}

  async reportPost(
    postId: string,
    reporterId: string,
    reason: string,
    metadata?: any,
    description?: string
  ): Promise<any> {
    try {
      // 1. Rate limiting: Check if user has exceeded daily limit (5 reports per day)
      const rateLimitKey = `report:user:${reporterId}:count`;
      const reportCount = await redisClient.incr(rateLimitKey);
      if (reportCount === 1) {
        await redisClient.expire(rateLimitKey, 86400); // 24 hours
      }
      if (reportCount > 5) {
        throw new CustomError(
          grpc.status.RESOURCE_EXHAUSTED,
          "Daily report limit exceeded. Maximum 5 reports per day."
        );
      }

      // 2. Validate post exists
      const post = await this._postRepository.findPost(postId);
      if (!post) {
        throw new CustomError(grpc.status.NOT_FOUND, "Post not found");
      }

      // 3. Validate reason
      if (!Object.values(ReportReason).includes(reason as ReportReason)) {
        throw new CustomError(
          grpc.status.INVALID_ARGUMENT,
          "Invalid report reason"
        );
      }

      // 4. Check if already reported (idempotency)
      const existingReport = await this._reportRepository.findReport(
        reporterId,
        ReportTargetType.POST,
        postId
      );
      if (existingReport) {
        throw new CustomError(
          grpc.status.ALREADY_EXISTS,
          "Post already reported by this user"
        );
      }

      // 5. Get current report count to determine severity
      const currentReportCount = await this._reportRepository.getReportCount(
        ReportTargetType.POST,
        postId
      );

      // 6. Calculate severity based on report count and reason
      const severity = this.calculateSeverity(reason as ReportReason, currentReportCount);

      // 7. Create report with severity
      const report = await this._reportRepository.createReport({
        reporterId,
        targetType: ReportTargetType.POST,
        targetId: postId,
        postId,
        reason: reason as ReportReason,
        severity,
        description,
        metadata: metadata || {},
        status: ReportStatus.PENDING,
      });

      // 8. Update post reports counter
      await this._postRepository.incrementReportsCount(postId);

      // 9. Check escalation rules (auto-hide if too many reports)
      const newReportCount = currentReportCount + 1;
      if (newReportCount >= 10) {
        // Auto-hide post if 10+ reports
        await this._postRepository.updatePost(postId, {
          isHidden: true,
          hiddenAt: new Date(),
          hiddenReason: "Multiple reports received",
        });
      }

      // 10. Create outbox event
      await this._outboxService.createOutboxEvent({
        aggregateType: OutboxAggregateType.REPORT,
        aggregateId: report.id,
        type: OutboxEventType.POST_REPORT_CREATED,
        topic: KAFKA_TOPICS.POST_REPORTED,
        key: postId,
        payload: {
          reportId: report.id,
          postId,
          reporterId,
          postAuthorId: post.userId,
          reason,
          severity,
          reportCount: newReportCount,
          description,
          metadata,
        },
      });

      logger.info(`Post ${postId} reported by user ${reporterId}`, {
        reportId: report.id,
        reason,
        severity,
        reportCount: newReportCount,
      });

      return report;
    } catch (err: any) {
      logger.error("Error reporting post", {
        error: err.message,
        postId,
        reporterId,
        reason,
      });
      throw err instanceof CustomError
        ? err
        : new CustomError(grpc.status.INTERNAL, "Failed to report post");
    }
  }

  private calculateSeverity(
    reason: ReportReason,
    currentReportCount: number
  ): ReportSeverity {
    // Critical reasons
    if (
      reason === ReportReason.VIOLENCE ||
      reason === ReportReason.SELF_HARM ||
      reason === ReportReason.HATE_SPEECH
    ) {
      return ReportSeverity.CRITICAL;
    }

    // High severity reasons
    if (reason === ReportReason.HARASSMENT) {
      return ReportSeverity.HIGH;
    }

    // Medium severity with multiple reports
    if (currentReportCount >= 5) {
      return ReportSeverity.HIGH;
    }

    if (currentReportCount >= 3) {
      return ReportSeverity.MEDIUM;
    }

    // Default to low
    return ReportSeverity.LOW;
  }
  
  async reportComment(
    commentId: string,
    reporterId: string,
    reason: string,
    metadata?: any
  ): Promise<any> {
    try {
      // Validate comment exists
      const comment = await this._commentRepository.findComment(commentId);
      if (!comment) {
        throw new CustomError(grpc.status.NOT_FOUND, "Comment not found");
      }

      // Validate reason
      if (!Object.values(ReportReason).includes(reason as ReportReason)) {
        throw new CustomError(
          grpc.status.INVALID_ARGUMENT,
          "Invalid report reason"
        );
      }

      // Check if already reported
      const existingReport = await this._reportRepository.findReport(
        reporterId,
        ReportTargetType.COMMENT,
        commentId
      );
      if (existingReport) {
        throw new CustomError(
          grpc.status.ALREADY_EXISTS,
          "Comment already reported by this user"
        );
      }

      // Create report
      const report = await this._reportRepository.createReport({
        reporterId,
        targetType: ReportTargetType.COMMENT,
        targetId: commentId,
        postId: comment.postId, // Required for cascade
        commentId,
        reason: reason as ReportReason,
        metadata: metadata || {},
      });

      // Create outbox event
      await this._outboxService.createOutboxEvent({
        aggregateType: OutboxAggregateType.REPORT,
        aggregateId: report.id,
        type: OutboxEventType.POST_REPORT_CREATED, 
        topic: KAFKA_TOPICS.POST_REPORTED, 
        key: commentId,
        payload: {
          reportId: report.id,
          commentId,
          postId: comment.postId,
          reporterId,
          commentAuthorId: comment.userId,
          reason,
          metadata,
        },
      });

      logger.info(`Comment ${commentId} reported by user ${reporterId}`, {
        reportId: report.id,
        reason,
      });

      return report;
    } catch (err: any) {
      logger.error("Error reporting comment", {
        error: err.message,
        commentId,
        reporterId,
        reason,
      });
      throw err instanceof CustomError
        ? err
        : new CustomError(grpc.status.INTERNAL, "Failed to report comment");
    }
  }

  async getReportCount(
    targetType: string,
    targetId: string
  ): Promise<number> {
    try {
      return await this._reportRepository.getReportCount(
        targetType as ReportTargetType,
        targetId
      );
    } catch (err: any) {
      logger.error("Error getting report count", {
        error: err.message,
        targetType,
        targetId,
      });
      throw new CustomError(
        grpc.status.INTERNAL,
        "Failed to get report count"
      );
    }
  }
  
  async hasReported(
    targetType: string,
    targetId: string,
    reporterId: string
  ): Promise<boolean> {
    try {
      const report = await this._reportRepository.findReport(
        reporterId,
        targetType as ReportTargetType,
        targetId
      );
      return !!report;
    } catch (err: any) {
      logger.error("Error checking report status", {
        error: err.message,
        targetType,
        targetId,
        reporterId,
      });
      return false;
    }
  }

}