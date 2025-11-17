import { Report, Prisma } from ".prisma/client";

export interface IReportRepository {
  createReport(data: {
    reporterId: string;
    targetType: string;
    targetId: string;
    postId?: string;
    commentId?: string;
    reason: string;
    metadata?: any;
  }): Promise<Report>;
  findReport(reporterId: string, targetType: string, targetId: string): Promise<Report | null>;
  getReportsByTarget(targetType: string, targetId: string): Promise<Report[]>;
  updateReportStatus(reportId: string, status: string, resolvedAt?: Date): Promise<Report>;
  getReportCount(targetType: string, targetId: string): Promise<number>;
}