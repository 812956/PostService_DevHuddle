import redisClient from "../config/redis.config";
import logger from "./logger.util";

export const generateBlockUserRedisKey = (sensitive: string): string => {
  return `blacklist:user:${sensitive}`;
};

export class RedisCacheService {
  private static readonly CACHE_KEYS = {
    POST_LIKES: (postId: string) => `post:${postId}:likes`,
    POST_COMMENTS: (postId: string) => `post:${postId}:comments`,
    POST_SHARES: (postId: string) => `post:${postId}:shares`,
    POST_COMMENT_LIST: (postId: string) => `post:${postId}:comment-list`,
    COMMENT_LIKES: (commentId: string) => `comment:${commentId}:likes`,
  };

  private static readonly TTL = {
    POST_LIKES: 3600, // 1 hour
    POST_COMMENTS: 3600, // 1 hour
    POST_SHARES: 3600, // 1 hour
    POST_COMMENT_LIST: 300, // 5 minutes (hot comments)
    COMMENT_LIKES: 3600, // 1 hour
  };

  // ========== POST LIKES CACHE ==========

  /**
   * Increment post likes count with write-through caching
   */
  static async incrementPostLikes(postId: string): Promise<number> {
    try {
      const key = this.CACHE_KEYS.POST_LIKES(postId);
      const count = await redisClient.incr(key);
      await redisClient.expire(key, this.TTL.POST_LIKES);
      logger.info(`Post likes incremented for post ${postId}: ${count}`);
      return count;
    } catch (error) {
      logger.error("Error incrementing post likes", { error, postId });
      throw error;
    }
  }

  /**
   * Decrement post likes count with write-through caching
   */
  static async decrementPostLikes(postId: string): Promise<number> {
    try {
      const key = this.CACHE_KEYS.POST_LIKES(postId);
      const count = await redisClient.decr(key);
      await redisClient.expire(key, this.TTL.POST_LIKES);
      logger.info(`Post likes decremented for post ${postId}: ${count}`);
      return count;
    } catch (error) {
      logger.error("Error decrementing post likes", { error, postId });
      throw error;
    }
  }

  /**
   * Get cached post likes count
   */
  static async getPostLikes(postId: string): Promise<number | null> {
    try {
      const key = this.CACHE_KEYS.POST_LIKES(postId);
      const count = await redisClient.get(key);
      return count ? parseInt(count, 10) : null;
    } catch (error) {
      logger.error("Error getting post likes from cache", { error, postId });
      return null;
    }
  }

  /**
   * Cache post likes count (for cache-aside pattern)
   */
  static async cachePostLikes(
    postId: string,
    count: number,
    ttl: number = this.TTL.POST_LIKES
  ): Promise<void> {
    try {
      const key = this.CACHE_KEYS.POST_LIKES(postId);
      await redisClient.setEx(key, ttl, count.toString());
      logger.info(`Cached post likes count for post ${postId}: ${count}`);
    } catch (error) {
      logger.error("Error caching post likes", { error, postId, count });
      // Don't throw - caching failure shouldn't break the flow
    }
  }

  // ========== COMMENT LIKES CACHE ==========

  /**
   * Increment comment likes count with write-through caching
   */
  static async incrementCommentLikes(commentId: string): Promise<number> {
    try {
      const key = this.CACHE_KEYS.COMMENT_LIKES(commentId);
      const count = await redisClient.incr(key);
      await redisClient.expire(key, this.TTL.COMMENT_LIKES);
      logger.info(`Comment likes incremented for comment ${commentId}: ${count}`);
      return count;
    } catch (error) {
      logger.error("Error incrementing comment likes", { error, commentId });
      throw error;
    }
  }

