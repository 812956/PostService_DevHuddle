import { Request, Response } from "express";

export interface IAdminController {
  // Reports
  listReports(req: Request, res: Response): Promise<void>;
  getReportById(req: Request, res: Response): Promise<void>;
  takeReportAction(req: Request, res: Response): Promise<void>;
  bulkReportAction(req: Request, res: Response): Promise<void>;

  // Posts
  listPosts(req: Request, res: Response): Promise<void>;
  getPostById(req: Request, res: Response): Promise<void>;
  hidePost(req: Request, res: Response): Promise<void>;
  deletePostAdmin(req: Request, res: Response): Promise<void>;
  listReportedPosts(req: Request, res: Response): Promise<void>;

  // Comments
  listComments(req: Request, res: Response): Promise<void>;
  getCommentById(req: Request, res: Response): Promise<void>;
  deleteCommentAdmin(req: Request, res: Response): Promise<void>;
  listReportedComments(req: Request, res: Response): Promise<void>;

  // Analytics
  getDashboardStats(req: Request, res: Response): Promise<void>;
  getReportsByReason(req: Request, res: Response): Promise<void>;
  getReportsBySeverity(req: Request, res: Response): Promise<void>;

  // User-related admin queries
  getUserReportedContent(req: Request, res: Response): Promise<void>;
  getUserReportsHistory(req: Request, res: Response): Promise<void>;
}

