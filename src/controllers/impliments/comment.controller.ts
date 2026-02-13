import { Request, Response, NextFunction } from "express";
import { ICommentService } from "../../services/interfaces/ICommentService";
import { CustomError } from "../../utils/error.util";
import { HttpStatus } from "../../constands/http.status";
import { Messages } from "../../constands/reqresMessages";
import logger from "../../utils/logger.util";
import { getUserIdFromRequest } from "../../utils/request.util";

export class CommentController {

  constructor(private _commentService: ICommentService) {}

  async createComment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { postId } = req.params;
      const { content, parentCommentId } = req.body;
      const userId = getUserIdFromRequest(req);

      if (!postId) {
        throw new CustomError(
          HttpStatus.BAD_REQUEST,
          Messages.POST_ID_REQUIRED
        );
      }

      // Validation handled by DTO

      const comment = await this._commentService.createComment(
        postId as string,
        userId,
        content,
        parentCommentId
      );

      res.status(HttpStatus.CREATED).json({
        success: true,
        message: Messages.COMMENT_CREATED_SUCCESS,
        data: comment,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async updateComment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { commentId } = req.params;
      const { content } = req.body;
      const userId = getUserIdFromRequest(req);

      if (!commentId) {
        throw new CustomError(
          HttpStatus.BAD_REQUEST,
          Messages.COMMENT_ID_REQUIRED
        );
      }

      // Validation handled by DTO

      const comment = await this._commentService.updateComment(
        commentId as string,
        userId,
        content
      );

      res.status(HttpStatus.OK).json({
        success: true,
        message: Messages.COMMENT_UPDATED_SUCCESS,
        data: comment,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async deleteComment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { commentId } = req.params;
      const userId = getUserIdFromRequest(req);

      if (!commentId) {
        throw new CustomError(
          HttpStatus.BAD_REQUEST,
          Messages.COMMENT_ID_REQUIRED
        );
      }

      await this._commentService.deleteComment(commentId as string, userId);

      res.status(HttpStatus.OK).json({
        success: true,
        message: Messages.COMMENT_DELETED_SUCCESS,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async getComments(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { postId } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const userId = getUserIdFromRequest(req);

      if (!postId) {
        throw new CustomError(
          HttpStatus.BAD_REQUEST,
          Messages.POST_ID_REQUIRED
        );
      }

      const comments = await this._commentService.getComments(
        postId as string,
        limit,
        offset,
        userId
      );

      res.status(HttpStatus.OK).json({
        success: true,
        data: comments,
        pagination: {
          limit,
          offset,
          count: comments.length,
        },
      });
    } catch (error: any) {
      next(error);
    }
  }

  async getCommentCount(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { postId } = req.params;

      if (!postId) {
        throw new CustomError(
          HttpStatus.BAD_REQUEST,
          Messages.POST_ID_REQUIRED
        );
      }

      const count = await this._commentService.getCommentCount(postId as string);

      res.status(HttpStatus.OK).json({
        success: true,
        count,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async getReplies(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { commentId } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;
      const userId = getUserIdFromRequest(req);

      if (!commentId) {
        throw new CustomError(HttpStatus.BAD_REQUEST, "Comment ID is required");
      }

      const replies = await this._commentService.getReplies(commentId as string, limit, userId);

      res.status(HttpStatus.OK).json({
        success: true,
        data: replies,
        pagination: {
          limit,
          count: replies.length,
        },
      });
    } catch (error: any) {
      next(error);
    }
  }

  async getCommentPreview(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { postId } = req.params;
      const userId = getUserIdFromRequest(req);

      if (!postId) {
        throw new CustomError(
          HttpStatus.BAD_REQUEST,
          Messages.POST_ID_REQUIRED
        );
      }

      const preview = await this._commentService.getCommentPreview(postId as string, userId);

      res.status(HttpStatus.OK).json({
        success: true,
        data: preview,
      });
    } catch (error: any) {
      next(error);
    }
  }
}
