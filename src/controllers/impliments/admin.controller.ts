import { Request, Response } from "express";
import { IAdminController } from "../interfaces/IAdminController";
import { IAdminService } from "../../services/interfaces/IAdminService";
import { CustomError } from "../../utils/error.util";
import { sendErrorResponse } from "../../utils/error.util";
import { HttpStatus } from "../../constands/http.status";
import logger from "../../utils/logger.util";

export class AdminController implements IAdminController {
  constructor(private _adminService: IAdminService) {}

  // ==================== REPORTS ====================

  async listReports(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const status = req.query.status as string;
      const targetType = req.query.targetType as string;
      const severity = req.query.severity as string;
      const reason = req.query.reason as string;
      const sortBy = req.query.sortBy as string || "createdAt";

      const result = await this._adminService.listReports({
        page,
        limit,
        status,
        targetType,
        severity,
        reason,
        sortBy,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error("Error in listReports controller", { error: error.message });
      sendErrorResponse(
        res,
        error instanceof CustomError
          ? error
          : { status: 500, message: "Failed to list reports" }
      );
    }
  }

  async getReportById(req: Request, res: Response): Promise<void> {
    try {
      const { reportId } = req.params;

      if (!reportId) {
        throw new CustomError(400, "Report ID is required");
      }

      const report = await this._adminService.getReportById(reportId as string);

      res.status(200).json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      logger.error("Error in getReportById controller", { error: error.message });
      sendErrorResponse(
        res,
        error instanceof CustomError
          ? error
          : { status: 500, message: "Failed to get report" }
      );
    }
  }

  async takeReportAction(req: Request, res: Response): Promise<void> {
    try {
      const { reportId } = req.params;
      const { action, resolution, hideContent, suspendUser } = req.body;
      const userId = (req as any).user?.id; // From JWT middleware

      if (!reportId) {
        throw new CustomError(400, "Report ID is required");
      }

      if (!action || !["APPROVE", "REMOVE", "IGNORE"].includes(action)) {
        throw new CustomError(400, "Valid action is required");
      }

      if (!userId) {
        throw new CustomError(HttpStatus.UNAUTHORIZED, "User ID is required");
      }

      const result = await this._adminService.takeReportAction({
        reportId: reportId as string,
        action,
        resolution,
        hideContent: hideContent === true,
        suspendUser: suspendUser === true,
        reviewedById: userId,
      });

      res.status(200).json({
        success: true,
        data: result,
        message: "Report action completed successfully",
      });
    } catch (error: any) {
      logger.error("Error in takeReportAction controller", { error: error.message });
      sendErrorResponse(
        res,
        error instanceof CustomError
          ? error
          : { status: 500, message: "Failed to take action on report" }
      );
    }
  }

  async bulkReportAction(req: Request, res: Response): Promise<void> {
    try {
      const { reportIds, action, resolution } = req.body;
      const userId = (req as any).user?.id; // From JWT middleware

      if (!reportIds || !Array.isArray(reportIds) || reportIds.length === 0) {
        throw new CustomError(400, "Report IDs array is required");
      }

      if (!action || !["APPROVE", "REMOVE", "IGNORE"].includes(action)) {
        throw new CustomError(400, "Valid action is required");
      }

      if (!userId) {
        throw new CustomError(HttpStatus.UNAUTHORIZED, "User ID is required");
      }

      const updatedCount = await this._adminService.bulkReportAction({
        reportIds,
        action,
        resolution,
        reviewedById: userId,
      });

      res.status(200).json({
        success: true,
        data: { updatedCount },
        message: `Successfully updated ${updatedCount} reports`,
      });
    } catch (error: any) {
      logger.error("Error in bulkReportAction controller", { error: error.message });
      sendErrorResponse(
        res,
        error instanceof CustomError
          ? error
          : { status: 500, message: "Failed to perform bulk action" }
      );
    }
  }

  // ==================== POSTS ====================

  async listPosts(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const status = req.query.status as string;
      const userId = req.query.userId as string;
      const search = req.query.search as string;
      const sortBy = req.query.sortBy as string || "createdAt";

      const result = await this._adminService.listPosts({
        page,
        limit,
        status,
        userId,
        search,
        sortBy,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error("Error in listPosts controller", { error: error.message });
      sendErrorResponse(
        res,
        error instanceof CustomError
          ? error
          : { status: 500, message: "Failed to list posts" }
      );
    }
  }

  async getPostById(req: Request, res: Response): Promise<void> {
    try {
      const { postId } = req.params;

      if (!postId) {
        throw new CustomError(400, "Post ID is required");
      }

      const post = await this._adminService.getPostById(postId as string);

      res.status(200).json({
        success: true,
        data: post,
      });
    } catch (error: any) {
      logger.error("Error in getPostById controller", { error: error.message });
      sendErrorResponse(
        res,
        error instanceof CustomError
          ? error
          : { status: 500, message: "Failed to get post" }
      );
    }
  }

  async hidePost(req: Request, res: Response): Promise<void> {
    try {
      const { postId } = req.params;
      const { hidden, reason } = req.body;

      if (!postId) {
        throw new CustomError(400, "Post ID is required");
      }

      if (hidden === undefined) {
        throw new CustomError(400, "Hidden flag is required");
      }

      const post = await this._adminService.hidePost({
        postId: postId as string,
        hidden,
        reason,
      });

      res.status(200).json({
        success: true,
        data: post,
        message: hidden ? "Post hidden successfully" : "Post unhidden successfully",
      });
    } catch (error: any) {
      logger.error("Error in hidePost controller", { error: error.message });
      sendErrorResponse(
        res,
        error instanceof CustomError
          ? error
          : { status: 500, message: "Failed to hide/unhide post" }
      );
    }
  }

  async deletePostAdmin(req: Request, res: Response): Promise<void> {
    try {
      const { postId } = req.params;

      if (!postId) {
        throw new CustomError(400, "Post ID is required");
      }

      const post = await this._adminService.deletePostAdmin(postId as string);

      res.status(200).json({
        success: true,
        data: post,
        message: "Post deleted successfully",
      });
    } catch (error: any) {
      logger.error("Error in deletePostAdmin controller", { error: error.message });
      sendErrorResponse(
        res,
        error instanceof CustomError
          ? error
          : { status: 500, message: "Failed to delete post" }
      );
    }
  }

  async listReportedPosts(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const userId = req.query.userId as string;
      const search = req.query.search as string;

      const result = await this._adminService.listReportedPosts({
        page,
        limit,
        userId,
        search,
        sortBy: "reportsCount",
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error("Error in listReportedPosts controller", { error: error.message });
      sendErrorResponse(
        res,
        error instanceof CustomError
          ? error
          : { status: 500, message: "Failed to list reported posts" }
      );
    }
  }

  // ==================== COMMENTS ====================

  async listComments(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const status = req.query.status as string;
      const postId = req.query.postId as string;
      const userId = req.query.userId as string;
      const search = req.query.search as string;
      const sortBy = req.query.sortBy as string || "createdAt";

      const result = await this._adminService.listComments({
        page,
        limit,
        status,
        postId,
        userId,
        search,
        sortBy,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error("Error in listComments controller", { error: error.message });
      sendErrorResponse(
        res,
        error instanceof CustomError
          ? error
          : { status: 500, message: "Failed to list comments" }
      );
    }
  }

  async getCommentById(req: Request, res: Response): Promise<void> {
    try {
      const { commentId } = req.params;

      if (!commentId) {
        throw new CustomError(400, "Comment ID is required");
      }

      const comment = await this._adminService.getCommentById(commentId as string);

      res.status(200).json({
        success: true,
        data: comment,
      });
    } catch (error: any) {
      logger.error("Error in getCommentById controller", { error: error.message });
      sendErrorResponse(
        res,
        error instanceof CustomError
          ? error
          : { status: 500, message: "Failed to get comment" }
      );
    }
  }

  async deleteCommentAdmin(req: Request, res: Response): Promise<void> {
    try {
      const { commentId } = req.params;

      if (!commentId) {
        throw new CustomError(400, "Comment ID is required");
      }

      const comment = await this._adminService.deleteCommentAdmin(commentId as string);

      res.status(200).json({
        success: true,
        data: comment,
        message: "Comment deleted successfully",
      });
    } catch (error: any) {
      logger.error("Error in deleteCommentAdmin controller", { error: error.message });
      sendErrorResponse(
        res,
        error instanceof CustomError
          ? error
          : { status: 500, message: "Failed to delete comment" }
      );
    }
  }

  async listReportedComments(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const postId = req.query.postId as string;
      const userId = req.query.userId as string;
      const search = req.query.search as string;

      const result = await this._adminService.listReportedComments({
        page,
        limit,
        postId,
        userId,
        search,
        sortBy: "createdAt",
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error("Error in listReportedComments controller", { error: error.message });
      sendErrorResponse(
        res,
        error instanceof CustomError
          ? error
          : { status: 500, message: "Failed to list reported comments" }
      );
    }
  }

  // ==================== ANALYTICS ====================

  async getDashboardStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this._adminService.getDashboardStats();

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      logger.error("Error in getDashboardStats controller", { error: error.message });
      sendErrorResponse(
        res,
        error instanceof CustomError
          ? error
          : { status: 500, message: "Failed to get dashboard stats" }
      );
    }
  }

  async getReportsByReason(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this._adminService.getReportsByReason();

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      logger.error("Error in getReportsByReason controller", { error: error.message });
      sendErrorResponse(
        res,
        error instanceof CustomError
          ? error
          : { status: 500, message: "Failed to get reports by reason" }
      );
    }
  }

  async getReportsBySeverity(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this._adminService.getReportsBySeverity();

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      logger.error("Error in getReportsBySeverity controller", { error: error.message });
      sendErrorResponse(
        res,
        error instanceof CustomError
          ? error
          : { status: 500, message: "Failed to get reports by severity" }
      );
    }
  }

  // ==================== USER-RELATED ADMIN QUERIES ====================

  async getUserReportedContent(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      if (!userId) {
        throw new CustomError(HttpStatus.BAD_REQUEST, "User ID is required");
      }

      const result = await this._adminService.getUserReportedContent(userId as string);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error("Error in getUserReportedContent controller", { error: error.message });
      sendErrorResponse(
        res,
        error instanceof CustomError
          ? error
          : { status: 500, message: "Failed to get user reported content" }
      );
    }
  }

  async getUserReportsHistory(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      if (!userId) {
        throw new CustomError(HttpStatus.BAD_REQUEST, "User ID is required");
      }

      const reports = await this._adminService.getUserReportsHistory(userId as string);

      res.status(200).json({
        success: true,
        data: reports,
      });
    } catch (error: any) {
      logger.error("Error in getUserReportsHistory controller", { error: error.message });
      sendErrorResponse(
        res,
        error instanceof CustomError
          ? error
          : { status: 500, message: "Failed to get user reports history" }
      );
    }
  }
}

