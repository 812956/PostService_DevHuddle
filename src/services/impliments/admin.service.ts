import { IAdminService, TakeReportActionParams, BulkReportActionParams, HidePostParams } from "../interfaces/IAdminService";
import { IAdminRepository, ListReportsParams, ListReportsResult, ListPostsParams, ListPostsResult, ListCommentsParams, ListCommentsResult, DashboardStats } from "../../repositories/interface/IAdminRepository";
import { ReportStatus, ReportTargetType } from "@prisma/client";
import { IPostRepository } from "../../repositories/interface/IPostRepository";
import { ICommentRepository } from "../../repositories/interface/ICommentRepository";
import { CustomError } from "../../utils/error.util";
import logger from "../../utils/logger.util";

export class AdminService implements IAdminService {
  constructor(
    private _adminRepository: IAdminRepository,
    private _postRepository: IPostRepository,
    private _commentRepository: ICommentRepository
  ) {}

  // ==================== REPORTS ====================

  async listReports(params: ListReportsParams): Promise<ListReportsResult> {
    try {
      return await this._adminRepository.listReports(params);
    } catch (error: any) {
      logger.error("Error in listReports service", { error: error.message });
      throw new CustomError(500, "Failed to list reports");
    }
  }

  async getReportById(reportId: string) {
    try {
      const report = await this._adminRepository.getReportById(reportId);
      if (!report) {
        throw new CustomError(404, "Report not found");
      }
      return report;
    } catch (error: any) {
      if (error instanceof CustomError) throw error;
      logger.error("Error in getReportById service", { error: error.message });
      throw new CustomError(500, "Failed to get report");
    }
  }

  async takeReportAction(params: TakeReportActionParams) {
    try {
      const { reportId, action, resolution, hideContent, suspendUser, reviewedById } = params;

      // Get the report first
      const report = await this._adminRepository.getReportById(reportId);
      if (!report) {
        throw new CustomError(404, "Report not found");
      }

      // Determine the new status based on action
      let newStatus: ReportStatus;
      if (action === "APPROVE") {
        newStatus = ReportStatus.RESOLVED_APPROVED;
      } else if (action === "REMOVE") {
        newStatus = ReportStatus.RESOLVED_REMOVED;
      } else {
        newStatus = ReportStatus.RESOLVED_IGNORED;
      }

      // Update report status
      const updatedReport = await this._adminRepository.updateReportStatus(
        reportId,
        newStatus,
        reviewedById,
        resolution
      );

      let updatedPost;
      let updatedComment;

      // Handle content hiding/deletion
      if (hideContent && action === "REMOVE") {
        if (report.targetType === ReportTargetType.POST && report.postId) {
          // Hide the post
          updatedPost = await this._adminRepository.hidePost(
            report.postId,
            resolution || "Removed due to report"
          );
        } else if (report.targetType === ReportTargetType.COMMENT && report.commentId) {
          // Delete the comment (comments don't have isHidden, so we delete)
          updatedComment = await this._adminRepository.deleteCommentAdmin(report.commentId);
          
          // Decrement post comments count
          if (report.postId) {
            await this._postRepository.decrementCommentsCount(report.postId);
          }
        }
      }

      // Note: suspendUser would require calling auth-service
      // This should be done via HTTP call or gRPC to auth-service
      // For now, we'll log it
      if (suspendUser) {
        logger.info("User suspension requested", {
          userId: report.targetType === ReportTargetType.POST 
            ? report.posts?.userId 
            : report.Comment?.userId,
          reportId,
        });
        // TODO: Call auth-service to suspend user
      }

      return {
        report: updatedReport,
        post: updatedPost,
        comment: updatedComment,
      };
    } catch (error: any) {
      if (error instanceof CustomError) throw error;
      logger.error("Error in takeReportAction service", { error: error.message });
      throw new CustomError(500, "Failed to take action on report");
    }
  }

  async bulkReportAction(params: BulkReportActionParams): Promise<number> {
    try {
      const { reportIds, action, resolution, reviewedById } = params;

      // Determine the new status
      let newStatus: ReportStatus;
      if (action === "APPROVE") {
        newStatus = ReportStatus.RESOLVED_APPROVED;
      } else if (action === "REMOVE") {
        newStatus = ReportStatus.RESOLVED_REMOVED;
      } else {
        newStatus = ReportStatus.RESOLVED_IGNORED;
      }

      const updatedCount = await this._adminRepository.bulkUpdateReportStatus(
        reportIds,
        newStatus,
        reviewedById,
        resolution
      );

      return updatedCount;
    } catch (error: any) {
      logger.error("Error in bulkReportAction service", { error: error.message });
      throw new CustomError(500, "Failed to perform bulk action");
    }
  }

  // ==================== POSTS ====================

  async listPosts(params: ListPostsParams): Promise<ListPostsResult> {
    try {
      return await this._adminRepository.listPosts(params);
    } catch (error: any) {
      logger.error("Error in listPosts service", { error: error.message });
      throw new CustomError(500, "Failed to list posts");
    }
  }

