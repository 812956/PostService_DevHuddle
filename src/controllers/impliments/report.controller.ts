import { Request, Response, NextFunction } from "express";
import { IReportService } from "../../services/interfaces/IReportService";
import { CustomError } from "../../utils/error.util";
import logger from "../../utils/logger.util";
import { ReportReason } from "@prisma/client";
import { IReportController } from "../interfaces/IReportController";
import { HttpStatus } from "../../constands/http.status";
import { getUserIdFromRequest } from "../../utils/request.util";

export class ReportController implements IReportController {
  constructor(private _reportService: IReportService) {}

  async reportPost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { postId } = req.params;
      const { reason, metadata, description } = req.body;
      
      // ✅ FIX: Use getUserIdFromRequest to extract userId from x-user-data header
      const reporterId = getUserIdFromRequest(req);

      if (!postId) {
        throw new CustomError(HttpStatus.BAD_REQUEST, "Post ID is required");
      }

      // Validation handled by DTO

      const report = await this._reportService.reportPost(
        postId as string,
        reporterId,
        reason,
        metadata,
        description
      );

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
      
      // ✅ FIX: Use getUserIdFromRequest to extract userId from x-user-data header
      const reporterId = getUserIdFromRequest(req);

      if (!commentId) {
        throw new CustomError(HttpStatus.BAD_REQUEST, "Comment ID is required");
      }

      // Validation handled by DTO

      const report = await this._reportService.reportComment(commentId as string, reporterId, reason, metadata);

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

      const count = await this._reportService.getReportCount(targetType as string, targetId as string);

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
      
      // ✅ FIX: Use getUserIdFromRequest to extract userId from x-user-data header
      const reporterId = getUserIdFromRequest(req);

      if (!targetType || !targetId) {
        throw new CustomError(HttpStatus.BAD_REQUEST, "Target type and target ID are required");
      }

      const hasReported = await this._reportService.hasReported(
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