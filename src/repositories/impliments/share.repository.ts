import { IShareRepository } from "../interface/IShareRepository";
import { BaseRepository } from "./base.repository";
import { prisma } from "../../config/prisma.config";
import { Share, Prisma, ShareType, TargetType } from ".prisma/client";
import logger from "../../utils/logger.util";
import { v4 as uuidv4 } from "uuid";

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
    visibility?: string;
    targetType?: string;
    targetId?: string;
    sharedToUserId?: string;
  }): Promise<Share> {
    try {
      return await prisma.$transaction(async (tx) => {
        const share = await tx.share.create({
          data: {
            id: uuidv4(),
            postId: data.postId,
            userId: data.userId,
            shareType: data.shareType as ShareType,
            caption: data.caption,
            visibility: (data.visibility as any) || "PUBLIC",
            targetType: (data.targetType as TargetType) || TargetType.USER,
            targetId: data.targetId || data.sharedToUserId,
            sharedToUserId: data.sharedToUserId || data.targetId,
          },
        });

        // Increment share count on post
        await tx.posts.update({
          where: { id: data.postId },
          data: { sharesCount: { increment: 1 } },
        });

        return share;
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

  async hasShared(postId: string, userId: string): Promise<boolean> {
    try {
      const share = await this.findShare(postId, userId);
      return !!share;
    } catch (error: any) {
      logger.error("Error checking if user shared post", { error: error.message });
      return false;
    }
  }

  async getUserSharesForPosts(
    userId: string,
    postIds: string[]
  ): Promise<Record<string, boolean>> {
    try {
      if (!userId || postIds.length === 0) {
        return {};
      }

      const shares = await prisma.share.findMany({
        where: {
          userId,
          postId: {
            in: postIds,
          },
        },
        select: {
          postId: true,
        },
      });

      return shares.reduce<Record<string, boolean>>((acc, share) => {
        if (share.postId) {
          acc[share.postId] = true;
        }
        return acc;
      }, {});
    } catch (error: any) {
      logger.error("Error getting user shares for posts", {
        error: error.message,
        userId,
        postIdsCount: postIds.length,
      });
      throw new Error("Database error");
    }
  }
}
