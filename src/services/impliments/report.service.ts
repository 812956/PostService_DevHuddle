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
} from "@prisma/client";

export class ReportService implements IReportService {
  constructor(
    private reportRepository: IReportRepository,
    private postRepository: IPostRepository,
    private commentRepository: ICommentRepository,
    private outboxService: IOutboxService
  ) {}

  async reportPost(
    postId: string,
    reporterId: string,
    reason: string,
    metadata?: any
  ): Promise<any> {
    try {
      // Validate post exists
      const post = await this.postRepository.findPost(postId);
      if (!post) {
        throw new CustomError(grpc.status.NOT_FOUND, "Post not found");
      }

      // Validate reason
      if (!Object.values(ReportReason).includes(reason as ReportReason)) {
        throw new CustomError(
          grpc.status.INVALID_ARGUMENT,
          "Invalid report reason"
        );
      }

      // Check if already reported
      const existingReport = await this.reportRepository.findReport(
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

      // Create report
      const report = await this.reportRepository.createReport({
        reporterId,
        targetType: ReportTargetType.POST,
        targetId: postId,
        postId,
        reason: reason as ReportReason,
        metadata: metadata || {},
      });

      // Update post reports counter
      await this.postRepository.incrementReportsCount(postId);

      // Create outbox event
      await this.outboxService.createOutboxEvent({
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
          metadata,
        },
      });

      logger.info(`Post ${postId} reported by user ${reporterId}`, {
        reportId: report.id,
        reason,
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
  
  async reportComment(
    commentId: string,
    reporterId: string,
    reason: string,
    metadata?: any
  ): Promise<any> {
    try {
      // Validate comment exists
      const comment = await this.commentRepository.findComment(commentId);
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
      const existingReport = await this.reportRepository.findReport(
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
      const report = await this.reportRepository.createReport({
        reporterId,
        targetType: ReportTargetType.COMMENT,
        targetId: commentId,
        postId: comment.postId, // Required for cascade
        commentId,
        reason: reason as ReportReason,
        metadata: metadata || {},
      });

      // Create outbox event
      await this.outboxService.createOutboxEvent({
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
      return await this.reportRepository.getReportCount(
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
      const report = await this.reportRepository.findReport(
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