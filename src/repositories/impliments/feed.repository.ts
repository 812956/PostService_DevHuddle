import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.config";
import logger from "../../utils/logger.util";
import {
  FeedEntry,
  FeedQueryOptions,
  IFeedRepository,
} from "../interface/IFeedRepository";

export class FeedRepository implements IFeedRepository {
  async batchInsertFeedEntries(
    entries: Omit<FeedEntry, "readAt">[]
  ): Promise<void> {
    try {
      // Use createMany for efficient batch insertion
      await prisma.userFeed.createMany({
        data: entries.map((entry) => ({
          userId: entry.userId,
          postId: entry.postId,
          relevanceScore: entry.relevanceScore,
          isRead: entry.isRead || false,
          rankPosition: entry.rankPosition,
          createdAt: entry.createdAt,
          scoreUpdatedAt: entry.scoreUpdatedAt || entry.createdAt,
        })),
        skipDuplicates: true, // Skip if entry already exists
      });
    } catch (error: any) {
      logger.error("Error batch inserting feed entries", {
        error: error.message,
        entryCount: entries.length,
      });
      throw new Error("Failed to batch insert feed entries");
    }
  }

  async getFeedEntries(options: FeedQueryOptions): Promise<FeedEntry[]> {
    try {
      const limit = options.limit || 10;
      const where: Prisma.UserFeedWhereInput = {
        userId: options.userId,
      };

      // Filter out read posts if includeRead is false
      if (options.includeRead === false) {
        where.isRead = false;
      }

      // Cursor-based pagination
      if (options.cursor) {
        where.postId = { lt: options.cursor };
      }

      const feedEntries = await prisma.userFeed.findMany({
        where,
        orderBy: [
          { relevanceScore: "desc" }, // Primary sort: relevance
          { createdAt: "desc" }, // Secondary sort: recency
        ],
        take: limit + 1, // Fetch one extra to check if there's more
      });

      return feedEntries.map(this.mapToFeedEntry);
    } catch (error: any) {
      logger.error("Error getting feed entries", {
        error: error.message,
        userId: options.userId,
      });
      throw new Error("Failed to get feed entries");
    }
  }

  async getFeedEntriesByPostId(postId: string): Promise<FeedEntry[]> {
    try {
      const entries = await prisma.userFeed.findMany({
        where: { postId },
      });

      return entries.map(this.mapToFeedEntry);
    } catch (error: any) {
      logger.error("Error getting feed entries by post ID", {
        error: error.message,
        postId,
      });
      throw new Error("Failed to get feed entries by post ID");
    }
  }

  async removeFromFeeds(postId: string): Promise<void> {
    try {
      await prisma.userFeed.deleteMany({
        where: { postId },
      });
    } catch (error: any) {
      logger.error("Error removing post from feeds", {
        error: error.message,
        postId,
      });
      throw new Error("Failed to remove post from feeds");
    }
  }

  async updateRelevanceScore(
    userId: string,
    postId: string,
    score: number
  ): Promise<void> {
    try {
      await prisma.userFeed.update({
        where: {
          userId_postId: {
            userId,
            postId,
          },
        },
        data: {
          relevanceScore: Math.min(1.0, Math.max(0.0, score)), // Clamp between 0 and 1
          scoreUpdatedAt: new Date(),
        },
      });
    } catch (error: any) {
      logger.error("Error updating relevance score", {
        error: error.message,
        userId,
        postId,
      });
      throw new Error("Failed to update relevance score");
    }
  }

  async markAsRead(userId: string, postId: string): Promise<void> {
    try {
      await prisma.userFeed.update({
        where: {
          userId_postId: {
            userId,
            postId,
          },
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });
    } catch (error: any) {
      logger.error("Error marking feed entry as read", {
        error: error.message,
        userId,
        postId,
      });
      throw new Error("Failed to mark feed entry as read");
    }
  }

  async feedEntryExists(userId: string, postId: string): Promise<boolean> {
    try {
      const entry = await prisma.userFeed.findUnique({
        where: {
          userId_postId: {
            userId,
            postId,
          },
        },
      });

      return !!entry;
    } catch (error: any) {
      logger.error("Error checking feed entry existence", {
        error: error.message,
        userId,
        postId,
      });
      return false;
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    try {
      return await prisma.userFeed.count({
        where: {
          userId,
          isRead: false,
        },
      });
    } catch (error: any) {
      logger.error("Error getting unread count", {
        error: error.message,
        userId,
      });
      return 0;
    }
  }

  async batchUpdateScores(
    updates: Array<{ userId: string; postId: string; score: number }>
  ): Promise<void> {
    try {
      // Use transaction for batch updates
      await prisma.$transaction(
        updates.map((update) =>
          prisma.userFeed.update({
            where: {
              userId_postId: {
                userId: update.userId,
                postId: update.postId,
              },
            },
            data: {
              relevanceScore: Math.min(1.0, Math.max(0.0, update.score)),
              scoreUpdatedAt: new Date(),
            },
          })
        )
      );
    } catch (error: any) {
      logger.error("Error batch updating scores", {
        error: error.message,
        updateCount: updates.length,
      });
      throw new Error("Failed to batch update scores");
    }
  }

  /**
   * Map Prisma UserFeed to FeedEntry
   */
  private mapToFeedEntry(entry: any): FeedEntry {
    return {
      userId: entry.userId,
      postId: entry.postId,
      relevanceScore: entry.relevanceScore || 0.0,
      isRead: entry.isRead || false,
      readAt: entry.readAt || undefined,
      rankPosition: entry.rankPosition || undefined,
      createdAt: entry.createdAt,
      scoreUpdatedAt: entry.scoreUpdatedAt || entry.createdAt,
    };
  }
}

