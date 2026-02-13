import { ILikeRepository, CreateLikeData } from "../interface/ILikeRepository";
import { BaseRepository } from "./base.repository";
import { prisma } from "../../config/prisma.config";
import { Reaction, Prisma, ReactionTargetType } from ".prisma/client";
import logger from "../../utils/logger.util";
import { v4 as uuidv4 } from "uuid";

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

      // Generate unique ID for the reaction
      const reactionId = uuidv4();
      
      // Build data object conditionally to satisfy TypeScript
      const reactionData: any = {
        id: reactionId,
        userId: data.userId,
        type: (data.type as any) || "LIKE",
        targetType: data.targetType,
      };
      
      if (data.postId) {
        reactionData.postId = data.postId;
      }
      if (data.commentId) {
        reactionData.commentId = data.commentId;
      }

      return await prisma.reaction.create({
        data: reactionData as any, // Type assertion to handle conditional fields
      });
    } catch (error: any) {
      logger.error("Error creating like", { 
        error: error.message, 
        errorCode: error.code,
        errorMeta: error.meta,
        data 
      });
      // Check for unique constraint violation
      if (error.code === 'P2002') {
        throw new Error("Like already exists");
      }
      throw new Error(`Database error: ${error.message}`);
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

  async findSoftDeletedLike(
    targetType: ReactionTargetType,
    targetId: string,
    userId: string
  ): Promise<Reaction | null> {
    try {
      const whereClause: any = {
        userId,
        type: "LIKE",
        deletedAt: { not: null }, // Only soft-deleted likes
      };

      if (targetType === ReactionTargetType.POST) {
        whereClause.postId = targetId;
      }
      if (targetType === ReactionTargetType.COMMENT) {
        whereClause.commentId = targetId;
      }

      return await prisma.reaction.findFirst({
        where: whereClause,
        orderBy: { deletedAt: "desc" }, // Get the most recently deleted one
      });
    } catch (error: any) {
      logger.error("Error finding soft-deleted like", {
        error: error.message,
        targetType,
        targetId,
        userId,
      });
      throw new Error("Database error");
    }
  }

  async restoreLike(likeId: string): Promise<Reaction> {
    try {
      return await prisma.reaction.update({
        where: { id: likeId },
        data: {
          deletedAt: null,
          createdAt: new Date(), // Update timestamp to reflect restoration
        },
      });
    } catch (error: any) {
      logger.error("Error restoring like", {
        error: error.message,
        likeId,
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

  async getUserLikesForPosts(
    userId: string,
    postIds: string[]
  ): Promise<Record<string, boolean>> {
    try {
      if (!userId || postIds.length === 0) {
        return {};
      }

      const likes = await prisma.reaction.findMany({
        where: {
          userId,
          type: "LIKE",
          deletedAt: null,
          targetType: ReactionTargetType.POST,
          postId: {
            in: postIds,
          },
        },
        select: {
          postId: true,
        },
      });

      return likes.reduce<Record<string, boolean>>((acc, like) => {
        if (like.postId) {
          acc[like.postId] = true;
        }
        return acc;
      }, {});
    } catch (error: any) {
      logger.error("Error getting user likes for posts", {
        error: error.message,
        userId,
        postIdsCount: postIds.length,
      });
      throw new Error("Database error");
    }
  }

  async getUserLikesForComments(
    userId: string,
    commentIds: string[]
  ): Promise<Record<string, boolean>> {
    try {
      if (!userId || commentIds.length === 0) {
        return {};
      }

      const likes = await prisma.reaction.findMany({
        where: {
          userId,
          type: "LIKE",
          deletedAt: null,
          targetType: ReactionTargetType.COMMENT,
          commentId: {
            in: commentIds,
          },
        },
        select: {
          commentId: true,
        },
      });

      return likes.reduce<Record<string, boolean>>((acc, like) => {
        if (like.commentId) {
          acc[like.commentId] = true;
        }
        return acc;
      }, {});
    } catch (error: any) {
      logger.error("Error getting user likes for comments", {
        error: error.message,
        userId,
        commentIdsCount: commentIds.length,
      });
      throw new Error("Database error");
    }
  }
}
