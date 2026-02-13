import { IAdminRepository, ListReportsParams, ListReportsResult, ListPostsParams, ListPostsResult, ListCommentsParams, ListCommentsResult, DashboardStats } from "../interface/IAdminRepository";
import { prisma } from "../../config/prisma.config";
import { Report, posts, Comment, ReportStatus, ReportTargetType, ReportSeverity, ReportReason, Prisma } from "@prisma/client";
import logger from "../../utils/logger.util";

export class AdminRepository implements IAdminRepository {
  // ==================== REPORTS ====================

  async listReports(params: ListReportsParams): Promise<ListReportsResult> {
    try {
      const { page, limit, status, targetType, severity, reason, sortBy } = params;
      const skip = (page - 1) * limit;

      const where: Prisma.ReportWhereInput = {};

      if (status && status !== "all") {
        where.status = status as ReportStatus;
      }

      if (targetType && targetType !== "all") {
        where.targetType = targetType as ReportTargetType;
      }

      if (severity && severity !== "all") {
        where.severity = severity as ReportSeverity;
      }

      if (reason && reason !== "all") {
        where.reason = reason as ReportReason;
      }

      const orderBy: Prisma.ReportOrderByWithRelationInput = {};
      if (sortBy === "severity") {
        orderBy.severity = "desc";
      } else if (sortBy === "status") {
        orderBy.status = "asc";
      } else {
        orderBy.createdAt = "desc";
      }

      const [reports, total] = await Promise.all([
        prisma.report.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            posts: true,
            Comment: true,
          },
        }),
        prisma.report.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        reports,
        total,
        totalPages,
      };
    } catch (error: any) {
      logger.error("Error listing reports", { error: error.message });
      throw new Error("Failed to list reports");
    }
  }

  async getReportById(reportId: string): Promise<(Report & { posts?: posts | null; Comment?: Comment | null }) | null> {
    try {
      return await prisma.report.findUnique({
        where: { id: reportId },
        include: {
          posts: {
            include: {
              Media: true,
            },
          },
          Comment: {
            include: {
              posts: {
                select: {
                  id: true,
                  content: true,
                  userId: true,
                },
              },
            },
          },
        },
      });
    } catch (error: any) {
      logger.error("Error getting report by id", { error: error.message });
      throw new Error("Failed to get report");
    }
  }

  async updateReportStatus(
    reportId: string,
    status: string,
    reviewedById: string,
    resolution?: string
  ): Promise<Report> {
    try {
      return await prisma.report.update({
        where: { id: reportId },
        data: {
          status: status as ReportStatus,
          reviewedById,
          reviewedAt: new Date(),
          resolvedAt: status.startsWith("RESOLVED_") ? new Date() : undefined,
          resolution,
        },
      });
    } catch (error: any) {
      logger.error("Error updating report status", { error: error.message });
      throw new Error("Failed to update report status");
    }
  }

  async bulkUpdateReportStatus(
    reportIds: string[],
    status: string,
    reviewedById: string,
    resolution?: string
  ): Promise<number> {
    try {
      const result = await prisma.report.updateMany({
        where: {
          id: { in: reportIds },
        },
        data: {
          status: status as ReportStatus,
          reviewedById,
          reviewedAt: new Date(),
          resolvedAt: status.startsWith("RESOLVED_") ? new Date() : undefined,
          resolution,
        },
      });
      return result.count;
    } catch (error: any) {
      logger.error("Error bulk updating report status", { error: error.message });
      throw new Error("Failed to bulk update report status");
    }
  }

  // ==================== POSTS ====================

  async listPosts(params: ListPostsParams): Promise<ListPostsResult> {
    try {
      const { page, limit, status, userId, search, sortBy } = params;
      const skip = (page - 1) * limit;

      const where: Prisma.postsWhereInput = {};

      if (status === "reported") {
        where.reportsCount = { gt: 0 };
      } else if (status === "hidden") {
        where.isHidden = true;
      } else if (status === "deleted") {
        where.deletedAt = { not: null };
      } else if (status === "active") {
        where.deletedAt = null;
        where.isHidden = false;
      }

      if (userId) {
        where.userId = userId;
      }

      if (search) {
        where.content = { contains: search, mode: "insensitive" };
      }

      const orderBy: Prisma.postsOrderByWithRelationInput = {};
      if (sortBy === "reportsCount") {
        orderBy.reportsCount = "desc";
      } else if (sortBy === "likesCount") {
        orderBy.likesCount = "desc";
      } else {
        orderBy.createdAt = "desc";
      }

      const [posts, total] = await Promise.all([
        prisma.posts.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            Media: true,
          },
        }),
        prisma.posts.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        posts,
        total,
        totalPages,
      };
    } catch (error: any) {
      logger.error("Error listing posts", { error: error.message });
      throw new Error("Failed to list posts");
    }
  }

  async getPostById(postId: string): Promise<posts | null> {
    try {
      return await prisma.posts.findUnique({
        where: { id: postId },
        include: {
          Media: true,
          Report: {
            include: {
              posts: true,
            },
          },
        },
      });
    } catch (error: any) {
      logger.error("Error getting post by id", { error: error.message });
      throw new Error("Failed to get post");
    }
  }

  async hidePost(postId: string, reason: string): Promise<posts> {
    try {
      return await prisma.posts.update({
        where: { id: postId },
        data: {
          isHidden: true,
          hiddenAt: new Date(),
          hiddenReason: reason,
        },
      });
    } catch (error: any) {
      logger.error("Error hiding post", { error: error.message });
      throw new Error("Failed to hide post");
    }
  }

  async unhidePost(postId: string): Promise<posts> {
    try {
      return await prisma.posts.update({
        where: { id: postId },
        data: {
          isHidden: false,
          hiddenAt: null,
          hiddenReason: null,
        },
      });
    } catch (error: any) {
      logger.error("Error unhiding post", { error: error.message });
      throw new Error("Failed to unhide post");
    }
  }

  async deletePostAdmin(postId: string): Promise<posts> {
    try {
      return await prisma.posts.update({
        where: { id: postId },
        data: {
          deletedAt: new Date(),
        },
      });
    } catch (error: any) {
      logger.error("Error deleting post (admin)", { error: error.message });
      throw new Error("Failed to delete post");
    }
  }

  async listReportedPosts(params: ListPostsParams): Promise<ListPostsResult> {
    try {
      const where: Prisma.postsWhereInput = {
        reportsCount: { gt: 0 },
      };

      if (params.userId) {
        where.userId = params.userId;
      }

      if (params.search) {
        where.content = { contains: params.search, mode: "insensitive" };
      }

      const skip = (params.page - 1) * params.limit;

      const [posts, total] = await Promise.all([
        prisma.posts.findMany({
          where,
          skip,
          take: params.limit,
          orderBy: { reportsCount: "desc" },
          include: {
            Media: true,
            Report: {
              take: 5,
              orderBy: { createdAt: "desc" },
            },
          },
        }),
        prisma.posts.count({ where }),
      ]);

      const totalPages = Math.ceil(total / params.limit);

      return {
        posts,
        total,
        totalPages,
      };
    } catch (error: any) {
      logger.error("Error listing reported posts", { error: error.message });
      throw new Error("Failed to list reported posts");
    }
  }

  // ==================== COMMENTS ====================

  async listComments(params: ListCommentsParams): Promise<ListCommentsResult> {
    try {
      const { page, limit, status, postId, userId, search, sortBy } = params;
      const skip = (page - 1) * limit;

      const where: Prisma.CommentWhereInput = {};

      if (status === "reported") {
        where.Report = { some: {} };
      } else if (status === "deleted") {
        where.deletedAt = { not: null };
      } else if (status === "active") {
        where.deletedAt = null;
      }

      if (postId) {
        where.postId = postId;
      }

      if (userId) {
        where.userId = userId;
      }

      if (search) {
        where.content = { contains: search, mode: "insensitive" };
      }

      const orderBy: Prisma.CommentOrderByWithRelationInput = {};
      if (sortBy === "reportsCount") {
        // Note: Comments don't have reportsCount, so we'll sort by createdAt
        orderBy.createdAt = "desc";
      } else {
        orderBy.createdAt = "desc";
      }

      const [comments, total] = await Promise.all([
        prisma.comment.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            posts: {
              select: {
                id: true,
                content: true,
                userId: true,
              },
            },
          },
        }),
        prisma.comment.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        comments,
        total,
        totalPages,
      };
    } catch (error: any) {
      logger.error("Error listing comments", { error: error.message });
      throw new Error("Failed to list comments");
    }
  }

  async getCommentById(commentId: string): Promise<Comment | null> {
    try {
      return await prisma.comment.findUnique({
        where: { id: commentId },
        include: {
          posts: {
            select: {
              id: true,
              content: true,
              userId: true,
            },
          },
          Report: {
            include: {
              Comment: true,
            },
          },
          Comment: {
            select: {
              id: true,
              content: true,
              userId: true,
            },
          },
        },
      });
    } catch (error: any) {
      logger.error("Error getting comment by id", { error: error.message });
      throw new Error("Failed to get comment");
    }
  }

  async deleteCommentAdmin(commentId: string): Promise<Comment> {
    try {
      return await prisma.comment.update({
        where: { id: commentId },
        data: {
          deletedAt: new Date(),
        },
      });
    } catch (error: any) {
      logger.error("Error deleting comment (admin)", { error: error.message });
      throw new Error("Failed to delete comment");
    }
  }

  async listReportedComments(params: ListCommentsParams): Promise<ListCommentsResult> {
    try {
      const where: Prisma.CommentWhereInput = {
        Report: { some: {} },
      };

      if (params.postId) {
        where.postId = params.postId;
      }

      if (params.userId) {
        where.userId = params.userId;
      }

      if (params.search) {
        where.content = { contains: params.search, mode: "insensitive" };
      }

      const skip = (params.page - 1) * params.limit;

      const [comments, total] = await Promise.all([
        prisma.comment.findMany({
          where,
          skip,
          take: params.limit,
          orderBy: { createdAt: "desc" },
          include: {
            posts: {
              select: {
                id: true,
                content: true,
                userId: true,
              },
            },
            Report: {
              take: 5,
              orderBy: { createdAt: "desc" },
            },
          },
        }),
        prisma.comment.count({ where }),
      ]);

      const totalPages = Math.ceil(total / params.limit);

      return {
        comments,
        total,
        totalPages,
      };
    } catch (error: any) {
      logger.error("Error listing reported comments", { error: error.message });
      throw new Error("Failed to list reported comments");
    }
  }

  // ==================== ANALYTICS ====================

  async getDashboardStats(): Promise<DashboardStats> {
    try {
      const now = new Date();
      const todayStart = new Date(now.setHours(0, 0, 0, 0));
      const weekStart = new Date(now.setDate(now.getDate() - 7));
      const monthStart = new Date(now.setDate(now.getDate() - 30));

      // Note: User stats need to come from auth-service, so we'll set placeholders
      // These should be fetched via gRPC or HTTP call to auth-service
      const [
        postsTotal,
        postsReported,
        postsHidden,
        postsDeleted,
        postsToday,
        postsWeek,
        postsMonth,
        commentsTotal,
        commentsReported,
        commentsDeleted,
        commentsToday,
        reportsTotal,
        reportsPending,
        reportsOpen,
        reportsInvestigating,
        reportsResolved,
        reportsCritical,
        reportsHigh,
        reportsToday,
        reportsWeek,
        reactionsTotal,
        sharesTotal,
      ] = await Promise.all([
        prisma.posts.count({ where: { deletedAt: null } }),
        prisma.posts.count({ where: { reportsCount: { gt: 0 } } }),
        prisma.posts.count({ where: { isHidden: true } }),
        prisma.posts.count({ where: { deletedAt: { not: null } } }),
        prisma.posts.count({ where: { createdAt: { gte: todayStart } } }),
        prisma.posts.count({ where: { createdAt: { gte: weekStart } } }),
        prisma.posts.count({ where: { createdAt: { gte: monthStart } } }),
        prisma.comment.count({ where: { deletedAt: null } }),
        prisma.comment.count({ where: { Report: { some: {} } } }),
        prisma.comment.count({ where: { deletedAt: { not: null } } }),
        prisma.comment.count({ where: { createdAt: { gte: todayStart } } }),
        prisma.report.count(),
        prisma.report.count({ where: { status: "PENDING" } }),
        prisma.report.count({ where: { status: "OPEN" } }),
        prisma.report.count({ where: { status: "INVESTIGATING" } }),
        prisma.report.count({ 
          where: { 
            status: { 
              in: ["RESOLVED_APPROVED", "RESOLVED_REMOVED", "RESOLVED_IGNORED"] 
            } 
          } 
        }),
        prisma.report.count({ where: { severity: "CRITICAL" } }),
        prisma.report.count({ where: { severity: "HIGH" } }),
        prisma.report.count({ where: { createdAt: { gte: todayStart } } }),
        prisma.report.count({ where: { createdAt: { gte: weekStart } } }),
        prisma.reaction.count({ where: { deletedAt: null } }),
        prisma.share.count({ where: { deletedAt: null } }),
      ]);

      return {
        users: {
          total: 0, // Will be fetched from auth-service
          active: 0,
          blocked: 0,
          newToday: 0,
          newThisWeek: 0,
          newThisMonth: 0,
        },
        posts: {
          total: postsTotal,
          reported: postsReported,
          hidden: postsHidden,
          deleted: postsDeleted,
          createdToday: postsToday,
          createdThisWeek: postsWeek,
          createdThisMonth: postsMonth,
        },
        comments: {
          total: commentsTotal,
          reported: commentsReported,
          deleted: commentsDeleted,
          createdToday: commentsToday,
        },
        reports: {
          total: reportsTotal,
          pending: reportsPending,
          open: reportsOpen,
          investigating: reportsInvestigating,
          resolved: reportsResolved,
          critical: reportsCritical,
          high: reportsHigh,
          createdToday: reportsToday,
          createdThisWeek: reportsWeek,
        },
        engagement: {
          totalLikes: reactionsTotal,
          totalComments: commentsTotal,
          totalShares: sharesTotal,
        },
      };
    } catch (error: any) {
      logger.error("Error getting dashboard stats", { error: error.message });
      throw new Error("Failed to get dashboard stats");
    }
  }

  async getReportsByReason(): Promise<Record<string, number>> {
    try {
      const reports = await prisma.report.groupBy({
        by: ["reason"],
        _count: {
          id: true,
        },
      });

      return reports.reduce((acc, item) => {
        acc[item.reason] = item._count.id;
        return acc;
      }, {} as Record<string, number>);
    } catch (error: any) {
      logger.error("Error getting reports by reason", { error: error.message });
      throw new Error("Failed to get reports by reason");
    }
  }

  async getReportsBySeverity(): Promise<Record<string, number>> {
    try {
      const reports = await prisma.report.groupBy({
        by: ["severity"],
        _count: {
          id: true,
        },
      });

      return reports.reduce((acc, item) => {
        acc[item.severity] = item._count.id;
        return acc;
      }, {} as Record<string, number>);
    } catch (error: any) {
      logger.error("Error getting reports by severity", { error: error.message });
      throw new Error("Failed to get reports by severity");
    }
  }

  // ==================== USER-RELATED ADMIN QUERIES ====================

  async getUserReportedContent(userId: string): Promise<{ posts: posts[]; comments: Comment[] }> {
    try {
      const [posts, comments] = await Promise.all([
        prisma.posts.findMany({
          where: {
            userId,
            reportsCount: { gt: 0 },
          },
          include: {
            Media: true,
            Report: {
              take: 5,
              orderBy: { createdAt: "desc" },
            },
          },
          orderBy: { reportsCount: "desc" },
          take: 50,
        }),
        prisma.comment.findMany({
          where: {
            userId,
            Report: { some: {} },
          },
          include: {
            posts: {
              select: {
                id: true,
                content: true,
                userId: true,
              },
            },
            Report: {
              take: 5,
              orderBy: { createdAt: "desc" },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
      ]);

      return { posts, comments };
    } catch (error: any) {
      logger.error("Error getting user reported content", { error: error.message });
      throw new Error("Failed to get user reported content");
    }
  }

  async getUserReportsHistory(userId: string): Promise<Report[]> {
    try {
      return await prisma.report.findMany({
        where: {
          reporterId: userId,
        },
        include: {
          posts: {
            select: {
              id: true,
              content: true,
              userId: true,
            },
          },
          Comment: {
            select: {
              id: true,
              content: true,
              userId: true,
              postId: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
    } catch (error: any) {
      logger.error("Error getting user reports history", { error: error.message });
      throw new Error("Failed to get user reports history");
    }
  }
}