  /**
   * Decrement comment likes count with write-through caching
   */
  static async decrementCommentLikes(commentId: string): Promise<number> {
    try {
      const key = this.CACHE_KEYS.COMMENT_LIKES(commentId);
      const count = await redisClient.decr(key);
      await redisClient.expire(key, this.TTL.COMMENT_LIKES);
      logger.info(`Comment likes decremented for comment ${commentId}: ${count}`);
      return count;
    } catch (error) {
      logger.error("Error decrementing comment likes", { error, commentId });
      throw error;
    }
  }

  /**
   * Get cached comment likes count
   */
  static async getCommentLikes(commentId: string): Promise<number | null> {
    try {
      const key = this.CACHE_KEYS.COMMENT_LIKES(commentId);
      const count = await redisClient.get(key);
      return count ? parseInt(count, 10) : null;
    } catch (error) {
      logger.error("Error getting comment likes from cache", {
        error,
        commentId,
      });
      return null;
    }
  }

  /**
   * Cache comment likes count (for cache-aside pattern)
   */
  static async cacheCommentLikesCount(
    commentId: string,
    count: number,
    ttl: number = this.TTL.COMMENT_LIKES
  ): Promise<void> {
    try {
      const key = this.CACHE_KEYS.COMMENT_LIKES(commentId);
      await redisClient.setEx(key, ttl, count.toString());
      logger.info(`Cached comment likes count for comment ${commentId}: ${count}`);
    } catch (error) {
      logger.error("Error caching comment likes count", { error, commentId, count });
      // Don't throw - caching failure shouldn't break the flow
    }
  }

  // ========== POST COMMENTS CACHE ==========

  /**
   * Increment post comments count with write-through caching
   */
  static async incrementPostComments(postId: string): Promise<number> {
    try {
      const key = this.CACHE_KEYS.POST_COMMENTS(postId);
      const count = await redisClient.incr(key);
      await redisClient.expire(key, this.TTL.POST_COMMENTS);
      logger.info(`Post comments incremented for post ${postId}: ${count}`);
      return count;
    } catch (error) {
      logger.error("Error incrementing post comments", { error, postId });
      throw error;
    }
  }

  /**
   * Decrement post comments count with write-through caching
   */
  static async decrementPostComments(postId: string): Promise<number> {
    try {
      const key = this.CACHE_KEYS.POST_COMMENTS(postId);
      const count = await redisClient.decr(key);
      await redisClient.expire(key, this.TTL.POST_COMMENTS);
      logger.info(`Post comments decremented for post ${postId}: ${count}`);
      return count;
    } catch (error) {
      logger.error("Error decrementing post comments", { error, postId });
      throw error;
    }
  }

  /**
   * Get cached post comments count
   */
  static async getPostComments(postId: string): Promise<number | null> {
    try {
      const key = this.CACHE_KEYS.POST_COMMENTS(postId);
      const count = await redisClient.get(key);
      return count ? parseInt(count, 10) : null;
    } catch (error) {
      logger.error("Error getting post comments from cache", {
        error,
        postId,
      });
      return null;
    }
  }

  /**
   * Cache post comments count (for cache-aside pattern)
   */
  static async cachePostCommentsCount(
    postId: string,
    count: number,
    ttl: number = this.TTL.POST_COMMENTS
  ): Promise<void> {
    try {
      const key = this.CACHE_KEYS.POST_COMMENTS(postId);
      await redisClient.setEx(key, ttl, count.toString());
      logger.info(`Cached post comments count for post ${postId}: ${count}`);
    } catch (error) {
      logger.error("Error caching post comments count", { error, postId, count });
      // Don't throw - caching failure shouldn't break the flow
    }
  }

  // ========== POST SHARES CACHE (for future share service) ==========

  /**
   * Increment post shares count with write-through caching
   */
  static async incrementPostShares(postId: string): Promise<number> {
    try {
      const key = this.CACHE_KEYS.POST_SHARES(postId);
      const count = await redisClient.incr(key);
      await redisClient.expire(key, this.TTL.POST_SHARES);
      logger.info(`Post shares incremented for post ${postId}: ${count}`);
      return count;
    } catch (error) {
      logger.error("Error incrementing post shares", { error, postId });
      throw error;
    }
  }

