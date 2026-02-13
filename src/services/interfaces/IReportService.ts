export interface IReportService {
    reportPost(
      postId: string,
      reporterId: string,
      reason: string,
      metadata?: any,
      description?: string
    ): Promise<any>;
    reportComment(
      commentId: string,
      reporterId: string,
      reason: string,
      metadata?: any
    ): Promise<any>;
    getReportCount(targetType: string, targetId: string): Promise<number>;
    hasReported(
      targetType: string,
      targetId: string,
      reporterId: string
    ): Promise<boolean>;
  }