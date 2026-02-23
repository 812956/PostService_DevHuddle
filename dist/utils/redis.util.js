"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisCacheService = exports.generateBlockUserRedisKey = void 0;
const redis_config_1 = __importDefault(require("../config/redis.config"));
const logger_util_1 = __importDefault(require("./logger.util"));
const generateBlockUserRedisKey = (sensitive) => {
    return `blacklist:user:${sensitive}`;
};
exports.generateBlockUserRedisKey = generateBlockUserRedisKey;
class RedisCacheService {
    // ========== POST LIKES CACHE ==========
    /**
     * Increment post likes count with write-through caching
     */
    static async incrementPostLikes(postId) {
        try {
            const key = this.CACHE_KEYS.POST_LIKES(postId);
            const count = await redis_config_1.default.incr(key);
            await redis_config_1.default.expire(key, this.TTL.POST_LIKES);
            logger_util_1.default.info(`Post likes incremented for post ${postId}: ${count}`);
            return count;
        }
        catch (error) {
            logger_util_1.default.error("Error incrementing post likes", { error, postId });
            throw error;
        }
    }
    /**
     * Decrement post likes count with write-through caching
     */
    static async decrementPostLikes(postId) {
        try {
            const key = this.CACHE_KEYS.POST_LIKES(postId);
            const count = await redis_config_1.default.decr(key);
            await redis_config_1.default.expire(key, this.TTL.POST_LIKES);
            logger_util_1.default.info(`Post likes decremented for post ${postId}: ${count}`);
            return count;
        }
        catch (error) {
            logger_util_1.default.error("Error decrementing post likes", { error, postId });
            throw error;
        }
    }
    /**
     * Get cached post likes count
     */
    static async getPostLikes(postId) {
        try {
            const key = this.CACHE_KEYS.POST_LIKES(postId);
            const count = await redis_config_1.default.get(key);
            return count ? parseInt(count, 10) : null;
        }
        catch (error) {
            logger_util_1.default.error("Error getting post likes from cache", { error, postId });
            return null;
        }
    }
    /**
     * Cache post likes count (for cache-aside pattern)
     */
    static async cachePostLikes(postId, count, ttl = this.TTL.POST_LIKES) {
        try {
            const key = this.CACHE_KEYS.POST_LIKES(postId);
            await redis_config_1.default.setEx(key, ttl, count.toString());
            logger_util_1.default.info(`Cached post likes count for post ${postId}: ${count}`);
        }
        catch (error) {
            logger_util_1.default.error("Error caching post likes", { error, postId, count });
            // Don't throw - caching failure shouldn't break the flow
        }
    }
    // ========== COMMENT LIKES CACHE ==========
    /**
     * Increment comment likes count with write-through caching
     */
    static async incrementCommentLikes(commentId) {
        try {
            const key = this.CACHE_KEYS.COMMENT_LIKES(commentId);
            const count = await redis_config_1.default.incr(key);
            await redis_config_1.default.expire(key, this.TTL.COMMENT_LIKES);
            logger_util_1.default.info(`Comment likes incremented for comment ${commentId}: ${count}`);
            return count;
        }
        catch (error) {
            logger_util_1.default.error("Error incrementing comment likes", { error, commentId });
            throw error;
        }
    }
    /**
     * Decrement comment likes count with write-through caching
     */
    static async decrementCommentLikes(commentId) {
        try {
            const key = this.CACHE_KEYS.COMMENT_LIKES(commentId);
            const count = await redis_config_1.default.decr(key);
            await redis_config_1.default.expire(key, this.TTL.COMMENT_LIKES);
            logger_util_1.default.info(`Comment likes decremented for comment ${commentId}: ${count}`);
            return count;
        }
        catch (error) {
            logger_util_1.default.error("Error decrementing comment likes", { error, commentId });
            throw error;
        }
    }
    /**
     * Get cached comment likes count
     */
    static async getCommentLikes(commentId) {
        try {
            const key = this.CACHE_KEYS.COMMENT_LIKES(commentId);
            const count = await redis_config_1.default.get(key);
            return count ? parseInt(count, 10) : null;
        }
        catch (error) {
            logger_util_1.default.error("Error getting comment likes from cache", {
                error,
                commentId,
            });
            return null;
        }
    }
    /**
     * Cache comment likes count (for cache-aside pattern)
     */
    static async cacheCommentLikesCount(commentId, count, ttl = this.TTL.COMMENT_LIKES) {
        try {
            const key = this.CACHE_KEYS.COMMENT_LIKES(commentId);
            await redis_config_1.default.setEx(key, ttl, count.toString());
            logger_util_1.default.info(`Cached comment likes count for comment ${commentId}: ${count}`);
        }
        catch (error) {
            logger_util_1.default.error("Error caching comment likes count", { error, commentId, count });
            // Don't throw - caching failure shouldn't break the flow
        }
    }
    // ========== POST COMMENTS CACHE ==========
    /**
     * Increment post comments count with write-through caching
     */
    static async incrementPostComments(postId) {
        try {
            const key = this.CACHE_KEYS.POST_COMMENTS(postId);
            const count = await redis_config_1.default.incr(key);
            await redis_config_1.default.expire(key, this.TTL.POST_COMMENTS);
            logger_util_1.default.info(`Post comments incremented for post ${postId}: ${count}`);
            return count;
        }
        catch (error) {
            logger_util_1.default.error("Error incrementing post comments", { error, postId });
            throw error;
        }
    }
    /**
     * Decrement post comments count with write-through caching
     */
    static async decrementPostComments(postId) {
        try {
            const key = this.CACHE_KEYS.POST_COMMENTS(postId);
            const count = await redis_config_1.default.decr(key);
            await redis_config_1.default.expire(key, this.TTL.POST_COMMENTS);
            logger_util_1.default.info(`Post comments decremented for post ${postId}: ${count}`);
            return count;
        }
        catch (error) {
            logger_util_1.default.error("Error decrementing post comments", { error, postId });
            throw error;
        }
    }
    /**
     * Get cached post comments count
     */
    static async getPostComments(postId) {
        try {
            const key = this.CACHE_KEYS.POST_COMMENTS(postId);
            const count = await redis_config_1.default.get(key);
            return count ? parseInt(count, 10) : null;
        }
        catch (error) {
            logger_util_1.default.error("Error getting post comments from cache", {
                error,
                postId,
            });
            return null;
        }
    }
    /**
     * Cache post comments count (for cache-aside pattern)
     */
    static async cachePostCommentsCount(postId, count, ttl = this.TTL.POST_COMMENTS) {
        try {
            const key = this.CACHE_KEYS.POST_COMMENTS(postId);
            await redis_config_1.default.setEx(key, ttl, count.toString());
            logger_util_1.default.info(`Cached post comments count for post ${postId}: ${count}`);
        }
        catch (error) {
            logger_util_1.default.error("Error caching post comments count", { error, postId, count });
            // Don't throw - caching failure shouldn't break the flow
        }
    }
    // ========== POST SHARES CACHE (for future share service) ==========
    /**
     * Increment post shares count with write-through caching
     */
    static async incrementPostShares(postId) {
        try {
            const key = this.CACHE_KEYS.POST_SHARES(postId);
            const count = await redis_config_1.default.incr(key);
            await redis_config_1.default.expire(key, this.TTL.POST_SHARES);
            logger_util_1.default.info(`Post shares incremented for post ${postId}: ${count}`);
            return count;
        }
        catch (error) {
            logger_util_1.default.error("Error incrementing post shares", { error, postId });
            throw error;
        }
    }
    /**
     * Get cached post shares count
     */
    static async getPostShares(postId) {
        try {
            const key = this.CACHE_KEYS.POST_SHARES(postId);
            const count = await redis_config_1.default.get(key);
            return count ? parseInt(count, 10) : null;
        }
        catch (error) {
            logger_util_1.default.error("Error getting post shares from cache", {
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
    static async cacheCommentList(postId, comments, ttl = this.TTL.POST_COMMENT_LIST) {
        try {
            const key = this.CACHE_KEYS.POST_COMMENT_LIST(postId);
            await redis_config_1.default.setEx(key, ttl, JSON.stringify(comments));
            logger_util_1.default.info(`Cached comment list for post ${postId}`);
        }
        catch (error) {
            logger_util_1.default.error("Error caching comment list", { error, postId });
            // Don't throw - caching failure shouldn't break the flow
        }
    }
    /**
     * Get cached comment list
     */
    static async getCachedCommentList(postId) {
        try {
            const key = this.CACHE_KEYS.POST_COMMENT_LIST(postId);
            const cached = await redis_config_1.default.get(key);
            return cached ? JSON.parse(cached) : null;
        }
        catch (error) {
            logger_util_1.default.error("Error getting cached comment list", { error, postId });
            return null;
        }
    }
    /**
     * Invalidate comment list cache
     */
    static async invalidateCommentList(postId) {
        try {
            const key = this.CACHE_KEYS.POST_COMMENT_LIST(postId);
            await redis_config_1.default.del(key);
            logger_util_1.default.info(`Invalidated comment list for post ${postId}`);
        }
        catch (error) {
            logger_util_1.default.error("Error invalidating comment list", { error, postId });
        }
    }
    // ========== CACHE INVALIDATION ==========
    /**
     * Invalidate specific post counter cache
     */
    static async invalidatePostCounter(postId, counterType) {
        try {
            const keyMap = {
                likes: this.CACHE_KEYS.POST_LIKES(postId),
                comments: this.CACHE_KEYS.POST_COMMENTS(postId),
                shares: this.CACHE_KEYS.POST_SHARES(postId),
            };
            await redis_config_1.default.del(keyMap[counterType]);
            logger_util_1.default.info(`Invalidated ${counterType} cache for post ${postId}`);
        }
        catch (error) {
            logger_util_1.default.error("Error invalidating post counter", {
                error,
                postId,
                counterType,
            });
        }
    }
    /**
     * Invalidate all post-related caches (useful for post deletion)
     */
    static async invalidatePostCaches(postId) {
        try {
            const patterns = [
                this.CACHE_KEYS.POST_LIKES(postId),
                this.CACHE_KEYS.POST_COMMENTS(postId),
                this.CACHE_KEYS.POST_SHARES(postId),
                this.CACHE_KEYS.POST_COMMENT_LIST(postId),
            ];
            for (const pattern of patterns) {
                await redis_config_1.default.del(pattern);
            }
            logger_util_1.default.info(`Invalidated all caches for post ${postId}`);
        }
        catch (error) {
            logger_util_1.default.error("Error invalidating post caches", { error, postId });
        }
    }
    // ✅ NEW: Generic cache methods for feed caching
    static async get(key) {
        try {
            return await redis_config_1.default.get(key);
        }
        catch (error) {
            logger_util_1.default.error("Error getting from Redis cache", { error, key });
            return null;
        }
    }
    static async set(key, value, ttl) {
        try {
            if (ttl) {
                await redis_config_1.default.setEx(key, ttl, value);
            }
            else {
                await redis_config_1.default.set(key, value);
            }
        }
        catch (error) {
            logger_util_1.default.error("Error setting Redis cache", { error, key });
        }
    }
    static async delete(key) {
        try {
            await redis_config_1.default.del(key);
        }
        catch (error) {
            logger_util_1.default.error("Error deleting from Redis cache", { error, key });
        }
    }
}
exports.RedisCacheService = RedisCacheService;
RedisCacheService.CACHE_KEYS = {
    POST_LIKES: (postId) => `post:${postId}:likes`,
    POST_COMMENTS: (postId) => `post:${postId}:comments`,
    POST_SHARES: (postId) => `post:${postId}:shares`,
    POST_COMMENT_LIST: (postId) => `post:${postId}:comment-list`,
    COMMENT_LIKES: (commentId) => `comment:${commentId}:likes`,
};
RedisCacheService.TTL = {
    POST_LIKES: 3600, // 1 hour
    POST_COMMENTS: 3600, // 1 hour
    POST_SHARES: 3600, // 1 hour
    POST_COMMENT_LIST: 300, // 5 minutes (hot comments)
    COMMENT_LIKES: 3600, // 1 hour
};
