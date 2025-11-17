import { ILikeRepository, CreateLikeData } from "../interface/ILikeRepository";
import { BaseRepository } from "./base.repository";
import { prisma } from "../../config/prisma.config";
import { Reaction, Prisma, ReactionTargetType } from ".prisma/client";
import logger from "../../utils/logger.util";

export class LikeRepository
  extends BaseRepository<
    typeof prisma.reaction,
    Reaction,
    Prisma.ReactionCreateInput,
    Prisma.ReactionUpdateInput,
    Prisma.ReactionWhereUniqueInput
  >
  implements ILikeRepository
{
  constructor() {
    super(prisma.reaction);
  }

  async createLike(data: CreateLikeData): Promise<Reaction> {
    try {
      // Validate that exactly one target is provided
      if (!data.postId && !data.commentId) {
        throw new Error("Either postId or commentId must be provided");
      }
      if (data.postId && data.commentId) {
        throw new Error("Cannot provide both postId and commentId");
      }

      return await prisma.reaction.create({
        data: {
          postId: data.postId,
          commentId: data.commentId,
          userId: data.userId,
          type: (data.type as any) || "LIKE",
          targetType: data.targetType,
        },
      });
    } catch (error: any) {
      logger.error("Error creating like", { error: error.message, data });
      throw new Error("Database error");
    }
  }

  async deleteLike(
    targetType: ReactionTargetType,
    targetId: string,
    userId: string
  ): Promise<void> {
    try {
      const whereClause: any = {
        userId,
        type: "LIKE",
        deletedAt: null,
      };

      if (targetType === ReactionTargetType.POST) {
        whereClause.postId = targetId;
      }
      if (targetType === ReactionTargetType.COMMENT) {
        whereClause.commentId = targetId;
      }

      await prisma.reaction.updateMany({
        where: whereClause,
        data: {
          deletedAt: new Date(),
        },
      });
    } catch (error: any) {
      logger.error("Error deleting like", {
        error: error.message,
        targetType,
        targetId,
        userId,
      });
      throw new Error("Database error");
    }
  }

  async findLike(
    targetType: ReactionTargetType,
    targetId: string,
    userId: string
  ): Promise<Reaction | null> {
    try {
      const whereClause: any = {
        userId,
        type: "LIKE",
        deletedAt: null,
      };

      if (targetType === ReactionTargetType.POST) {
        whereClause.postId = targetId;
      }
      if (targetType === ReactionTargetType.COMMENT) {
        whereClause.commentId = targetId;
      }

      return await prisma.reaction.findFirst({
        where: whereClause,
      });
    } catch (error: any) {
      logger.error("Error finding like", {
        error: error.message,
        targetType,
        targetId,
        userId,
      });
      throw new Error("Database error");
    }
  }

  async getLikes(
    targetType: ReactionTargetType,
    targetId: string,
    limit: number = 50
  ): Promise<Reaction[]> {
    try {
      const whereClause: any = {
        type: "LIKE",
        deletedAt: null,
      };

      if (targetType === "POST") {
        whereClause.postId = targetId;
      } else {
        whereClause.commentId = targetId;
      }

      return await prisma.reaction.findMany({
        where: whereClause,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
      });
    } catch (error: any) {
      logger.error("Error getting likes", {
        error: error.message,
        targetType,
        targetId,
      });
      throw new Error("Database error");
    }
  }

  async getLikeCount(
    targetType: ReactionTargetType,
    targetId: string
  ): Promise<number> {
    try {
      const whereClause: any = {
        type: "LIKE",
        deletedAt: null,
      };

      if (targetType === ReactionTargetType.POST) {
        whereClause.postId = targetId;
      }
      if (targetType === ReactionTargetType.COMMENT) {
        whereClause.commentId = targetId;
      }

      return await prisma.reaction.count({
        where: whereClause,
      });
    } catch (error: any) {
      logger.error("Error getting like count", {
        error: error.message,
        targetType,
        targetId,
      });
      throw new Error("Database error");
    }
  }
}
