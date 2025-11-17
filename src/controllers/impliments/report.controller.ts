import { Request, Response, NextFunction } from "express";
import { IReportService } from "../../services/interfaces/IReportService";
import { CustomError } from "../../utils/error.util";
import logger from "../../utils/logger.util";
import { ReportReason } from "@prisma/client";
import { IReportController } from "../interfaces/IReportController";
import { HttpStatus } from "../../constands/http.status";

export class ReportController implements IReportController {
  constructor(private reportService: IReportService) {}

  async reportPost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { postId } = req.params;
      const { reason, metadata } = req.body;
      const reporterId = (req as any).user?.userId || (req as any).user?.id;

      if (!reporterId) {
        throw new CustomError(HttpStatus.UNAUTHORIZED, "Unauthorized");
      }

      if (!postId) {
        throw new CustomError(HttpStatus.BAD_REQUEST, "Post ID is required");
      }

      if (!reason || !Object.values(ReportReason).includes(reason)) {
        throw new CustomError(HttpStatus.BAD_REQUEST, "Valid report reason is required");
      }

      const report = await this.reportService.reportPost(postId, reporterId, reason, metadata);

      res.status(HttpStatus.CREATED).json({
        success: true,
        message: "Post reported successfully",
        data: report,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async reportComment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { commentId } = req.params;
      const { reason, metadata } = req.body;
      const reporterId = (req as any).user?.userId || (req as any).user?.id;

      if (!reporterId) {
        throw new CustomError(HttpStatus.UNAUTHORIZED, "Unauthorized");
      }

      if (!commentId) {
        throw new CustomError(HttpStatus.BAD_REQUEST, "Comment ID is required");
      }

      if (!reason || !Object.values(ReportReason).includes(reason)) {
        throw new CustomError(HttpStatus.BAD_REQUEST, "Valid report reason is required");
      }

      const report = await this.reportService.reportComment(commentId, reporterId, reason, metadata);

      res.status(HttpStatus.CREATED).json({
        success: true,
        message: "Comment reported successfully",
        data: report,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async getReportCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { targetType, targetId } = req.query;

      if (!targetType || !targetId) {
        throw new CustomError(HttpStatus.BAD_REQUEST, "Target type and target ID are required");
      }

      const count = await this.reportService.getReportCount(targetType as string, targetId as string);

      res.status(HttpStatus.OK).json({
        success: true,
        count,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async hasReported(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { targetType, targetId } = req.query;
      const reporterId = (req as any).user?.userId || (req as any).user?.id;

      if (!reporterId) {
        throw new CustomError(HttpStatus.UNAUTHORIZED, "Unauthorized");
      }

      if (!targetType || !targetId) {
        throw new CustomError(HttpStatus.BAD_REQUEST, "Target type and target ID are required");
      }

      const hasReported = await this.reportService.hasReported(
        targetType as string,
        targetId as string,
        reporterId
      );

      res.status(HttpStatus.OK).json({
        success: true,
        hasReported,
      });
    } catch (error: any) {
      next(error);
    }
  }
}