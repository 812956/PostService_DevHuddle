import { IReportService } from "../interfaces/IReportService";
import { IReportRepository } from "../../repositories/interface/IReportRepository";
import { IPostRepository } from "../../repositories/interface/IPostRepository";
import { ICommentRepository } from "../../repositories/interface/ICommentRepository";
import { IOutboxService } from "../interfaces/IOutboxService";
import { CustomError } from "../../utils/error.util";
import logger from "../../utils/logger.util";
import * as grpc from "@grpc/grpc-js";
import { HttpStatus } from "../../constands/http.status";
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
import { adminServiceClient } from "../../clients/admin.client";

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
      // 1. Rate limiting
      const today = new Date().toISOString().split('T')[0];
      const rateLimitKey = `report:limit:${reporterId}:${today}`;
      const reportCountValue = await redisClient.get(rateLimitKey);
      const reportCount = reportCountValue ? parseInt(reportCountValue) : 0;

      if (reportCount >= 5) {
        throw new CustomError(HttpStatus.BAD_REQUEST, "Daily report limit reached");
      }

      // 2. Local Validation
      const post = await this._postRepository.findPost(postId);
      if (!post) throw new CustomError(HttpStatus.NOT_FOUND, "Post not found");
      if (post.userId === reporterId) throw new CustomError(HttpStatus.FORBIDDEN, "Cannot report own post");

      // 3. Centralized Ingestion: Forward to Admin Hub
      logger.info("Forwarding post report to Admin Hub", { reporterId, postId });
      const adminResponse: any = await adminServiceClient.submitReport({
        reporterId,
        targetId: postId,
        targetType: "POST",
        reason,
        description: description || "",
        metadata: JSON.stringify(metadata || {}),
      });

      if (!adminResponse.success) {
        throw new CustomError(HttpStatus.SERVICE_UNAVAILABLE, adminResponse.message);
      }

      // 4. Local Side-effects: Audit and Counters
      const severity = this.calculateSeverity(reason as ReportReason, post.reportsCount);
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

      await this._postRepository.incrementReportsCount(postId);
      await redisClient.incr(rateLimitKey);
      await redisClient.expire(rateLimitKey, 86400);

      // 5. Local Outbox Event for internal analytics
      await this._outboxService.createOutboxEvent({
        aggregateType: OutboxAggregateType.REPORT,
        aggregateId: report.id,
        type: OutboxEventType.POST_REPORT_CREATED,
        topic: KAFKA_TOPICS.POST_REPORTED,
        key: postId,
        payload: {
          reportId: report.id,
          adminHubReportId: adminResponse.reportId,
          postId,
          reporterId,
          postAuthorId: post.userId,
          reason,
          severity,
          description,
        },
      });

      return report;
    } catch (err: any) {
      logger.error("Error reporting post", { error: err.message, postId });
      if (err instanceof CustomError) throw err;
      throw new CustomError(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to report post");
    }
  }

  async reportComment(
    commentId: string,
    reporterId: string,
    reason: string,
    metadata?: any
  ): Promise<any> {
    try {
      // 1. Local Validation
      const comment = await this._commentRepository.findComment(commentId);
      if (!comment) throw new CustomError(HttpStatus.NOT_FOUND, "Comment not found");
      if (comment.userId === reporterId) throw new CustomError(HttpStatus.FORBIDDEN, "Cannot report own comment");

      // 2. Centralized Ingestion: Forward to Admin Hub
      logger.info("Forwarding comment report to Admin Hub", { reporterId, commentId });
      const adminResponse: any = await adminServiceClient.submitReport({
        reporterId,
        targetId: commentId,
        targetType: "COMMENT",
        reason,
        description: "",
        metadata: JSON.stringify(metadata || {}),
      });

      if (!adminResponse.success) {
        throw new CustomError(HttpStatus.SERVICE_UNAVAILABLE, adminResponse.message);
      }

      // 3. Local Audit and Counters
      const currentCount = (comment.reportsCount || 0) + 1;
      const severity = this.calculateSeverity(reason as ReportReason, currentCount);
      
      const report = await this._reportRepository.createReport({
        reporterId,
        targetType: ReportTargetType.COMMENT,
        targetId: commentId,
        postId: comment.postId,
        commentId,
        reason: reason as ReportReason,
        severity,
        metadata: metadata || {},
        status: ReportStatus.PENDING,
      });

      await this._commentRepository.updateComment(commentId, { reportsCount: currentCount });

      // 4. Local Outbox Event
      await this._outboxService.createOutboxEvent({
        aggregateType: OutboxAggregateType.REPORT,
        aggregateId: report.id,
        type: OutboxEventType.POST_REPORT_CREATED,
        topic: KAFKA_TOPICS.POST_REPORTED,
        key: commentId,
        payload: {
          reportId: report.id,
          adminHubReportId: adminResponse.reportId,
          commentId,
          postId: comment.postId,
          reporterId,
          commentAuthorId: comment.userId,
          reason,
        },
      });

      return report;
    } catch (err: any) {
      logger.error("Error reporting comment", { error: err.message, commentId });
      if (err instanceof CustomError) throw err;
      throw new CustomError(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to report comment");
    }
  }

  private calculateSeverity(reason: ReportReason, count: number): ReportSeverity {
    const criticalReasons: ReportReason[] = [ReportReason.VIOLENCE, ReportReason.SELF_HARM, ReportReason.HATE_SPEECH];
    if (criticalReasons.includes(reason)) {
      return ReportSeverity.CRITICAL;
    }
    if (reason === ReportReason.HARASSMENT || count >= 10) return ReportSeverity.HIGH;
    if (count >= 5) return ReportSeverity.MEDIUM;
    return ReportSeverity.LOW;
  }

  async getReportCount(targetType: string, targetId: string): Promise<number> {
    return this._reportRepository.getReportCount(targetType as ReportTargetType, targetId);
  }
  
  async hasReported(targetType: string, targetId: string, reporterId: string): Promise<boolean> {
    const report = await this._reportRepository.findReport(reporterId, targetType as ReportTargetType, targetId);
    return !!report;
  }
}