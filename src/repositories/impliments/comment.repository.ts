import {
  ICommentRepository,
  CommentSelectOptions,
} from "../interface/ICommentRepository";
import { BaseRepository } from "./base.repository";
import { prisma } from "../../config/prisma.config";
import { Comment, Prisma } from ".prisma/client";
import logger from "../../utils/logger.util";
import { v4 as uuidv4 } from "uuid";

export class CommentRepository
  extends BaseRepository<
    typeof prisma.comment,
    Comment,
    Prisma.CommentCreateInput,
    Prisma.CommentUpdateInput,
    Prisma.CommentWhereUniqueInput
  >
  implements ICommentRepository
{
  constructor() {
    super(prisma.comment);
  }

  async createComment(data: {
    postId: string;
    userId: string;
    content: string;
    parentCommentId?: string;
  }): Promise<Comment> {
    try {
      // Generate unique ID for the comment
      const commentId = uuidv4();
      
      return await super.create({
        ...data,
        id: commentId,
      });
    } catch (error: any) {
      logger.error("Error creating comment", { error: error.message });
      throw new Error("Failed to create comment");
    }
  }

  async updateComment(commentId: string, content: string): Promise<Comment> {
    try {
      const comment = await super.findById(commentId);
      if (!comment) {
        throw new Error("Comment not found");
      }

      return await prisma.comment.update({
        where: { id: commentId },
        data: { content, editedAt: new Date(), version: comment.version + 1 },
      });
    } catch (error: any) {
      logger.error("Error updating comment", { error: error.message });
      throw new Error("Failed to update comment");
    }
  }

  async deleteComment(commentId: string): Promise<void> {
    try {
      await prisma.comment.update({
        where: { id: commentId },
        data: {
          deletedAt: new Date(),
        },
      });
    } catch (error: any) {
      logger.error("Error deleting comment", { error: error.message });
      throw new Error("Database error");
    }
  }

  async findComment(commentId: string): Promise<Comment | null> {
    try {
      return await prisma.comment.findFirst({
        where: { 
          id: commentId,
          deletedAt: null, // Exclude soft-deleted comments
        },
        include: {
          CommentMention: true,
        },
      });
    } catch (error: any) {
      logger.error("Error finding comment", { error: error.message });
      throw new Error("Database error");
    }
  }


  async getCommentsByPost(
    postId: string,
    limit: number,
    offset: number,
    includeReplies: boolean = true,
    includeMentions: boolean = true
  ): Promise<Comment[]> {
    try {
      // Build include object based on flags
      const include: any = {};

      if (includeMentions) {
        include.CommentMention = true;
      }

      if (includeReplies) {
        include.other_Comment = {
          where: {
            deletedAt: null,
            // LinkedIn-style: Only get direct replies to this main comment
            // No nested replies - all replies are flat under main comment
          },
          take: 10, // Can show more replies
          orderBy: {
            createdAt: "asc",
          },
          include: {
            CommentMention: includeMentions,
            // NO nested other_Comment include - replies don't have replies in LinkedIn-style
          },
        };
      }

      return await prisma.comment.findMany({
        where: {
          postId,
          parentCommentId: null, // Only top-level comments
          deletedAt: null,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
        skip: offset,
        include,
      });
    } catch (error: any) {
      logger.error("Error getting comments by post", { error: error.message });
      throw new Error("Failed to get comments by post");
    }
  }

  async getCommentCount(postId: string): Promise<number> {
    try {
      return await prisma.comment.count({ where: { postId, deletedAt: null } });
    } catch (error: any) {
      logger.error("Error getting comment count", { error: error.message });
      throw new Error("Failed to get comment count");
    }
  }

  async getReplies(commentId: string, limit: number = 10): Promise<Comment[]> {
    try {
      return await prisma.comment.findMany({
        where: { parentCommentId: commentId, deletedAt: null },
        orderBy: { createdAt: "asc" },
        take: limit,
        include: {
          CommentMention: true,
        },
      });
    } catch (error: any) {
      logger.error("Error getting replies", { error: error.message });
      throw new Error("Failed to get replies");
    }
  }

  async getReplyCount(commentId: string): Promise<number> {
    try {
      return await prisma.comment.count({
        where: {
          parentCommentId: commentId,
          deletedAt: null,
        },
      });
    } catch (error: any) {
      logger.error("Error getting reply count", { error: error.message, commentId });
      throw new Error("Failed to get reply count");
    }
  }

  async incrementLikesCount(commentId: string): Promise<void> {
    try {
      await prisma.comment.update({
        where: { id: commentId },
        data: {
          likesCount: {
            increment: 1,
          },
        },
      });
    } catch (error: any) {
      logger.error("Error incrementing comment likes count", {
        error: error.message,
        commentId,
      });
      throw new Error("Database error");
    }
  }

  async decrementLikesCount(commentId: string): Promise<void> {
    try {
      await prisma.comment.update({
        where: { id: commentId },
        data: {
          likesCount: {
            decrement: 1,
          },
        },
      });
    } catch (error: any) {
      logger.error("Error decrementing comment likes count", {
        error: error.message,
        commentId,
      });
      throw new Error("Database error");
    }
  }

}
