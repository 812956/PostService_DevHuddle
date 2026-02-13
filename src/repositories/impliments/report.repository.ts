import { IReportRepository } from "../interface/IReportRepository";
import { BaseRepository } from "./base.repository";
import { prisma } from "../../config/prisma.config";
import {
  Report,
  Prisma,
  ReportTargetType,
  ReportStatus,
  ReportReason,
  ReportSeverity,
} from ".prisma/client";
import logger from "../../utils/logger.util";
import { v4 as uuidv4 } from "uuid";

export class ReportRepository
  extends BaseRepository<
    typeof prisma.report,
    Report,
    Prisma.ReportCreateInput,
    Prisma.ReportUpdateInput,
    Prisma.ReportWhereUniqueInput
  >
  implements IReportRepository
{
  constructor() {
    super(prisma.report);
  }

  async createReport(data: {
    reporterId: string;
    targetType: string;
    targetId: string;
    postId?: string;
    commentId?: string;
    reason: string;
    severity?: string;
    description?: string;
    status?: string;
    metadata?: any;
  }): Promise<Report> {
    try {
      // Generate unique ID for the report
      const reportId = uuidv4();
      
      const createData: any = {
        id: reportId,
        reporterId: data.reporterId,
        targetType: data.targetType as ReportTargetType,
        targetId: data.targetId,
        reason: data.reason as ReportReason,
        severity: (data.severity as ReportSeverity) || ReportSeverity.LOW,
        description: data.description,
        status: (data.status as ReportStatus) || ReportStatus.PENDING,
        metadata: data.metadata,
      };

      // Use relation syntax for optional foreign keys
      if (data.postId) {
        createData.posts = { connect: { id: data.postId } };
      }
      if (data.commentId) {
        createData.Comment = { connect: { id: data.commentId } };
      }

      return await super.create(createData);
    } catch (error: any) {
      logger.error("Error creating report", { error: error.message });
      throw new Error("Failed to create report");
    }
  }

  async findReport(
    reporterId: string,
    targetType: ReportTargetType,
    targetId: string
  ): Promise<Report | null> {
    try {
      return await this.model.findUnique({
        where: {
          reporterId_targetType_targetId: {
            reporterId,
            targetType,
            targetId,
          },
        },
      });
    } catch (error: any) {
      // If unique constraint doesn't exist, fallback to findFirst
      return await this.model.findFirst({
        where: {
          reporterId,
          targetType,
          targetId,
        },
      });
    }
  }

  async getReportsByTarget(
    targetType: ReportTargetType,
    targetId: string
  ): Promise<Report[]> {
    try {
      return await this.model.findMany({
        where: {
          targetType,
          targetId,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    } catch (error: any) {
      logger.error("Error getting reports by target", { error: error.message });
      throw new Error("Failed to get reports by target");
    }
  }

  async updateReportStatus(
    reportId: string,
    status: ReportStatus | string,
    resolvedAt?: Date,
    reviewedById?: string,
    resolution?: string
  ): Promise<Report> {
    try {
      const updateData: any = {
        status: status as ReportStatus,
      };
      
      if (resolvedAt) {
        updateData.resolvedAt = resolvedAt;
      }
      
      if (reviewedById) {
        updateData.reviewedById = reviewedById;
        updateData.reviewedAt = new Date();
      }
      
      if (resolution) {
        updateData.resolution = resolution;
      }
      
      return await super.update(reportId, updateData);
    } catch (error: any) {
      logger.error("Error updating report status", { error: error.message });
      throw new Error("Failed to update report status");
    }
  }

  async getReportCount(targetType: ReportTargetType, targetId: string): Promise<number> {
    try {
      return await this.model.count({
        where: { targetType, targetId },
      });
    } catch (error: any) {
      logger.error("Error getting report count", { error: error.message });
      throw new Error("Failed to get report count");
    }
  }
}
