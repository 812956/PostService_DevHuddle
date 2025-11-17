import { IReportRepository } from "../interface/IReportRepository";
import { BaseRepository } from "./base.repository";
import { prisma } from "../../config/prisma.config";
import {
  Report,
  Prisma,
  ReportTargetType,
  ReportStatus,
  ReportReason,
} from ".prisma/client";
import logger from "../../utils/logger.util";

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
    targetType: ReportTargetType;
    targetId: string;
    postId?: string;
    commentId?: string;
    reason: ReportReason;
    metadata?: any;
  }): Promise<Report> {
    try {
      return await super.create(data);
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
    status: ReportStatus,
    resolvedAt: Date = new Date()
  ): Promise<Report> {
    try {
      return await super.update(reportId, { status, resolvedAt });
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
