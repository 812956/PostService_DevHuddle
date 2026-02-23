import { BaseRepository } from "./base.repository";
import { prisma } from "../../config/prisma.config";
import { CommentMention, PostMention, Prisma } from "@prisma/client";
import { IMentionRepository } from "../interface/IMentionRepository";
import logger from "../../utils/logger.util";

export class MentionRepository implements IMentionRepository {
  async createPostMention(data: {
    postId: string;
    mentionedUserId: string;
    actorId: string;
  }): Promise<PostMention> {
    try {
      return await prisma.postMention.upsert({
        where: {
          postId_mentionedUserId: {
            postId: data.postId,
            mentionedUserId: data.mentionedUserId,
          },
        },
        update: {},
        create: {
          postId: data.postId,
          mentionedUserId: data.mentionedUserId,
          actorId: data.actorId,
        } as any, // Type assertion - id will be auto-generated
      });
    } catch (error: any) {
      logger.error("Error creating post mention", { error: error.message });
      throw new Error("Failed to create post mention");
    }
  }

  async createCommentMention(data: {
    commentId: string;
    mentionedUserId: string;
    actorId: string;
  }): Promise<CommentMention> {
    try {
      return prisma.commentMention.upsert({
        where: {
          commentId_mentionedUserId: {
            commentId: data.commentId,
            mentionedUserId: data.mentionedUserId,
          },
        },
        update: {},
        create: {
          commentId: data.commentId,
          actorId: data.actorId,
          mentionedUserId: data.mentionedUserId,
        } as any, // Type assertion - id will be auto-generated
      });
    } catch (error: any) {
      logger.error("Error creating comment mention", { error: error.message });
      throw new Error("Database error");
    }
  }

  async getPostMentions(postId: string): Promise<PostMention[]> {
    try {
      return await prisma.postMention.findMany({
        where: { postId },
        orderBy: { createdAt: "desc" },
      });
    } catch (error: any) {
      logger.error("Error getting post mentions", { error: error.message });
      throw new Error("Failed to get post mentions");
    }
  }

  async getCommentMentions(commentId: string): Promise<CommentMention[]> {
    try {
      return await prisma.commentMention.findMany({
        where: { commentId },
        orderBy: { createdAt: "desc" },
      });
    } catch (error: any) {
      logger.error("Error getting comment mentions", { error: error.message });
      throw new Error("Failed to get comment mentions");
    }
  }

  async deletePostMentions(postId: string): Promise<void> {
    try {
      await prisma.postMention.deleteMany({ where: { postId } });
    } catch (error: any) {
      logger.error("Error deleting post mentions", { error: error.message });
      throw new Error("Failed to delete post mentions");
    }
  }

  async deleteCommentMentions(commentId: string): Promise<void> {
    try {
      await prisma.commentMention.deleteMany({ where: { commentId } });
    } catch (error: any) {
      logger.error("Error deleting comment mentions", { error: error.message });
      throw new Error("Failed to delete comment mentions");
    }
  }
}
