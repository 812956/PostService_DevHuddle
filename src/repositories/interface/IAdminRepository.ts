import { Report, posts, Comment, Prisma } from "@prisma/client";

export interface ListReportsParams {
  page: number;
  limit: number;
  status?: string;
  targetType?: string;
  severity?: string;
  reason?: string;
  sortBy?: string;
}

export interface ListReportsResult {
  reports: (Report & {
    posts?: posts | null;
    Comment?: Comment | null;
  })[];
  total: number;
  totalPages: number;
}

export interface ListPostsParams {
  page: number;
  limit: number;
  status?: string;
  userId?: string;
  search?: string;
  sortBy?: string;
}

export interface ListPostsResult {
  posts: posts[];
  total: number;
  totalPages: number;
}

export interface ListCommentsParams {
  page: number;
  limit: number;
  status?: string;
  postId?: string;
  userId?: string;
  search?: string;
  sortBy?: string;
}

export interface ListCommentsResult {
  comments: Comment[];
  total: number;
  totalPages: number;
}

export interface DashboardStats {
  users: {
    total: number;
    active: number;
    blocked: number;
    newToday: number;
    newThisWeek: number;
    newThisMonth: number;
  };
  posts: {
    total: number;
    reported: number;
    hidden: number;
    deleted: number;
    createdToday: number;
    createdThisWeek: number;
    createdThisMonth: number;
  };
  comments: {
    total: number;
    reported: number;
    deleted: number;
    createdToday: number;
  };
  reports: {
    total: number;
    pending: number;
    open: number;
    investigating: number;
    resolved: number;
    critical: number;
    high: number;
    createdToday: number;
    createdThisWeek: number;
  };
  engagement: {
    totalLikes: number;
    totalComments: number;
    totalShares: number;
  };
}

export interface IAdminRepository {
  // Reports
  listReports(params: ListReportsParams): Promise<ListReportsResult>;
  getReportById(reportId: string): Promise<Report & { posts?: posts | null; Comment?: Comment | null } | null>;
  updateReportStatus(
    reportId: string,
    status: string,
    reviewedById: string,
    resolution?: string
  ): Promise<Report>;
  bulkUpdateReportStatus(
    reportIds: string[],
    status: string,
    reviewedById: string,
    resolution?: string
  ): Promise<number>;

  // Posts
  listPosts(params: ListPostsParams): Promise<ListPostsResult>;
  getPostById(postId: string): Promise<posts | null>;
  hidePost(postId: string, reason: string): Promise<posts>;
  unhidePost(postId: string): Promise<posts>;
  deletePostAdmin(postId: string): Promise<posts>;
  listReportedPosts(params: ListPostsParams): Promise<ListPostsResult>;

  // Comments
  listComments(params: ListCommentsParams): Promise<ListCommentsResult>;
  getCommentById(commentId: string): Promise<Comment | null>;
  deleteCommentAdmin(commentId: string): Promise<Comment>;
  listReportedComments(params: ListCommentsParams): Promise<ListCommentsResult>;

  // Analytics
  getDashboardStats(): Promise<DashboardStats>;
  getReportsByReason(): Promise<Record<string, number>>;
  getReportsBySeverity(): Promise<Record<string, number>>;

  // User-related admin queries
  getUserReportedContent(userId: string): Promise<{ posts: posts[]; comments: Comment[] }>;
  getUserReportsHistory(userId: string): Promise<Report[]>;
}

