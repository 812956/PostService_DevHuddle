import { Request, Response } from "express";
import {
  CreatePostRequest,
  CreatePostResponse,
  DeletePostRequest,
  DeletePostResponse,
  ListPostsRequest,
  ListPostsResponse,
  SubmitPostRequest,
  SubmitPostResponse,
  UploadMediaRequest,
  UploadMediaResponse,
} from "../../grpc/generated/post";
import { IfeedController } from "../interfaces/IfeedController";
import { partial } from "zod/v4/core/util.cjs";
import { IpostService } from "../../services/interfaces/IpostService";
import { CustomError, sendErrorResponse } from "../../utils/error.util";
import { Messages } from "../../constands/reqresMessages";
import logger from "../../utils/logger.util";
import { HttpStatus } from "../../constands/http.status";
import { getUserIdFromRequest } from "../../utils/request.util";

export class PostController implements IfeedController {
  constructor(private _postService: IpostService) {}

  async submitPostController(
    req: SubmitPostRequest
  ): Promise<SubmitPostResponse> {
    try {
      const post = await this._postService.submitPost(req);
      return post;
    } catch (err: any) {
      logger.error("CreatePost error", { error: err.message });
      throw new CustomError(HttpStatus.INTERNAL_SERVER_ERROR, err.message);
    }
  }

  async getPostsController(req: ListPostsRequest): Promise<ListPostsResponse> {
    try {
      const { pageParam, userId, limit } = req;
      const result: ListPostsResponse = await this._postService.getPosts(
        pageParam as string | undefined,
        userId as string | undefined,
        undefined, // authorId
        undefined, // sortBy
        limit
      );

      return result;
    } catch (err: any) {
      logger.error("List posts error", { error: err.message });
      throw new CustomError(HttpStatus.INTERNAL_SERVER_ERROR, err.message);
    }
  }

  async deletePostController(
    req: DeletePostRequest
  ): Promise<DeletePostResponse> {
    try {
      const { postId } = req;
      const deletePost: DeletePostResponse =
        await this._postService.deletePostServ(postId as string);

      return deletePost;
    } catch (err: any) {
      logger.error("delete Post error", { error: err.message });
      throw new CustomError(HttpStatus.INTERNAL_SERVER_ERROR, err.message);
    }
  }

  // ============================================
  // HTTP Controller Methods (for Express routes)
  // ============================================

