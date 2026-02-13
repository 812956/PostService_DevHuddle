import { IShareLinkRepository } from "../interface/IShareLinkRepository";
import { BaseRepository } from "./base.repository";
import { prisma } from "../../config/prisma.config";
import { PostShareLink, Prisma } from ".prisma/client";
import logger from "../../utils/logger.util";

export class ShareLinkRepository
  extends BaseRepository<
    typeof prisma.postShareLink,
    PostShareLink,
    Prisma.PostShareLinkCreateInput,
    Prisma.PostShareLinkUpdateInput,
    Prisma.PostShareLinkWhereInput
  >
  implements IShareLinkRepository
{
  constructor() {
    super(prisma.postShareLink);
  }

  async createShareLink(data: {
    postId: string;
    shortId: string;
    shareToken?: string;
    tokenExpiresAt?: Date;
    createdById: string;
  }): Promise<PostShareLink> {
    try {
      return await super.create({
        posts: {
          connect: { id: data.postId },
        },
        shortId: data.shortId,
        shareToken: data.shareToken,
        tokenExpiresAt: data.tokenExpiresAt,
        createdById: data.createdById,
      });
    } catch (error: any) {
      logger.error("Error creating share link", { error: error.message });
      throw new Error("Failed to create share link");
    }
  }

  async findByShortId(shortId: string): Promise<PostShareLink | null> {
    try {
      return await prisma.postShareLink.findUnique({
        where: { shortId },
      });
    } catch (error: any) {
      logger.error("Error finding share link by short ID", { error: error.message });
      throw new Error("Failed to find share link");
    }
  }

  async findByShareToken(token: string): Promise<PostShareLink | null> {
    try {
      return await prisma.postShareLink.findUnique({
        where: { shareToken: token },
      });
    } catch (error: any) {
      logger.error("Error finding share link by token", { error: error.message });
      throw new Error("Failed to find share link");
    }
  }

  async findByPostId(postId: string): Promise<PostShareLink | null> {
    try {
      return await prisma.postShareLink.findFirst({
        where: { postId },
        orderBy: { createdAt: "desc" },
      });
    } catch (error: any) {
      logger.error("Error finding share link by post ID", { error: error.message });
      throw new Error("Failed to find share link");
    }
  }

  async incrementClickCount(id: string): Promise<void> {
    try {
      await prisma.postShareLink.update({
        where: { id },
        data: {
          clickCount: {
            increment: 1,
          },
        },
      });
    } catch (error: any) {
      logger.error("Error incrementing click count", { error: error.message });
      throw new Error("Failed to increment click count");
    }
  }

  async deleteExpiredTokens(): Promise<number> {
    try {
      const result = await prisma.postShareLink.deleteMany({
        where: {
          tokenExpiresAt: {
            lt: new Date(),
          },
        },
      });
      return result.count;
    } catch (error: any) {
      logger.error("Error deleting expired tokens", { error: error.message });
      throw new Error("Failed to delete expired tokens");
    }
  }
}

