"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostService = void 0;
const error_util_1 = require("../../utils/error.util");
const post_mapper_1 = require("../../mappers/post.mapper");
const logger_util_1 = __importDefault(require("../../utils/logger.util"));
const http_status_1 = require("../../constands/http.status");
const redis_util_1 = require("../../utils/redis.util");
const client_1 = require("@prisma/client");
const kafka_config_1 = require("../../config/kafka.config");
const grpc_client_1 = require("../../config/grpc.client");
const grpc_client_call_util_1 = require("../../utils/grpc.client.call.util");
class PostService {
    constructor(_postRepository, likeRepository, commentRepository, shareRepository, postVersionRepository, feedService, //  NEW: Feed service for fan-out
    outboxService //  NEW: Outbox service for events
    ) {
        this._postRepository = _postRepository;
        this.likeRepository = likeRepository;
        this.commentRepository = commentRepository;
        this.shareRepository = shareRepository;
        this.postVersionRepository = postVersionRepository;
        this.feedService = feedService;
        this.outboxService = outboxService;
    }
    async submitPost(req) {
        try {
            // 1. Create post in database (transaction ensures atomicity)
            const post = await this._postRepository.submitPostRepo(req);
            // 2.  NEW: Fan-out to followers (production-ready feed generation)
            if (this.feedService) {
                try {
                    // Get followers from User Service
                    let followers = [];
                    try {
                        const followersResponse = await (0, grpc_client_call_util_1.grpcs)(grpc_client_1.userClient, "getFollowers", { userId: req.userId });
                        followers = (followersResponse.followers || []).map((f) => ({
                            id: f.id,
                            username: f.username,
                            name: f.name,
                        }));
                    }
                    catch (followersError) {
                        // If GetFollowers not implemented yet, log and continue
                        logger_util_1.default.warn("GetFollowers not available, skipping fan-out", {
                            error: followersError.message,
                            userId: req.userId,
                        });
                        // For now, we'll still create the outbox event
                        // Fan-out can be done manually or when GetFollowers is implemented
                    }
                    // Only fan-out if we have followers and feed service is available
                    if (followers.length > 0 && this.feedService) {
                        // Extract post metadata
                        const postData = await this._postRepository.findPost(post.id);
                        if (postData) {
                            const metadata = {
                                authorId: postData.userId,
                                postId: postData.id,
                                content: postData.content,
                                tags: postData.tags || [],
                                visibility: postData.visibility,
                                likesCount: postData.likesCount,
                                commentsCount: postData.commentsCount,
                                sharesCount: postData.sharesCount,
                                createdAt: postData.createdAt,
                            };
                            // Fan-out strategy: synchronous for < 1000 followers
                            if (followers.length < 1000) {
                                await this.feedService.fanOutToFollowers({
                                    postId: post.id,
                                    authorId: req.userId,
                                    followers,
                                    metadata,
                                });
                            }
                            else {
                                // For > 1000 followers, queue for async processing
                                // TODO: Implement async queue worker
                                logger_util_1.default.info("Large follower count, async fan-out recommended", {
                                    postId: post.id,
                                    followerCount: followers.length,
                                });
                                // For now, process in batches
                                await this.feedService.fanOutToFollowers({
                                    postId: post.id,
                                    authorId: req.userId,
                                    followers: followers.slice(0, 1000), // Process first 1000
                                    metadata,
                                });
                            }
                        }
                    }
                }
                catch (fanOutError) {
                    // Log error but don't fail post creation
                    logger_util_1.default.error("Fan-out error (non-fatal)", {
                        error: fanOutError.message,
                        postId: post.id,
                    });
                }
            }
            // 3.  NEW: Publish event for notifications
            if (this.outboxService) {
                try {
                    await this.outboxService.createOutboxEvent({
                        aggregateType: client_1.OutboxAggregateType.POST,
                        aggregateId: post.id,
                        type: client_1.OutboxEventType.POST_CREATED,
                        topic: kafka_config_1.KAFKA_TOPICS.POST_CREATED,
                        key: req.userId, // Use userId as partition key
                        payload: {
                            postId: post.id,
                            userId: req.userId,
                            visibility: req.visibility || "PUBLIC",
                            content: req.content.substring(0, 200), // Preview
                            createdAt: new Date().toISOString(),
                            version: Date.now(),
                            action: "POST_CREATED",
                        },
                    });
                }
                catch (eventError) {
                    // Log but don't fail post creation
                    logger_util_1.default.error("Outbox event creation error (non-fatal)", {
                        error: eventError.message,
                        postId: post.id,
                    });
                }
            }
            return post;
        }
        catch (err) {
            logger_util_1.default.error("CreatePost error", { error: err.message });
            throw new error_util_1.CustomError(http_status_1.HttpStatus.INTERNAL_SERVER_ERROR, err.message);
        }
    }
    async getPosts(pageParam, userId, // This is viewerId
    authorId, // This is filter by author
    sortBy = "RECENT", // Default to RECENT
    limit // Add limit parameter
    ) {
        try {
            const PAGE_SIZE = limit || 10;
            // 1. Construct Privacy Filter
            const privacyFilter = await this._getVisibilityFilter(userId);
            const baseWhere = authorId
                ? { AND: [{ userId: authorId }, privacyFilter] }
                : privacyFilter;
            // MODE 1: TOP SORTING (High Engagement)
            // Strategy: Bypass FeedService (chronological only) and query DB directly with Offset Pagination
            if (sortBy === "TOP") {
                const pageNumber = parseInt(pageParam || "1", 10); // Treat pageParam as page number (default 1)
                const skip = (pageNumber - 1) * PAGE_SIZE;
                const postSelectOptions = {
                    include: { Media: true },
                    take: PAGE_SIZE + 1, // +1 to check if there are more
                    skip: skip,
                    where: baseWhere,
                    // Sort by engagement, then recency
                    orderBy: [
                        { likesCount: "desc" },
                        { commentsCount: "desc" },
                        { createdAt: "desc" },
                    ],
                };
                const prismaPosts = await this._postRepository.getPostsRepo(postSelectOptions);
                const hasMore = prismaPosts.length > PAGE_SIZE;
                const items = prismaPosts.slice(0, PAGE_SIZE);
                // Enrich with user data (engagement)
                let userLikesMap = {};
                let userSharesMap = {};
                const postIds = items.map((p) => p.id);
                if (userId && postIds.length > 0) {
                    const [likes, shares] = await Promise.all([
                        this.likeRepository?.getUserLikesForPosts(userId, postIds) || Promise.resolve({}),
                        this.shareRepository?.getUserSharesForPosts(userId, postIds) || Promise.resolve({})
                    ]);
                    userLikesMap = likes;
                    userSharesMap = shares;
                }
                const enrichedPosts = items.map((post) => {
                    const attachments = (post.Media || []).map((media) => ({
                        id: media.id,
                        postId: media.postId || post.id,
                        type: String(media.type || "IMAGE"),
                        url: media.url,
                        createdAt: media.createdAt ? new Date(media.createdAt).toISOString() : new Date().toISOString(),
                    }));
                    return {
                        ...post,
                        createdAt: post.createdAt.toISOString(),
                        updatedAt: post.updatedAt.toISOString(),
                        deletedAt: post.deletedAt ? post.deletedAt.toISOString() : null,
                        pinnedAt: post.pinnedAt ? post.pinnedAt.toISOString() : null,
                        editedAt: post.lastEditedAt ? post.lastEditedAt.toISOString() : null,
                        scheduledAt: null,
                        attachments,
                        user: post.user || { id: post.userId, username: "Unknown", name: "Unknown", avatar: "" },
                        engagement: {
                            likesCount: post.likesCount ?? 0,
                            commentsCount: post.commentsCount ?? 0,
                            sharesCount: post.sharesCount ?? 0,
                            isLiked: userLikesMap[post.id] ?? false,
                            isShared: userSharesMap[post.id] ?? false,
                        }
                    };
                });
                return {
                    pages: enrichedPosts,
                    nextCursor: hasMore ? String(pageNumber + 1) : undefined, // Return next page number
                };
            }
            // MODE 2: RECENT SORTING (Chronological)
            // Existing Logic (FeedService + Legacy Fallback + Cursor Pagination)
            // If authorId is provided, we are fetching a profile feed (not a personal timeline)
            // So we skip the FeedService logic and go straight to the repository with a filter
            if (!authorId && this.feedService && userId) {
                try {
                    // 1. Fetch Personalized Feed
                    const feedResponse = await this.feedService.getFeed(userId, pageParam, 10);
                    let feedPosts = feedResponse.posts;
                    // 2. [FIX] Eagerly fetch User's Own Latest Posts (to bridge eventual consistency gap)
                    // Only for the first page (no cursor), fetch the user's latest post to ensure it appears immediately
                    if (!pageParam) {
                        const myLatestPosts = await this._postRepository.getPostsRepo({
                            take: 5, // Fetch a few to be safe
                            where: { userId: userId },
                            orderBy: { createdAt: "desc" },
                            include: { Media: true }
                        });
                        // Merge & Deduplicate
                        // We prioritize 'myLatestPosts' if they are newer, but we need a unified list
                        // Convert feedPosts to have consistent shape if needed (they are raw from service usually)
                        const feedIds = new Set(feedPosts.map((p) => p.id));
                        const newOwnPosts = myLatestPosts.filter(p => !feedIds.has(p.id));
                        // Add unique own posts to the list
                        feedPosts = [...newOwnPosts, ...feedPosts];
                        // Sort combined list by createdAt desc to ensure correct order
                        feedPosts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                        // Limit to page size again (optional, or let it exceed slightly)
                        // It's better to keep it close to 10, but if we have 11 it's fine
                        if (feedPosts.length > 10) {
                            feedPosts = feedPosts.slice(0, 10);
                        }
                    }
                    // 3. Enrich Feed Posts with User Data (Missing in original implementation)
                    const postIds = feedPosts.map((p) => p.id);
                    let userLikesMap = {};
                    let userSharesMap = {};
                    if (postIds.length > 0) {
                        const [likes, shares] = await Promise.all([
                            this.likeRepository?.getUserLikesForPosts(userId, postIds) || Promise.resolve({}),
                            this.shareRepository?.getUserSharesForPosts(userId, postIds) || Promise.resolve({})
                        ]);
                        userLikesMap = likes;
                        userSharesMap = shares;
                    }
                    // Fetch User Details for each post (Enrichment)
                    const enrichedFeedPosts = await Promise.all(feedPosts.map(async (post) => {
                        return new Promise((resolve) => {
                            grpc_client_1.userClient.getUserForFeedListing({ userId: post.userId }, (err, response) => {
                                const user = (!err && response) ? {
                                    avatar: response.avatar,
                                    name: response.name,
                                    username: response.username,
                                } : {
                                    id: post.userId,
                                    username: "Unknown",
                                    name: "Unknown",
                                    avatar: post.user?.avatar || ""
                                };
                                // Fix Media Mapping
                                const attachments = (post.Media || []).map((media) => ({
                                    id: media.id,
                                    postId: media.postId || post.id,
                                    type: String(media.type || "IMAGE"),
                                    url: media.url,
                                    createdAt: media.createdAt ? new Date(media.createdAt).toISOString() : new Date().toISOString(),
                                }));
                                resolve({
                                    ...post,
                                    createdAt: new Date(post.createdAt).toISOString(),
                                    updatedAt: new Date(post.updatedAt).toISOString(),
                                    attachments,
                                    user,
                                    engagement: {
                                        likesCount: post.likesCount ?? 0,
                                        commentsCount: post.commentsCount ?? 0,
                                        sharesCount: post.sharesCount ?? 0,
                                        isLiked: userLikesMap[post.id] ?? false,
                                        isShared: userSharesMap[post.id] ?? false,
                                    },
                                });
                            });
                        });
                    }));
                    // 4. Hybrid Fallback (Fill the page if needed)
                    // If we are on the first page (no cursor) and have fewer than 10 posts, fill with legacy posts
                    let finalPosts = enrichedFeedPosts; // Cast to any to merge with legacy
                    if (!pageParam && finalPosts.length < 10) {
                        const remainingCount = 10 - finalPosts.length;
                        const excludeIds = finalPosts.map((p) => p.id);
                        logger_util_1.default.info("Hybrid Feed: Filling with legacy posts", {
                            feedCount: finalPosts.length,
                            needed: remainingCount
                        });
                        const legacyPosts = await this._postRepository.getPostsRepo({
                            take: remainingCount,
                            skip: 0,
                            where: {
                                id: { notIn: excludeIds },
                            },
                            orderBy: { createdAt: "desc" },
                            include: { Media: true },
                        });
                        // Enrich legacy posts (getPostsRepo already enriches user, but we need engagement)
                        const legacyPostIds = legacyPosts.map(p => p.id);
                        if (legacyPostIds.length > 0) {
                            const [lLikes, lShares] = await Promise.all([
                                this.likeRepository?.getUserLikesForPosts(userId, legacyPostIds) || Promise.resolve({}),
                                this.shareRepository?.getUserSharesForPosts(userId, legacyPostIds) || Promise.resolve({})
                            ]);
                            const enrichedLegacy = legacyPosts.map(post => ({
                                ...post,
                                createdAt: new Date(post.createdAt).toISOString(), // Ensure string format
                                updatedAt: new Date(post.updatedAt).toISOString(),
                                attachments: (post.Media || []).map((m) => ({
                                    id: m.id,
                                    postId: m.postId,
                                    type: String(m.type),
                                    url: m.url,
                                    createdAt: m.createdAt
                                })),
                                engagement: {
                                    likesCount: post.likesCount ?? 0,
                                    commentsCount: post.commentsCount ?? 0,
                                    sharesCount: post.sharesCount ?? 0,
                                    isLiked: lLikes[post.id] ?? false,
                                    isShared: lShares[post.id] ?? false,
                                }
                            }));
                            finalPosts = [...finalPosts, ...enrichedLegacy];
                        }
                    }
                    // Determine next cursor
                    // If we used fallback, the cursor logic is tricky. 
                    // Ideally, we should switch to legacy cursor if we exhausted feed.
                    // For now, if we have a feed cursor, return it. If not, and we have posts, use the last post ID fallback
                    // But verify if the last post came from Feed or Legacy?
                    // Simplification: If we fell back to legacy, we likely exhausted the 'FeedService' for this page.
                    let nextCursor = feedResponse.nextCursor;
                    if (!nextCursor && finalPosts.length > 0) {
                        nextCursor = finalPosts[finalPosts.length - 1].id;
                    }
                    return {
                        pages: finalPosts,
                        nextCursor: nextCursor ?? undefined,
                    };
                }
                catch (feedError) {
                    // If feed service fails, fall back to naive approach
                    logger_util_1.default.warn("Feed service error, falling back to naive query", {
                        error: feedError.message,
                        userId,
                    });
                    // Fall through to legacy implementation
                }
            }
            //  FALLBACK: Legacy naive query (for backwards compatibility or if feedService unavailable)
            //  FIX: Order by createdAt DESC to ensure newest posts appear first (UUIDs don't sort chronologically)
            // PAGE_SIZE is already defined at the top of the function
            //  FIX: Use offset-based pagination with createdAt ordering
            // If pageParam (post ID) is provided, find how many posts to skip based on createdAt
            let skipCount = 0;
            if (pageParam) {
                const cursorPost = await this._postRepository.findPost(pageParam);
                if (cursorPost && cursorPost.createdAt) {
                    // Count posts created after this one (newer posts) to determine skip count
                    skipCount = await this._postRepository.countPostsAfter(cursorPost.createdAt);
                }
            }
            const PostselectOptions = {
                include: {
                    Media: true, //  FIX: Changed from 'attachments' to 'Media' to match schema
                },
                take: PAGE_SIZE + 1,
                skip: skipCount,
                where: baseWhere,
                orderBy: { createdAt: "desc" }, //  CRITICAL FIX: Order by createdAt DESC for chronological ordering (UUIDs are not chronological!)
            };
            const prismaPosts = await this._postRepository.getPostsRepo(PostselectOptions);
            const hasMore = prismaPosts.length > PAGE_SIZE;
            const items = prismaPosts.slice(0, PAGE_SIZE);
            const postIds = items.map((post) => post.id);
            let userLikesMap = {};
            let userSharesMap = {};
            if (userId && postIds.length > 0) {
                userLikesMap =
                    (await this.likeRepository?.getUserLikesForPosts(userId, postIds)) ||
                        {};
                userSharesMap =
                    (await this.shareRepository?.getUserSharesForPosts(userId, postIds)) ||
                        {};
            }
            const enrichedPosts = items.map((post) => {
                //  FIX: Transform Media array to Attachments format
                const attachments = (post.Media || []).map((media) => ({
                    id: media.id,
                    postId: media.postId || post.id,
                    type: String(media.type || "IMAGE"),
                    url: media.url,
                    createdAt: media.createdAt ? new Date(media.createdAt).toISOString() : new Date().toISOString(),
                }));
                return {
                    ...post,
                    createdAt: post.createdAt.toISOString(),
                    updatedAt: post.updatedAt.toISOString(),
                    deletedAt: post.deletedAt ? post.deletedAt.toISOString() : null,
                    pinnedAt: post.pinnedAt ? post.pinnedAt.toISOString() : null,
                    editedAt: post.lastEditedAt ? post.lastEditedAt.toISOString() : null,
                    scheduledAt: null, // Field not in current Prisma model
                    attachments,
                    user: post.user ? { ...post.user, id: post.userId } : { id: post.userId, username: "Unknown", name: "Unknown", avatar: "" },
                    engagement: {
                        likesCount: post.likesCount ?? 0,
                        commentsCount: post.commentsCount ?? 0,
                        sharesCount: post.sharesCount ?? 0,
                        isLiked: userLikesMap[post.id] ?? false,
                        isShared: userSharesMap[post.id] ?? false,
                    },
                };
            });
            //  FIX: Use post ID as cursor (for next page pagination)
            const nextCursor = hasMore ? enrichedPosts[enrichedPosts.length - 1].id : undefined;
            return {
                pages: enrichedPosts,
                nextCursor,
            };
        }
        catch (err) {
            throw new error_util_1.CustomError(http_status_1.HttpStatus.INTERNAL_SERVER_ERROR, err.message);
        }
    }
    async deletePostServ(postId) {
        try {
            const isthere = await this._postRepository.findPost(postId);
            if (!isthere) {
                throw new error_util_1.CustomError(http_status_1.HttpStatus.NOT_FOUND, "Post Not found");
            }
            // 1. Get media IDs before deletion for cleanup saga
            const mediaIds = await this._postRepository.getMediaIds(postId);
            const deletedPost = await this._postRepository.deletePost(postId);
            // 2. Remove post from all user feeds
            if (this.feedService) {
                try {
                    await this.feedService.removeFromAllFeeds(postId);
                }
                catch (feedError) {
                    logger_util_1.default.error("Error removing post from feeds (non-fatal)", {
                        error: feedError.message,
                        postId,
                    });
                }
            }
            // 3. Publish POST_DELETED event for Media Service cleanup
            if (this.outboxService && mediaIds.length > 0) {
                try {
                    await this.outboxService.createOutboxEvent({
                        aggregateType: client_1.OutboxAggregateType.POST,
                        aggregateId: postId,
                        type: "POST_DELETED", // Cast if enum not updated yet
                        topic: kafka_config_1.KAFKA_TOPICS.POST_DELETED,
                        key: isthere.userId, // Use userId as partition key
                        payload: {
                            postId,
                            userId: isthere.userId,
                            mediaIds,
                            action: "POST_DELETED",
                            timestamp: new Date().toISOString(),
                        },
                    });
                    logger_util_1.default.info("Outbox event created: POST_DELETED", { postId, mediaCount: mediaIds.length });
                }
                catch (eventError) {
                    logger_util_1.default.error("Error creating POST_DELETED event", {
                        error: eventError.message,
                        postId,
                    });
                }
            }
            return deletedPost;
        }
        catch (err) {
            logger_util_1.default.error("delete Post error", { error: err.message });
            throw new error_util_1.CustomError(http_status_1.HttpStatus.INTERNAL_SERVER_ERROR, err.message);
        }
    }
    async editPost(req) {
        try {
            // 1. Get post
            const post = await this._postRepository.findPost(req.postId);
            if (!post) {
                throw new error_util_1.CustomError(http_status_1.HttpStatus.NOT_FOUND, "Post not found");
            }
            // 2. Authorization: Only owner can edit
            if (post.userId !== req.userId) {
                throw new error_util_1.CustomError(http_status_1.HttpStatus.FORBIDDEN, "Unauthorized: Only post owner can edit");
            }
            // 3. Check if post is locked (attachments processing)
            if (post.isEditing) {
                throw new error_util_1.CustomError(http_status_1.HttpStatus.BAD_REQUEST, "Post is currently being edited. Please wait.");
            }
            // 4. Lock post for editing
            await this._postRepository.lockForEditing(req.postId);
            try {
                // 5. Validate attachments if adding
                if (req.addAttachmentIds && req.addAttachmentIds.length > 0) {
                    const existingMedia = await this._postRepository.findMediaByIds(req.addAttachmentIds);
                    if (existingMedia.length !== req.addAttachmentIds.length) {
                        throw new error_util_1.CustomError(http_status_1.HttpStatus.NOT_FOUND, "One or more media files not found");
                    }
                }
                // 6. Create new version (transaction via repository)
                // The instruction implies `updatePostWithVersions` is a method of `this` (the service),
                // but the original code calls `_postRepository.updatePostWithVersions`.
                // I will assume the instruction intends to refactor `updatePostWithVersions` to be a service method,
                // or that the instruction is slightly misaligned with the current structure.
                // For now, I will keep the repository call for versioning and add a separate update for non-versioned fields.
                // First, update versioned fields (content, attachments)
                const result = await this._postRepository.updatePostWithVersions({
                    postId: req.postId,
                    userId: req.userId,
                    newContent: req.content ?? post.content, // Use new content if provided, otherwise keep existing
                    addAttachmentIds: req.addAttachmentIds,
                    removeAttachmentIds: req.removeAttachmentIds,
                    versionRepository: this.postVersionRepository
                });
                // Then, update non-versioned fields (visibility, commentControl)
                const updateData = {};
                if (req.visibility !== undefined) {
                    updateData.visibility = req.visibility;
                }
                if (req.commentControl !== undefined) {
                    updateData.commentControl = req.commentControl;
                }
                let updatedPost = post; // Start with the original post
                if (Object.keys(updateData).length > 0) {
                    updatedPost = await this._postRepository.updatePost(req.postId, updateData);
                }
                // 7. Invalidate caches
                await redis_util_1.RedisCacheService.invalidatePostCaches(req.postId);
                return {
                    success: true,
                    post: post_mapper_1.PostMapper.toGrpcPost(updatedPost),
                    newVersionNumber: result.versionNumber,
                };
            }
            catch (error) {
                // Unlock on error
                await this._postRepository.unlockEditing(req.postId);
                throw error;
            }
        }
        catch (err) {
            logger_util_1.default.error("Error editing post", {
                error: err.message,
                postId: req.postId,
                userId: req.userId,
            });
            throw err instanceof error_util_1.CustomError
                ? err
                : new error_util_1.CustomError(http_status_1.HttpStatus.INTERNAL_SERVER_ERROR, "Failed to edit post");
        }
    }
    async getPostVersions(req) {
        try {
            // Verify ownership
            const post = await this._postRepository.findPost(req.postId);
            if (!post || post.userId !== req.userId) {
                throw new error_util_1.CustomError(http_status_1.HttpStatus.FORBIDDEN, "Unauthorized");
            }
            if (!this.postVersionRepository) {
                throw new error_util_1.CustomError(http_status_1.HttpStatus.INTERNAL_SERVER_ERROR, "Post version repository not available");
            }
            const versions = await this.postVersionRepository.getByPostId(req.postId);
            return {
                versions: versions.map((v) => ({
                    id: v.id,
                    postId: v.postId,
                    versionNumber: v.versionNumber,
                    content: v.content,
                    attachmentIds: v.attachmentIds,
                    editedAt: v.editedAt.toISOString(),
                    editedById: v.editedById,
                })),
            };
        }
        catch (err) {
            logger_util_1.default.error("Error getting post versions", {
                error: err.message,
                postId: req.postId,
            });
            throw err instanceof error_util_1.CustomError
                ? err
                : new error_util_1.CustomError(http_status_1.HttpStatus.INTERNAL_SERVER_ERROR, "Failed to get post versions");
        }
    }
    async restorePostVersion(req) {
        try {
            if (!this.postVersionRepository) {
                throw new error_util_1.CustomError(http_status_1.HttpStatus.INTERNAL_SERVER_ERROR, "Post version repository not available");
            }
            // Get version
            const version = await this.postVersionRepository.getByPostAndVersion(req.postId, req.versionNumber);
            if (!version) {
                throw new error_util_1.CustomError(http_status_1.HttpStatus.NOT_FOUND, "Version not found");
            }
            // Verify ownership
            const post = await this._postRepository.findPost(req.postId);
            if (!post || post.userId !== req.userId) {
                throw new error_util_1.CustomError(http_status_1.HttpStatus.FORBIDDEN, "Unauthorized");
            }
            // Restore (create new version with old content)
            // Note: Visibility and commentControl are not versioned, so they are not restored from the version.
            // They will remain as they are on the current post.
            const editResult = await this.editPost({
                postId: req.postId,
                userId: req.userId,
                content: version.content,
                addAttachmentIds: version.attachmentIds,
                removeAttachmentIds: [],
                // visibility and commentControl are not part of the version, so they are not passed here.
                // The editPost method will only update them if explicitly provided.
                idempotencyKey: `restore-${req.postId}-${req.versionNumber}`,
            });
            return {
                success: true,
                post: editResult.post,
            };
        }
        catch (err) {
            logger_util_1.default.error("Error restoring post version", {
                error: err.message,
                postId: req.postId,
                versionNumber: req.versionNumber,
            });
            throw err instanceof error_util_1.CustomError
                ? err
                : new error_util_1.CustomError(http_status_1.HttpStatus.INTERNAL_SERVER_ERROR, "Failed to restore post version");
        }
    }
    async getPostById(postId, userId) {
        try {
            // 1. Fetch post with Media
            const post = await this._postRepository.findPostWithMedia(postId);
            if (!post) {
                throw new error_util_1.CustomError(http_status_1.HttpStatus.NOT_FOUND, "Post not found");
            }
            // 2. Fetch user information
            const user = await new Promise((resolve) => {
                grpc_client_1.userClient.getUserForFeedListing({ userId: post.userId }, (err, response) => {
                    if (err) {
                        resolve({ id: post.userId, username: "Unknown", name: "Unknown", avatar: "" });
                    }
                    else {
                        resolve({
                            id: post.userId,
                            name: response.name,
                            username: response.username,
                            avatar: response.avatar,
                        });
                    }
                });
            });
            // 3. Check if current user liked/shared
            let isLiked = false;
            let isShared = false;
            if (userId) {
                const [likes, shares] = await Promise.all([
                    this.likeRepository?.getUserLikesForPosts(userId, [postId]) || Promise.resolve({}),
                    this.shareRepository?.getUserSharesForPosts(userId, [postId]) || Promise.resolve({})
                ]);
                isLiked = !!likes[postId];
                isShared = !!shares[postId];
            }
            // 4. Map attachments
            const attachments = (post.Media || []).map((media) => ({
                id: media.id,
                postId: media.postId || post.id,
                type: String(media.type || "IMAGE"),
                url: media.url,
                createdAt: media.createdAt ? new Date(media.createdAt).toISOString() : new Date().toISOString(),
            }));
            // 5. Return enriched post
            return {
                ...post,
                createdAt: post.createdAt.toISOString(),
                updatedAt: post.updatedAt.toISOString(),
                deletedAt: post.deletedAt ? post.deletedAt.toISOString() : null,
                pinnedAt: post.pinnedAt ? post.pinnedAt.toISOString() : null,
                editedAt: post.lastEditedAt ? post.lastEditedAt.toISOString() : null,
                attachments,
                user,
                engagement: {
                    likesCount: post.likesCount,
                    commentsCount: post.commentsCount,
                    sharesCount: post.sharesCount,
                    isLiked,
                    isShared,
                },
            };
        }
        catch (error) {
            if (error instanceof error_util_1.CustomError)
                throw error;
            logger_util_1.default.error("Error fetching post by ID", {
                error: error.message,
                postId,
            });
            throw new error_util_1.CustomError(http_status_1.HttpStatus.INTERNAL_SERVER_ERROR, "Internal server error");
        }
    }
    /**
     * Helper: Construct privacy filter based on viewer's relationship with authors
     */
    async _getVisibilityFilter(viewerId) {
        if (!viewerId) {
            // If not logged in, only see PUBLIC posts
            return { visibility: client_1.Visibility.PUBLIC };
        }
        // Get connections/followers from User Service to filter CONNECTIONS posts
        let connectionIds = [];
        try {
            const response = await (0, grpc_client_call_util_1.grpcs)(grpc_client_1.userClient, "getFollowers", { userId: viewerId });
            connectionIds = (response.followers || []).map(f => f.id);
        }
        catch (error) {
            logger_util_1.default.error("Failed to fetch connections for visibility filtering", {
                viewerId,
                error: error.message
            });
            // Continue with empty list - better to hide private posts than expose them on error
        }
        return {
            OR: [
                { visibility: client_1.Visibility.PUBLIC },
                { userId: viewerId }, // Always see own posts
                {
                    AND: [
                        { visibility: client_1.Visibility.CONNECTIONS },
                        { userId: { in: connectionIds } }
                    ]
                }
            ]
        };
    }
}
exports.PostService = PostService;