  async submitPostHttp(req: Request, res: Response): Promise<void> {
    try {
      // Extract userId from headers (set by API Gateway JWT middleware)
      const userId = getUserIdFromRequest(req);
      
      if (!userId) {
        throw new CustomError(HttpStatus.UNAUTHORIZED, "Unauthorized");
      }

      // Build SubmitPostRequest with userId from headers and body data
      const submitRequest: SubmitPostRequest = {
        content: req.body.content || "",
        userId: userId,
        mediaIds: req.body.mediaIds || [],
        visibility: req.body.visibility || "PUBLIC",
        commentControl: req.body.commentControl || "ANYONE",
      };

      // Validate required fields
      // Validate required fields
      // Validation handled by DTO

      logger.info("Submitting post", {
        userId: submitRequest.userId,
        contentLength: submitRequest.content.length,
        mediaCount: submitRequest.mediaIds?.length || 0,
        visibility: submitRequest.visibility,
      });

      const response = await this.submitPostController(submitRequest);
      
      logger.info("Post submitted successfully", {
        postId: response.id,
        userId: response.userId,
      });
      
      res.status(HttpStatus.OK).json({ success: true, data: response });
    } catch (err: any) {
      logger.error("Error in POST /api/v1/posts/submit", {
        error: err.message,
        stack: err.stack,
        body: req.body,
      });
      const statusCode = err.status || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: err.message || "Server error",
      });
    }
  }

  async listPostsHttp(req: Request, res: Response): Promise<void> {
    try {
      logger.info("Received GET /api/v1/posts/list request", {
        query: req.query,
        hasUserHeader: !!req.headers["x-user-data"],
      });
      
      const pageParam = req.query?.cursor as string | undefined;
      const userId = req.query?.userId as string | undefined;
      const authorId = req.query?.authorId as string | undefined; // Get authorId from query
      const sortBy = req.query?.sortBy as string | undefined; // Get sortBy from query
      const limit = req.query?.limit ? parseInt(req.query.limit as string, 10) : undefined; // Get limit from query
      
      // Get userId from headers (set by API Gateway)
      const userIdFromHeader = req.headers["x-user-data"]
        ? JSON.parse(req.headers["x-user-data"] as string)?.id
        : undefined;

      const finalUserId = userId || userIdFromHeader;
      
      logger.info("Fetching posts", {
        pageParam,
        finalUserId,
        authorId,
        sortBy,
        limit
      });

      // Call service directly to support authorId (bypassing strict gRPC request type)
      const response = await this._postService.getPosts(
        pageParam,
        finalUserId,
        authorId,
        sortBy,
        limit
      );

      logger.info("Posts fetched successfully", {
        postsCount: response?.pages?.length || 0,
        hasNextCursor: !!response?.nextCursor,
      });

      res.status(HttpStatus.OK).json({
        success: true,
        data: response,
      });
    } catch (err: any) {
      logger.error("Error in GET /api/v1/posts/list", {
        error: err.message,
        stack: err.stack,
      });
      const statusCode = err.status || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: err.message || "Server error",
      });
    }
  }

  async deletePostHttp(req: Request, res: Response): Promise<void> {
    try {
      const postId = req.params.postId || req.body?.Id || req.body?.postId;
      if (!postId) {
        return sendErrorResponse(res, {
          status: HttpStatus.BAD_REQUEST,
          message: "Post ID is required",
        });
      }
      const response = await this.deletePostController({ postId });
      logger.info("Post deleted successfully", { postId });
      res.status(HttpStatus.OK).json({ success: true, deletedPost: response });
    } catch (err: any) {
      logger.error("Error in DELETE /api/v1/posts/:postId", {
        error: err.message,
        stack: err.stack,
        postId: req.params.postId || req.body?.Id || req.body?.postId,
      });
      const statusCode = err.status || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: err.message || "Server error",
      });
    }
  }

  async deletePostFromBodyHttp(req: Request, res: Response): Promise<void> {
    try {
      const postId = req.body?.Id || req.body?.postId;
      if (!postId) {
        return sendErrorResponse(res, {
          status: HttpStatus.BAD_REQUEST,
          message: "Post ID is required in request body",
        });
      }
      const response = await this.deletePostController({ postId });
      logger.info("Post deleted successfully", { postId });
      res.status(HttpStatus.OK).json({ success: true, deletedPost: response });
    } catch (err: any) {
      logger.error("Error in DELETE /api/v1/posts/delete", {
        error: err.message,
        stack: err.stack,
        postId: req.body?.Id || req.body?.postId,
      });
      const statusCode = err.status || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: err.message || "Server error",
      });
    }
  }

  async editPostHttp(req: Request, res: Response): Promise<void> {
    try {
      const postId = req.params.postId as string;
      if (!postId) {
        return sendErrorResponse(res, {
          status: HttpStatus.BAD_REQUEST,
          message: "Post ID is required",
        });
      }

      const userId = getUserIdFromRequest(req);
      if (!userId) {
        throw new CustomError(HttpStatus.UNAUTHORIZED, "Unauthorized");
      }

      // Extract idempotency key from headers (handle string | string[] | undefined)
      const headerValue = req.headers["idempotency-key"];
      // Use type assertion after ensuring value is properly extracted
      const idempotencyKey = ((typeof headerValue === "string" ? headerValue : Array.isArray(headerValue) ? headerValue[0] : undefined) || `edit-${postId}-${Date.now()}`) as string;

      logger.info("Editing post", {
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

      logger.info("Post edited successfully", {
        postId,
        version: response.newVersionNumber,
      });

      res.status(HttpStatus.OK).json({
        success: true,
        data: response.post,
      });
    } catch (err: any) {
      logger.error("Error in PATCH /api/v1/feed/posts/:postId", {
        error: err.message,
        stack: err.stack,
        postId: req.params.postId,
      });
      const statusCode = err.status || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: err.message || "Server error",
      });
    }
  }

  async getPostByIdHttp(req: Request, res: Response): Promise<void> {
    try {
      const { postId } = req.params as { postId: string };
      
      if (!postId) {
        return sendErrorResponse(res, {
          status: HttpStatus.BAD_REQUEST,
          message: "Post ID is required",
        });
      }

      // Get requester userId from headers if available (for isLiked/isShared)
      const userIdFromHeader = req.headers["x-user-data"]
        ? JSON.parse(req.headers["x-user-data"] as string)?.id
        : undefined;

      const response = await this._postService.getPostById(postId, userIdFromHeader);

      res.status(HttpStatus.OK).json({
        success: true,
        data: response,
      });
    } catch (err: any) {
      logger.error("Error in GET /api/v1/posts/:postId", {
        error: err.message,
        postId: req.params.postId,
      });
      const statusCode = err.status || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: err.message || "Server error",
      });
    }
  }
}
