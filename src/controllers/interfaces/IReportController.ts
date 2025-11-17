import { Request, Response, NextFunction } from "express";

export interface IReportController {
  reportPost(req: Request, res: Response, next: NextFunction): Promise<void>;
  reportComment(req: Request, res: Response, next: NextFunction): Promise<void>;
  getReportCount(req: Request, res: Response, next: NextFunction): Promise<void>;
  hasReported(req: Request, res: Response, next: NextFunction): Promise<void>;
}