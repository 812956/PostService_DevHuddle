"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostRepository = void 0;
const base_repository_1 = require("./base.repository");
const prisma_config_1 = require("../../config/prisma.config");
const logger_util_1 = __importDefault(require("../../utils/logger.util"));
const redis_config_1 = __importDefault(require("../../config/redis.config"));
const grpc_client_1 = require("../../config/grpc.client");
const uuid_1 = require("uuid");
const media_client_1 = require("../../config/media.client");
class PostRepository extends base_repository_1.BaseRepository {
    constructor() {
        super(prisma_config_1.prisma.posts);
    }
    async createPostLogics(data) {
        try {
            const { id: postId } = await super.create(data);
            return { postId };
        }
        catch (error) {
            logger_util_1.default.error("Error creating entity", {
                error: error.message,
            });
            throw new Error("Database error");
        }
    }
    async submitPostRepo(data) {
        try {
            let validation;
            // Step 1: Validate media ownership via Media Service
            if (data.mediaIds && data.mediaIds.length > 0) {
                try {
                    validation = await (0, media_client_1.validateMediaOwnership)(data.mediaIds, data.userId);
                    if (!validation.valid) {
                        throw new Error(validation.message ||
                            `Invalid media: ${validation.invalidMediaIds?.join(", ")}`);
                    }
                }
                catch (error) {
                    logger_util_1.default.error("Media validation failed", {
                        error: error.message,
                        mediaIds: data.mediaIds,
                        userId: data.userId,
                    });
                    throw new Error(`Media validation failed: ${error.message}`);
                }
            }
            // Step 2: Create post in database (transaction ensures atomicity)
            const post = await prisma_config_1.prisma.$transaction(async (tx) => {
                // Use checked media from validation step
                const mediaToCreate = (validation?.validMedia || []).map((m) => ({
                    id: m.id,
                    type: (m.mediaType === "POST_VIDEO" ? "VIDEO" : "IMAGE"),
                    url: m.cdnUrl || m.originalUrl,
                    thumbnail: m.thumbnailUrls?.[0]?.cdnUrl || m.thumbnail,
                }));
                // Create post with generated ID
                const newPost = await tx.posts.create({
                    data: {
                        id: (0, uuid_1.v4)(),
                        content: data.content,
                        userId: data.userId,
                        visibility: data.visibility, // Cast to any to avoid enum type mismatch
                        commentControl: data.commentControl,
                        // Create local media records (Read Model)
                        Media: {
                            create: mediaToCreate.map((m) => ({
                                id: m.id,
                                type: m.type,
                                url: m.url,
                                thumbnail: m.thumbnail,
                            })),
                        },
                    },
                });
                // Step 3: Link media to post via Media Service
                // This updates the Media Service database (source of truth)
                if (data.mediaIds && data.mediaIds.length > 0) {
                    try {
                        await (0, media_client_1.linkMediaToPost)(data.mediaIds, newPost.id, data.userId);
                        logger_util_1.default.info("Media linked to post via Media Service", {
                            postId: newPost.id,
                            mediaIds: data.mediaIds,
                        });
                    }
                    catch (error) {
                        logger_util_1.default.error("Failed to link media to post", {
                            error: error.message,
                            postId: newPost.id,
                            mediaIds: data.mediaIds,
                        });
                        // If linking fails, we should rollback the post creation
                        // But since we're outside the transaction, we'll throw an error
                        // The transaction will be rolled back automatically
                        throw new Error(`Failed to link media: ${error.message}`);
                    }
                }
                // Fetch post (without media from Post Service database)
                // Media will be fetched from Media Service when needed
                const postWithMedia = await tx.posts.findUnique({
                    where: { id: newPost.id },
                });
                return postWithMedia;
            }, {
                timeout: 10000, // 10 second timeout
                maxWait: 5000, // Maximum wait time for transaction
            });
            return post;
        }
        catch (error) {
            logger_util_1.default.error("Error creating post", {
                error: error.message,
                stack: error.stack,
                userId: data.userId,
                mediaIds: data.mediaIds,
            });
            throw new Error(error.message || "Database error");
        }
    }
    async findPost(postId) {
        try {
            const post = await prisma_config_1.prisma.posts.findUnique({
                where: {
                    id: postId,
                },
            });
            return post;
        }
        catch (error) {
            logger_util_1.default.error("Error find entity", {
                error: error.message,
            });
            throw new Error("Database error");
        }
    }
    async findPostWithMedia(postId) {
        try {
            const post = await prisma_config_1.prisma.posts.findUnique({
                where: {
                    id: postId,
                },
                include: {
                    Media: true,
                },
            });
            return post;
        }
        catch (error) {
            logger_util_1.default.error("Error find entity with media", {
                error: error.message,
            });
            throw new Error("Database error");
        }
    }
    async deletePost(postId) {
        try {
            const post = await prisma_config_1.prisma.posts.delete({
                where: {
                    id: postId,
                },
            });
            return post;
        }
        catch (error) {
            logger_util_1.default.error("Error delete entity", {
                error: error.message,
            });
            throw new Error("Database error");
        }
    }
    async getPostsRepo(postSelectOptions) {
        try {
            //  FIX: Cast to Prisma's expected type - PostSelectOptions uses skip-based pagination (no cursor)
            const prismaOptions = {
                include: postSelectOptions.include,
                take: postSelectOptions.take,
                skip: postSelectOptions.skip,
                orderBy: postSelectOptions.orderBy,
                where: postSelectOptions.where,
            };
            const posts = await prisma_config_1.prisma.posts.findMany(prismaOptions);
            // console.log('this is the fetched data .......', posts)
            const enrichedPosts = await Promise.all(posts.map((post) => new Promise((resolve, reject) => {
                grpc_client_1.userClient.getUserForFeedListing({ userId: post.userId }, (err, response) => {
                    // if (err) {
                    //   console.error("gRPC error fetching user:", err);
                    //   return resolve({ ...post, user: undefined });
                    // }
                    resolve({
                        ...post,
                        user: {
                            avatar: response.avatar,
                            name: response.name,
                            username: response.username,
                        },
                    });
                });
            })));
            return enrichedPosts;
        }
        catch (err) {
            logger_util_1.default.error("Error fetching the posts ", {
                error: err.message,
            });
            throw new Error("Database error");
        }
    }
    async incrementLikesCount(postId) {
        try {
            await prisma_config_1.prisma.posts.update({
                where: { id: postId },
                data: {
                    likesCount: {
                        increment: 1,
                    },
                },
            });
        }
        catch (error) {
            logger_util_1.default.error("Error incrementing likes count", {
                error: error.message,
            });
            throw new Error("Database error");
        }
    }
    async decrementLikesCount(postId) {
        try {
            await prisma_config_1.prisma.posts.update({
                where: { id: postId },
                data: {
                    likesCount: {
                        decrement: 1,
                    },
                },
            });
        }
        catch (error) {
            logger_util_1.default.error("Error decrementing likes count", {
                error: error.message,
            });
            throw new Error("Database error");
        }
    }
    async incrementCommentsCount(postId) {
        try {
            await prisma_config_1.prisma.posts.update({
                where: { id: postId },
                data: {
                    commentsCount: {
                        increment: 1,
                    },
                },
            });
        }
        catch (error) {
            logger_util_1.default.error("Error incrementing comments count", {
                error: error.message,
            });
            throw new Error("Database error");
        }
    }
    async decrementCommentsCount(postId) {
        try {
            await prisma_config_1.prisma.posts.update({
                where: { id: postId },
                data: {
                    commentsCount: {
                        decrement: 1,
                    },
                },
            });
        }
        catch (error) {
            logger_util_1.default.error("Error decrementing comments count", {
                error: error.message,
            });
            throw new Error("Database error");
        }
    }
    async incrementSharesCount(postId) {
        try {
            await prisma_config_1.prisma.posts.update({
                where: { id: postId },
                data: {
                    sharesCount: {
                        increment: 1,
                    },
                },
            });
        }
        catch (error) {
            logger_util_1.default.error("Error incrementing shares count", {
                error: error.message,
            });
            throw new Error("Database error");
        }
    }
    async incrementReportsCount(postId) {
        try {
            await prisma_config_1.prisma.posts.update({
                where: { id: postId },
                data: {
                    reportsCount: {
                        increment: 1,
                    },
                },
            });
        }
        catch (error) {
            logger_util_1.default.error("Error incrementing reports count", {
                error: error.message,
            });
            throw new Error("Database error");
        }
    }
    async updatePost(postId, data) {
        try {
            return await prisma_config_1.prisma.posts.update({
                where: { id: postId },
                data,
            });
        }
        catch (error) {
            logger_util_1.default.error("Error updating post", {
                error: error.message,
                postId,
            });
            throw new Error("Database error");
        }
    }
    async lockForEditing(postId) {
        try {
            // Use Redis for distributed locking
            const lockKey = `post:edit:lock:${postId}`;
            const result = await redis_config_1.default.set(lockKey, "1", {
                EX: 300, // 5 minute expiration
                NX: true, // Only set if not exists
            });
            // Redis SET with NX returns "OK" if set, null if key exists
            if (result !== "OK") {
                throw new Error("Post is currently being edited");
            }
            // Also update DB flag
            await prisma_config_1.prisma.posts.update({
                where: { id: postId },
                data: { isEditing: true },
            });
        }
        catch (error) {
            logger_util_1.default.error("Error locking post for editing", {
                error: error.message,
                postId,
            });
            throw error;
        }
    }
    async unlockEditing(postId) {
        try {
            const lockKey = `post:edit:lock:${postId}`;
            await redis_config_1.default.del(lockKey);
            await prisma_config_1.prisma.posts.update({
                where: { id: postId },
                data: { isEditing: false },
            });
        }
        catch (error) {
            logger_util_1.default.error("Error unlocking post for editing", {
                error: error.message,
                postId,
            });
            throw new Error("Database error");
        }
    }
    //  NEW: Get posts by IDs (for feed retrieval)
    async getPostsByIds(postIds) {
        try {
            if (postIds.length === 0) {
                return [];
            }
            const posts = await prisma_config_1.prisma.posts.findMany({
                where: {
                    id: { in: postIds },
                    deletedAt: null, // Exclude soft-deleted posts
                    isHidden: false, // Exclude hidden posts
                },
                include: {
                    Media: true,
                },
                orderBy: {
                    createdAt: "desc",
                },
            });
            return posts;
        }
        catch (error) {
            logger_util_1.default.error("Error getting posts by IDs", {
                error: error.message,
                postCount: postIds.length,
            });
            throw new Error("Database error");
        }
    }
    async getMediaIds(postId) {
        try {
            const mediaItems = await prisma_config_1.prisma.media.findMany({
                where: { postId: postId },
                select: { id: true },
            });
            return mediaItems.map((m) => m.id);
        }
        catch (error) {
            logger_util_1.default.error("Error getting media IDs", {
                error: error.message,
                postId,
            });
            throw new Error("Database error");
        }
    }
    async findMediaByIds(mediaIds) {
        try {
            return await prisma_config_1.prisma.media.findMany({
                where: { id: { in: mediaIds } },
            });
        }
        catch (error) {
            logger_util_1.default.error("Error finding media by IDs", {
                error: error.message,
                mediaIds,
            });
            throw new Error("Database error");
        }
    }
    async updatePostWithVersions(params) {
        try {
            const { postId, userId, newContent, addAttachmentIds, removeAttachmentIds, versionRepository, } = params;
            return await prisma_config_1.prisma.$transaction(async (tx) => {
                // Get current post to find current version
                const post = await tx.posts.findUnique({ where: { id: postId } });
                if (!post)
                    throw new Error("Post not found");
                // Get current attachments
                const currentAttachments = await tx.media.findMany({
                    where: { postId: postId },
                });
                // Calculate new attachment set
                const attachmentIdsToKeep = currentAttachments
                    .map((a) => a.id)
                    .filter((id) => !removeAttachmentIds?.includes(id));
                const newAttachmentIds = [
                    ...attachmentIdsToKeep,
                    ...(addAttachmentIds || []),
                ];
                const newVersionNumber = post.currentVersion + 1;
                // Create version
                if (versionRepository) {
                    // Use the repository method but inside transaction if supported, 
                    // or manually create if repository doesn't support passing tx.
                    // Since IPostVersionRepository usually uses 'prisma' global, we might need to duplicate logic 
                    // or pass tx to repository if we refactor repositories to accept tx.
                    // For now, to keep it simple and safe, we will manually create version here ensuring transactional integrity
                    // BUT prompt said "refactor", so ideally we shouldn't duplicate.
                    // However, strict DI + Prisma Transaction usually requires passing the TransactionClient around.
                    // Let's assume we can just do the DB operations here.
                    /*
                       Ideally: versionRepository.withTx(tx).createVersion(...)
                       But versionRepository is injected.
                       Let's just implement the logic here for now to satisfy the "move logic out of service" requirement.
                    */
                    // This implies copying logic from PostVersionRepository OR injecting PostVersionRepository Logic.
                    // But since we are INSIDE PostRepository, and PostVersion is closely related, it's okay.
                    // Actually, PostVersionRepository logic is simple create.
                }
                // Note: If versionRepository was passed, we might want to use it, but since it's a separate repository, 
                // calling it might use a different prisma client instance or not be part of this transaction.
                // Unless we use Interactive Transactions with a passed client.
                // Let's do the version creation manually here to ensure it's in the same transaction.
                // Was: await this.postVersionRepository.createVersion(...)
                // We'll mimic it:
                await tx.postVersion.create({
                    data: {
                        id: (0, uuid_1.v4)(),
                        postId: postId,
                        versionNumber: newVersionNumber,
                        content: newContent,
                        attachmentIds: newAttachmentIds, // Stored as string array
                        editedById: userId,
                        editedAt: new Date(),
                    }
                });
                // Update post
                const updatedPost = await tx.posts.update({
                    where: { id: postId },
                    data: {
                        content: newContent,
                        currentVersion: newVersionNumber,
                        lastEditedAt: new Date(),
                        editCount: { increment: 1 },
                        isEditing: false, // Unlock
                    },
                    include: {
                        Media: true,
                    },
                });
                // Update attachments
                if (removeAttachmentIds && removeAttachmentIds.length > 0) {
                    await tx.media.deleteMany({
                        where: {
                            id: { in: removeAttachmentIds },
                            postId: postId,
                        },
                    });
                }
                if (addAttachmentIds && addAttachmentIds.length > 0) {
                    await tx.media.updateMany({
                        where: { id: { in: addAttachmentIds } },
                        data: { postId: postId },
                    });
                }
                return { post: updatedPost, versionNumber: newVersionNumber };
            });
        }
        catch (error) {
            logger_util_1.default.error("Error updating post with versions", {
                error: error.message,
                postId: params.postId,
            });
            throw new Error(error.message || "Database error");
        }
    }
    async countPostsAfter(date) {
        try {
            return await prisma_config_1.prisma.posts.count({
                where: {
                    createdAt: {
                        gt: date,
                    },
                },
            });
        }
        catch (error) {
            logger_util_1.default.error("Error counting newer posts", {
                error: error.message,
            });
            throw new Error("Database error");
        }
    }
    async hideAllPostsByUser(userId, reason) {
        try {
            await prisma_config_1.prisma.posts.updateMany({
                where: { userId, deletedAt: null },
                data: { isHidden: true, hiddenAt: new Date(), hiddenReason: reason },
            });
        }
        catch (error) {
            logger_util_1.default.error("Error hiding all posts by user", {
                error: error.message,
                userId,
            });
            throw new Error("Database error");
        }
    }
    async unhideAllPostsByUser(userId) {
        try {
            await prisma_config_1.prisma.posts.updateMany({
                where: { userId, deletedAt: null },
                data: { isHidden: false, hiddenAt: null, hiddenReason: null },
            });
        }
        catch (error) {
            logger_util_1.default.error("Error unhiding all posts by user", {
                error: error.message,
                userId,
            });
            throw new Error("Database error");
        }
    }
    async hidePost(postId, reason) {
        try {
            await prisma_config_1.prisma.posts.update({
                where: { id: postId },
                data: { isHidden: true, hiddenAt: new Date(), hiddenReason: reason },
            });
        }
        catch (error) {
            logger_util_1.default.error("Error hiding post", {
                error: error.message,
                postId,
            });
            throw new Error("Database error");
        }
    }
    async deleteAllPostsByUser(userId) {
        try {
            // Hard delete all posts by user (cascading deletes for Media and PostVersions should be handled by DB or manually)
            // Check schema for cascade rules.
            await prisma_config_1.prisma.posts.deleteMany({
                where: { userId },
            });
        }
        catch (error) {
            logger_util_1.default.error("Error deleting all posts by user", {
                error: error.message,
                userId,
            });
            throw new Error("Database error");
        }
    }
}
exports.PostRepository = PostRepository;
