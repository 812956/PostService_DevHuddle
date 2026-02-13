import { IAdminRepository, ListReportsParams, ListReportsResult, ListPostsParams, ListPostsResult, ListCommentsParams, ListCommentsResult, DashboardStats } from "../../repositories/interface/IAdminRepository";
import { Report, posts, Comment } from "@prisma/client";

export interface TakeReportActionParams {
  reportId: string;
  action: "APPROVE" | "REMOVE" | "IGNORE";
  resolution?: string;
  hideContent?: boolean;
  suspendUser?: boolean;
  reviewedById: string;
}

export interface BulkReportActionParams {
  reportIds: string[];
  action: "APPROVE" | "REMOVE" | "IGNORE";
  resolution?: string;
  reviewedById: string;
}

export interface HidePostParams {
  postId: string;
  hidden: boolean;
  reason?: string;
}

export interface IAdminService {
  // Reports
  listReports(params: ListReportsParams): Promise<ListReportsResult>;
  getReportById(reportId: string): Promise<(Report & { posts?: posts | null; Comment?: Comment | null }) | null>;
  takeReportAction(params: TakeReportActionParams): Promise<{ report: Report; post?: posts; comment?: Comment }>;
  bulkReportAction(params: BulkReportActionParams): Promise<number>;

  // Posts
  listPosts(params: ListPostsParams): Promise<ListPostsResult>;
  getPostById(postId: string): Promise<posts | null>;
  hidePost(params: HidePostParams): Promise<posts>;
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

