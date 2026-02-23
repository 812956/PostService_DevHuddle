"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostController = void 0;
const error_util_1 = require("../../utils/error.util");
const logger_util_1 = __importDefault(require("../../utils/logger.util"));
const http_status_1 = require("../../constands/http.status");
const request_util_1 = require("../../utils/request.util");
class PostController {
    constructor(_postService) {
        this._postService = _postService;
    }
    async submitPostController(req) {
        try {
            const post = await this._postService.submitPost(req);
            return post;
        }
        catch (err) {
            logger_util_1.default.error("CreatePost error", { error: err.message });
            throw new error_util_1.CustomError(http_status_1.HttpStatus.INTERNAL_SERVER_ERROR, err.message);
        }
    }
    async getPostsController(req) {
        try {
            const { pageParam, userId, limit } = req;
            const result = await this._postService.getPosts(pageParam, userId, undefined, // authorId
            undefined, // sortBy
            limit);
            return result;
        }
        catch (err) {
            logger_util_1.default.error("List posts error", { error: err.message });
            throw new error_util_1.CustomError(http_status_1.HttpStatus.INTERNAL_SERVER_ERROR, err.message);
        }
    }
    async deletePostController(req) {
        try {
            const { postId } = req;
            const deletePost = await this._postService.deletePostServ(postId);
            return deletePost;
        }
        catch (err) {
            logger_util_1.default.error("delete Post error", { error: err.message });
            throw new error_util_1.CustomError(http_status_1.HttpStatus.INTERNAL_SERVER_ERROR, err.message);
        }
    }
    // ============================================
    // HTTP Controller Methods (for Express routes)
    // ============================================
    async submitPostHttp(req, res) {
        try {
            // Extract userId from headers (set by API Gateway JWT middleware)
            const userId = (0, request_util_1.getUserIdFromRequest)(req);
            if (!userId) {
                throw new error_util_1.CustomError(http_status_1.HttpStatus.UNAUTHORIZED, "Unauthorized");
            }
            // Build SubmitPostRequest with userId from headers and body data
            const submitRequest = {
                content: req.body.content || "",
                userId: userId,
                mediaIds: req.body.mediaIds || [],
                visibility: req.body.visibility || "PUBLIC",
                commentControl: req.body.commentControl || "ANYONE",
            };
            // Validate required fields
            // Validate required fields
            // Validation handled by DTO
            logger_util_1.default.info("Submitting post", {
                userId: submitRequest.userId,
                contentLength: submitRequest.content.length,
                mediaCount: submitRequest.mediaIds?.length || 0,
                visibility: submitRequest.visibility,
            });
            const response = await this.submitPostController(submitRequest);
            logger_util_1.default.info("Post submitted successfully", {
                postId: response.id,
                userId: response.userId,
            });
            res.status(http_status_1.HttpStatus.OK).json({ success: true, data: response });
        }
        catch (err) {
            logger_util_1.default.error("Error in POST /api/v1/posts/submit", {
                error: err.message,
                stack: err.stack,
                body: req.body,
            });
            const statusCode = err.status || http_status_1.HttpStatus.INTERNAL_SERVER_ERROR;
            (0, error_util_1.sendErrorResponse)(res, {
                status: statusCode,
                message: err.message || "Server error",
            });
        }
    }
    async listPostsHttp(req, res) {
        try {
            logger_util_1.default.info("Received GET /api/v1/posts/list request", {
                query: req.query,
                hasUserHeader: !!req.headers["x-user-data"],
            });
            const pageParam = req.query?.cursor;
            const userId = req.query?.userId;
            const authorId = req.query?.authorId; // Get authorId from query
            const sortBy = req.query?.sortBy; // Get sortBy from query
            const limit = req.query?.limit ? parseInt(req.query.limit, 10) : undefined; // Get limit from query
            // Get userId from headers (set by API Gateway)
            const userIdFromHeader = req.headers["x-user-data"]
                ? JSON.parse(req.headers["x-user-data"])?.id
                : undefined;
            const finalUserId = userId || userIdFromHeader;
            logger_util_1.default.info("Fetching posts", {
                pageParam,
                finalUserId,
                authorId,
                sortBy,
                limit
            });
            // Call service directly to support authorId (bypassing strict gRPC request type)
            const response = await this._postService.getPosts(pageParam, finalUserId, authorId, sortBy, limit);
            logger_util_1.default.info("Posts fetched successfully", {
                postsCount: response?.pages?.length || 0,
                hasNextCursor: !!response?.nextCursor,
            });
            res.status(http_status_1.HttpStatus.OK).json({
                success: true,
                data: response,
            });
        }
        catch (err) {
            logger_util_1.default.error("Error in GET /api/v1/posts/list", {
                error: err.message,
                stack: err.stack,
            });
            const statusCode = err.status || http_status_1.HttpStatus.INTERNAL_SERVER_ERROR;
            (0, error_util_1.sendErrorResponse)(res, {
                status: statusCode,
                message: err.message || "Server error",
            });
        }
    }
    async deletePostHttp(req, res) {
        try {
            const postId = req.params.postId || req.body?.Id || req.body?.postId;
            if (!postId) {
                return (0, error_util_1.sendErrorResponse)(res, {
                    status: http_status_1.HttpStatus.BAD_REQUEST,
                    message: "Post ID is required",
                });
            }
            const response = await this.deletePostController({ postId });
            logger_util_1.default.info("Post deleted successfully", { postId });
            res.status(http_status_1.HttpStatus.OK).json({ success: true, deletedPost: response });
        }
        catch (err) {
            logger_util_1.default.error("Error in DELETE /api/v1/posts/:postId", {
                error: err.message,
                stack: err.stack,
                postId: req.params.postId || req.body?.Id || req.body?.postId,
            });
            const statusCode = err.status || http_status_1.HttpStatus.INTERNAL_SERVER_ERROR;
            (0, error_util_1.sendErrorResponse)(res, {
                status: statusCode,
                message: err.message || "Server error",
            });
        }
    }
    async deletePostFromBodyHttp(req, res) {
        try {
            const postId = req.body?.Id || req.body?.postId;
            if (!postId) {
                return (0, error_util_1.sendErrorResponse)(res, {
                    status: http_status_1.HttpStatus.BAD_REQUEST,
                    message: "Post ID is required in request body",
                });
            }
            const response = await this.deletePostController({ postId });
            logger_util_1.default.info("Post deleted successfully", { postId });
            res.status(http_status_1.HttpStatus.OK).json({ success: true, deletedPost: response });
        }
        catch (err) {
            logger_util_1.default.error("Error in DELETE /api/v1/posts/delete", {
                error: err.message,
                stack: err.stack,
                postId: req.body?.Id || req.body?.postId,
            });
            const statusCode = err.status || http_status_1.HttpStatus.INTERNAL_SERVER_ERROR;
            (0, error_util_1.sendErrorResponse)(res, {
                status: statusCode,
                message: err.message || "Server error",
            });
        }
    }
    async editPostHttp(req, res) {
        try {
            const postId = req.params.postId;
            if (!postId) {
                return (0, error_util_1.sendErrorResponse)(res, {
                    status: http_status_1.HttpStatus.BAD_REQUEST,
                    message: "Post ID is required",
                });
            }
            const userId = (0, request_util_1.getUserIdFromRequest)(req);
            if (!userId) {
                throw new error_util_1.CustomError(http_status_1.HttpStatus.UNAUTHORIZED, "Unauthorized");
            }
            // Extract idempotency key from headers (handle string | string[] | undefined)
            const headerValue = req.headers["idempotency-key"];
            // Use type assertion after ensuring value is properly extracted
            const idempotencyKey = ((typeof headerValue === "string" ? headerValue : Array.isArray(headerValue) ? headerValue[0] : undefined) || `edit-${postId}-${Date.now()}`);
            logger_util_1.default.info("Editing post", {
                postId,
                userId,
                idempotencyKey,
                body: req.body,
            });
            const response = await this._postService.editPost({
                postId,
                userId,
                content: req.body.content,
                addAttachmentIds: req.body.addAttachmentIds,
                removeAttachmentIds: req.body.removeAttachmentIds,
                idempotencyKey,
                visibility: req.body.visibility,
                commentControl: req.body.commentControl,
            });
            logger_util_1.default.info("Post edited successfully", {
                postId,
                version: response.newVersionNumber,
            });
            res.status(http_status_1.HttpStatus.OK).json({
                success: true,
                data: response.post,
            });
        }
        catch (err) {
            logger_util_1.default.error("Error in PATCH /api/v1/feed/posts/:postId", {
                error: err.message,
                stack: err.stack,
                postId: req.params.postId,
            });
            const statusCode = err.status || http_status_1.HttpStatus.INTERNAL_SERVER_ERROR;
            (0, error_util_1.sendErrorResponse)(res, {
                status: statusCode,
                message: err.message || "Server error",
            });
        }
    }
    async getPostByIdHttp(req, res) {
        try {
            const { postId } = req.params;
            if (!postId) {
                return (0, error_util_1.sendErrorResponse)(res, {
                    status: http_status_1.HttpStatus.BAD_REQUEST,
                    message: "Post ID is required",
                });
            }
            // Get requester userId from headers if available (for isLiked/isShared)
            const userIdFromHeader = req.headers["x-user-data"]
                ? JSON.parse(req.headers["x-user-data"])?.id
                : undefined;
            const response = await this._postService.getPostById(postId, userIdFromHeader);
            res.status(http_status_1.HttpStatus.OK).json({
                success: true,
                data: response,
            });
        }
        catch (err) {
            logger_util_1.default.error("Error in GET /api/v1/posts/:postId", {
                error: err.message,
                postId: req.params.postId,
            });
            const statusCode = err.status || http_status_1.HttpStatus.INTERNAL_SERVER_ERROR;
            (0, error_util_1.sendErrorResponse)(res, {
                status: statusCode,
                message: err.message || "Server error",
            });
        }
    }
}
exports.PostController = PostController;
