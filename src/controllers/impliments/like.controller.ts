import { Request, Response, NextFunction } from "express";
import { ILikeService } from "../../services/interfaces/ILikeService";
import { CustomError } from "../../utils/error.util";
import { Messages } from "../../constands/reqresMessages";
import { HttpStatus } from "../../constands/http.status";
import logger from "../../utils/logger.util";
import { getUserIdFromRequest } from "../../utils/request.util";

export class LikeController {
  constructor(private _likeService: ILikeService) {}

  async likePost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { postId } = req.params;
      const userId = getUserIdFromRequest(req);

      if (!postId) {
        throw new CustomError(HttpStatus.BAD_REQUEST, Messages.POST_ID_REQUIRED);
      }

      await this._likeService.likePost(postId, userId);

      res.status(HttpStatus.CREATED).json({
        success: true,
        message: Messages.POST_LIKED_SUCCESS,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async unlikePost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { postId } = req.params;
      const userId = getUserIdFromRequest(req);

      if (!postId) {
        throw new CustomError(HttpStatus.BAD_REQUEST, Messages.POST_ID_REQUIRED);
      }

      await this._likeService.unlikePost(postId, userId);

      res.status(HttpStatus.OK).json({
        success: true,
        message: Messages.POST_UNLIKED_SUCCESS,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async likeComment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { commentId } = req.params;
      const userId = getUserIdFromRequest(req);

      if (!commentId) {
        throw new CustomError(HttpStatus.BAD_REQUEST, Messages.COMMENT_ID_REQUIRED);
      }

      await this._likeService.likeComment(commentId, userId);

      res.status(HttpStatus.CREATED).json({
        success: true,
        message: Messages.COMMENT_LIKED_SUCCESS,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async unlikeComment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { commentId } = req.params;
      const userId = getUserIdFromRequest(req);

      if (!commentId) {
        throw new CustomError(HttpStatus.BAD_REQUEST, Messages.COMMENT_ID_REQUIRED);
      }

      await this._likeService.unlikeComment(commentId, userId);

      res.status(HttpStatus.OK).json({
        success: true,
        message: Messages.COMMENT_UNLIKED_SUCCESS,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async getPostLikeCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { postId } = req.params;

      if (!postId) {
        throw new CustomError(HttpStatus.BAD_REQUEST, Messages.POST_ID_REQUIRED);
      }

      const count = await this._likeService.getPostLikeCount(postId);

      res.status(HttpStatus.OK).json({
        success: true,
        count,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async getCommentLikeCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { commentId } = req.params;

      if (!commentId) {
        throw new CustomError(HttpStatus.BAD_REQUEST, Messages.COMMENT_ID_REQUIRED);
      }

      const count = await this._likeService.getCommentLikeCount(commentId);

      res.status(HttpStatus.OK).json({
        success: true,
        count,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async isPostLiked(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { postId } = req.params;
      const userId = getUserIdFromRequest(req);

      if (!postId) {
        throw new CustomError(HttpStatus.BAD_REQUEST, Messages.POST_ID_REQUIRED);
      }

      const isLiked = await this._likeService.isPostLiked(postId, userId);

      res.status(HttpStatus.OK).json({
        success: true,
        isLiked,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async isCommentLiked(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { commentId } = req.params;
      const userId = getUserIdFromRequest(req);

      if (!commentId) {
        throw new CustomError(HttpStatus.BAD_REQUEST, Messages.COMMENT_ID_REQUIRED);
      }

      const isLiked = await this._likeService.isCommentLiked(commentId, userId);

      res.status(HttpStatus.OK).json({
        success: true,
        isLiked,
      });
    } catch (error: any) {
      next(error);
    }
  }
}