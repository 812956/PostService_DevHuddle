import { Request, Response, NextFunction } from "express";
import { ICommentService } from "../../services/interfaces/ICommentService";
import { CustomError } from "../../utils/error.util";
import { HttpStatus } from "../../constands/http.status";
import { Messages } from "../../constands/reqresMessages";
import logger from "../../utils/logger.util";
import { getUserIdFromRequest } from "../../utils/request.util";

export class CommentController {
  constructor(private _commentService: ICommentService) {}

  async createComment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { postId } = req.params;
      const { content, parentCommentId } = req.body;
      const userId = getUserIdFromRequest(req);

      if (!postId) {
        throw new CustomError(HttpStatus.BAD_REQUEST, Messages.POST_ID_REQUIRED);
      }

      if (!content || typeof content !== "string" || content.trim().length === 0) {
        throw new CustomError(HttpStatus.BAD_REQUEST, Messages.COMMENT_CONTENT_REQUIRED);
      }

      const comment = await this._commentService.createComment(
        postId,
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


  async updateComment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { commentId } = req.params;
      const { content } = req.body;
      const userId = getUserIdFromRequest(req);

      if (!commentId) {
        throw new CustomError(HttpStatus.BAD_REQUEST, Messages.COMMENT_ID_REQUIRED);
      }

      if (!content || typeof content !== "string" || content.trim().length === 0) {
        throw new CustomError(HttpStatus.BAD_REQUEST, Messages.COMMENT_CONTENT_REQUIRED);
      }

      const comment = await this._commentService.updateComment(commentId, userId, content);

      res.status(HttpStatus.OK).json({
        success: true,
        message: Messages.COMMENT_UPDATED_SUCCESS,
        data: comment,
      });
    } catch (error: any) {
      next(error);
    }
  }
  
  async deleteComment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { commentId } = req.params;
      const userId = getUserIdFromRequest(req);

      if (!commentId) {
        throw new CustomError(HttpStatus.BAD_REQUEST, Messages.COMMENT_ID_REQUIRED);
      }

      await this._commentService.deleteComment(commentId, userId);

      res.status(HttpStatus.OK).json({
        success: true,
        message: Messages.COMMENT_DELETED_SUCCESS,
      });
    } catch (error: any) {
      next(error);
    }
  }
  
  async getComments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { postId } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      if (!postId) {
        throw new CustomError(HttpStatus.BAD_REQUEST, Messages.POST_ID_REQUIRED);
      }

      const comments = await this._commentService.getComments(postId, limit, offset);

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

  async getCommentCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { postId } = req.params;

      if (!postId) {
        throw new CustomError(HttpStatus.BAD_REQUEST, Messages.POST_ID_REQUIRED);
      }

      const count = await this._commentService.getCommentCount(postId);

      res.status(HttpStatus.OK).json({
        success: true,
        count,
      });
    } catch (error: any) {
      next(error);
    }
  }

}