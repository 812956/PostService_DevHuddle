import { Request, Response, NextFunction } from "express";
import { IMentionRepository } from "../../repositories/interface/IMentionRepository";
import { IMentionService } from "../../services/interfaces/IMentionService";
import { CustomError } from "../../utils/error.util";
import logger from "../../utils/logger.util";
import { HttpStatus } from "../../constands/http.status";

export class MentionController {
  constructor(
    private _mentionRepository: IMentionRepository,
    private _mentionService: IMentionService
  ) {}

  /**
   * Get all mentions in a post
   * GET /posts/:postId/mentions
   */
  async getPostMentions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { postId } = req.params;

      if (!postId) {
        throw new CustomError(HttpStatus.BAD_REQUEST, "Post ID is required");
      }

      const mentions = await this._mentionRepository.getPostMentions(postId as string);

      res.status(HttpStatus.OK).json({
        success: true,
        data: mentions,
        count: mentions.length,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Get all mentions in a comment
   * GET /comments/:commentId/mentions
   */
  async getCommentMentions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { commentId } = req.params;

      if (!commentId) {
        throw new CustomError(HttpStatus.BAD_REQUEST, "Comment ID is required");
      }

      const mentions = await this._mentionRepository.getCommentMentions(commentId as string);

      res.status(HttpStatus.OK).json({
        success: true,
        data: mentions,
        count: mentions.length,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Process mentions from content (manual trigger - typically used internally)
   * POST /mentions/process
   * This endpoint is mainly for testing or manual reprocessing
   */
  async processMentions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { content, postId, commentId } = req.body;
      const actorId = (req as any).user?.userId || (req as any).user?.id;

      if (!actorId) {
        throw new CustomError(HttpStatus.UNAUTHORIZED, "Unauthorized");
      }

      if (!content || typeof content !== "string") {
        throw new CustomError(HttpStatus.BAD_REQUEST, "Content is required");
      }

      if (!postId && !commentId) {
        throw new CustomError(HttpStatus.BAD_REQUEST, "Either postId or commentId is required");
      }

      if (postId && commentId) {
        throw new CustomError(HttpStatus.BAD_REQUEST, "Cannot provide both postId and commentId");
      }

      const mentionedUserIds = await this._mentionService.processMentions(
        content,
        postId,
        commentId,
        actorId
      );

      res.status(HttpStatus.OK).json({
        success: true,
        message: "Mentions processed successfully",
        data: {
          mentionedUserIds,
          count: mentionedUserIds.length,
        },
      });
    } catch (error: any) {
      next(error);
    }
  }
}