  async getPostById(postId: string) {
    try {
      const post = await this._adminRepository.getPostById(postId);
      if (!post) {
        throw new CustomError(404, "Post not found");
      }
      return post;
    } catch (error: any) {
      if (error instanceof CustomError) throw error;
      logger.error("Error in getPostById service", { error: error.message });
      throw new CustomError(500, "Failed to get post");
    }
  }

  async hidePost(params: HidePostParams) {
    try {
      const { postId, hidden, reason } = params;

      if (hidden) {
        if (!reason) {
          throw new CustomError(400, "Reason is required when hiding a post");
        }
        return await this._adminRepository.hidePost(postId, reason);
      } else {
        return await this._adminRepository.unhidePost(postId);
      }
    } catch (error: any) {
      if (error instanceof CustomError) throw error;
      logger.error("Error in hidePost service", { error: error.message });
      throw new CustomError(500, "Failed to hide/unhide post");
    }
  }

  async deletePostAdmin(postId: string) {
    try {
      const post = await this._adminRepository.getPostById(postId);
      if (!post) {
        throw new CustomError(404, "Post not found");
      }

      return await this._adminRepository.deletePostAdmin(postId);
    } catch (error: any) {
      if (error instanceof CustomError) throw error;
      logger.error("Error in deletePostAdmin service", { error: error.message });
      throw new CustomError(500, "Failed to delete post");
    }
  }

  async listReportedPosts(params: ListPostsParams): Promise<ListPostsResult> {
    try {
      return await this._adminRepository.listReportedPosts(params);
    } catch (error: any) {
      logger.error("Error in listReportedPosts service", { error: error.message });
      throw new CustomError(500, "Failed to list reported posts");
    }
  }

  // ==================== COMMENTS ====================

  async listComments(params: ListCommentsParams): Promise<ListCommentsResult> {
    try {
      return await this._adminRepository.listComments(params);
    } catch (error: any) {
      logger.error("Error in listComments service", { error: error.message });
      throw new CustomError(500, "Failed to list comments");
    }
  }

  async getCommentById(commentId: string) {
    try {
      const comment = await this._adminRepository.getCommentById(commentId);
      if (!comment) {
        throw new CustomError(404, "Comment not found");
      }
      return comment;
    } catch (error: any) {
      if (error instanceof CustomError) throw error;
      logger.error("Error in getCommentById service", { error: error.message });
      throw new CustomError(500, "Failed to get comment");
    }
  }

  async deleteCommentAdmin(commentId: string) {
    try {
      const comment = await this._adminRepository.getCommentById(commentId);
      if (!comment) {
        throw new CustomError(404, "Comment not found");
      }

      const deletedComment = await this._adminRepository.deleteCommentAdmin(commentId);
      
      // Decrement post comments count
      await this._postRepository.decrementCommentsCount(comment.postId);

      return deletedComment;
    } catch (error: any) {
      if (error instanceof CustomError) throw error;
      logger.error("Error in deleteCommentAdmin service", { error: error.message });
      throw new CustomError(500, "Failed to delete comment");
    }
  }

  async listReportedComments(params: ListCommentsParams): Promise<ListCommentsResult> {
    try {
      return await this._adminRepository.listReportedComments(params);
    } catch (error: any) {
      logger.error("Error in listReportedComments service", { error: error.message });
      throw new CustomError(500, "Failed to list reported comments");
    }
  }

  // ==================== ANALYTICS ====================

  async getDashboardStats(): Promise<DashboardStats> {
    try {
      return await this._adminRepository.getDashboardStats();
    } catch (error: any) {
      logger.error("Error in getDashboardStats service", { error: error.message });
      throw new CustomError(500, "Failed to get dashboard stats");
    }
  }

  async getReportsByReason(): Promise<Record<string, number>> {
    try {
      return await this._adminRepository.getReportsByReason();
    } catch (error: any) {
      logger.error("Error in getReportsByReason service", { error: error.message });
      throw new CustomError(500, "Failed to get reports by reason");
    }
  }

  async getReportsBySeverity(): Promise<Record<string, number>> {
    try {
      return await this._adminRepository.getReportsBySeverity();
    } catch (error: any) {
      logger.error("Error in getReportsBySeverity service", { error: error.message });
      throw new CustomError(500, "Failed to get reports by severity");
    }
  }

  // ==================== USER-RELATED ADMIN QUERIES ====================

  async getUserReportedContent(userId: string) {
    try {
      return await this._adminRepository.getUserReportedContent(userId);
    } catch (error: any) {
      logger.error("Error in getUserReportedContent service", { error: error.message });
      throw new CustomError(500, "Failed to get user reported content");
    }
  }

  async getUserReportsHistory(userId: string) {
    try {
      return await this._adminRepository.getUserReportsHistory(userId);
    } catch (error: any) {
      logger.error("Error in getUserReportsHistory service", { error: error.message });
      throw new CustomError(500, "Failed to get user reports history");
    }
  }
}