  /**
   * Get cached post shares count
   */
  static async getPostShares(postId: string): Promise<number | null> {
    try {
      const key = this.CACHE_KEYS.POST_SHARES(postId);
      const count = await redisClient.get(key);
      return count ? parseInt(count, 10) : null;
    } catch (error) {
      logger.error("Error getting post shares from cache", {
        error,
        postId,
      });
      return null;
    }
  }

  // ========== COMMENT LIST CACHE ==========

  /**
   * Cache comment list (hot comments)
   */
  static async cacheCommentList(
    postId: string,
    comments: any[],
    ttl: number = this.TTL.POST_COMMENT_LIST
  ): Promise<void> {
    try {
      const key = this.CACHE_KEYS.POST_COMMENT_LIST(postId);
      await redisClient.setEx(key, ttl, JSON.stringify(comments));
      logger.info(`Cached comment list for post ${postId}`);
    } catch (error) {
      logger.error("Error caching comment list", { error, postId });
      // Don't throw - caching failure shouldn't break the flow
    }
  }

  /**
   * Get cached comment list
   */
  static async getCachedCommentList(postId: string): Promise<any[] | null> {
    try {
      const key = this.CACHE_KEYS.POST_COMMENT_LIST(postId);
      const cached = await redisClient.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.error("Error getting cached comment list", { error, postId });
      return null;
    }
  }

  /**
   * Invalidate comment list cache
   */
  static async invalidateCommentList(postId: string): Promise<void> {
    try {
      const key = this.CACHE_KEYS.POST_COMMENT_LIST(postId);
      await redisClient.del(key);
      logger.info(`Invalidated comment list for post ${postId}`);
    } catch (error) {
      logger.error("Error invalidating comment list", { error, postId });
    }
  }

  // ========== CACHE INVALIDATION ==========

  /**
   * Invalidate specific post counter cache
   */
  static async invalidatePostCounter(
    postId: string,
    counterType: "likes" | "comments" | "shares"
  ): Promise<void> {
    try {
      const keyMap = {
        likes: this.CACHE_KEYS.POST_LIKES(postId),
        comments: this.CACHE_KEYS.POST_COMMENTS(postId),
        shares: this.CACHE_KEYS.POST_SHARES(postId),
      };

      await redisClient.del(keyMap[counterType]);
      logger.info(`Invalidated ${counterType} cache for post ${postId}`);
    } catch (error) {
      logger.error("Error invalidating post counter", {
        error,
        postId,
        counterType,
      });
    }
  }

  /**
   * Invalidate all post-related caches (useful for post deletion)
   */
  static async invalidatePostCaches(postId: string): Promise<void> {
    try {
      const patterns = [
        this.CACHE_KEYS.POST_LIKES(postId),
        this.CACHE_KEYS.POST_COMMENTS(postId),
        this.CACHE_KEYS.POST_SHARES(postId),
        this.CACHE_KEYS.POST_COMMENT_LIST(postId),
      ];

      for (const pattern of patterns) {
        await redisClient.del(pattern);
      }

      logger.info(`Invalidated all caches for post ${postId}`);
    } catch (error) {
      logger.error("Error invalidating post caches", { error, postId });
    }
  }

  // ✅ NEW: Generic cache methods for feed caching
  static async get(key: string): Promise<string | null> {
    try {
      return await redisClient.get(key);
    } catch (error) {
      logger.error("Error getting from Redis cache", { error, key });
      return null;
    }
  }

  static async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (ttl) {
        await redisClient.setEx(key, ttl, value);
      } else {
        await redisClient.set(key, value);
      }
    } catch (error) {
      logger.error("Error setting Redis cache", { error, key });
    }
  }

  static async delete(key: string): Promise<void> {
    try {
      await redisClient.del(key);
    } catch (error) {
      logger.error("Error deleting from Redis cache", { error, key });
    }
  }
}