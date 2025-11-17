import {
  ICommentRepository,
  CommentSelectOptions,
} from "../interface/ICommentRepository";
import { BaseRepository } from "./base.repository";
import { prisma } from "../../config/prisma.config";
import { Comment, Prisma } from ".prisma/client";
import logger from "../../utils/logger.util";

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
      return await super.create(data);
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
      return await prisma.comment.findUnique({
        where: { id: commentId },
        include: {
          commentMentions: true,
        },
      });
    } catch (error: any) {
      logger.error("Error finding comment", { error: error.message });
      throw new Error("Database error");
    }
  }

  // async getCommentsByPost(
  //   postId: string,
  //   options?: CommentSelectOptions
  // ): Promise<Comment[]> {
  //   try {
  //     const defaultOptions: CommentSelectOptions = {
  //       where: {
  //         postId,
  //         parentCommentId: null, // Top-level comments only
  //         deletedAt: null,
  //       },
  //       orderBy: {
  //         createdAt: "desc",
  //       },
  //       take: options?.take || 20,
  //       include: {
  //         commentMentions: true,
  //         Replies: {
  //           where: {
  //             deletedAt: null,
  //           },
  //           take: 5,
  //           orderBy: {
  //             createdAt: "asc",
  //           },
  //         },
  //       },
  //     };

  //     const mergedOptions = { ...defaultOptions, ...options };

  //     return await prisma.comment.findMany(mergedOptions);
  //   } catch (error: any) {
  //     logger.error("Error getting comments by post", { error: error.message });
  //     throw new Error("Failed to get comments by post");
  //   }
  // }
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
        include.commentMentions = true;
      }

      if (includeReplies) {
        include.Replies = {
          where: {
            deletedAt: null,
          },
          take: 5,
          orderBy: {
            createdAt: "asc",
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
          commentMentions: true,
        },
      });
    } catch (error: any) {
      logger.error("Error getting replies", { error: error.message });
      throw new Error("Failed to get replies");
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
