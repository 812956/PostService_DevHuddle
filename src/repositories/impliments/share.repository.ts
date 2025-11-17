import { IShareRepository } from "../interface/IShareRepository";
import { BaseRepository } from "./base.repository";
import { prisma } from "../../config/prisma.config";
import { Share, Prisma, ShareType, TargetType } from ".prisma/client";
import logger from "../../utils/logger.util";

export class ShareRepository
  extends BaseRepository<
    typeof prisma.share,
    Share,
    Prisma.ShareCreateInput,
    Prisma.ShareUpdateInput,
    Prisma.ShareWhereUniqueInput
  >
  implements IShareRepository
{
  constructor() {
    super(prisma.share);
  }

  async createShare(data: {
    postId: string;
    userId: string;
    shareType: string;
    caption?: string;
    targetType?: string;
    targetId?: string;
  }): Promise<Share> {
    try {
      return await super.create({
        ...data,
        shareType: data.shareType as ShareType,
        targetType: data.targetType as TargetType,
      });
    } catch (error: any) {
      logger.error("Error creating share", { error: error.message });
      throw new Error("Failed to create share");
    }
  }

  async findShare(postId: string, userId: string): Promise<Share | null> {
    try {
      return await super.findOne({ postId, userId });
    } catch (error: any) {
      logger.error("Error finding share", { error: error.message });
      throw new Error("Failed to find share");
    }
  }

  async getSharesByPost(postId: string, limit: number = 20): Promise<Share[]> {
    try {
      return await prisma.share.findMany({
        where: { postId },
        take: limit,
        orderBy: { createdAt: "desc" },
      });
    } catch (error: any) {
      logger.error("Error getting shares by post", { error: error.message });
      throw new Error("Failed to get shares by post");
    }
  }

  async getShareCount(postId: string): Promise<number> {
    try {
      return await prisma.share.count({ where: { postId } });
    } catch (error: any) {
      logger.error("Error getting share count", { error: error.message });
      throw new Error("Failed to get share count");
    }
  }
}
