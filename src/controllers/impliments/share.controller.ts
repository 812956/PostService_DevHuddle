import { Request, Response, NextFunction } from "express";
import { IShareService } from "../../services/interfaces/IShareService";
import { CustomError } from "../../utils/error.util";
import { ShareType, TargetType } from "@prisma/client";
import { getUserIdFromRequest } from "../../utils/request.util";
import { HttpStatus } from "../../constands/http.status";
import { Messages } from "../../constands/reqresMessages";
import { IShareController } from "../../controllers/interfaces/IShareController";

export class ShareController implements IShareController {
  constructor(private shareService: IShareService) {}

  async sharePost(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { postId } = req.params;
      const userId = getUserIdFromRequest(req);
      const { shareType, caption, targetType } = req.body;

      if (!userId) {
        throw new CustomError(HttpStatus.UNAUTHORIZED, Messages.USER_NOT_FOUND);
      }

      if (!postId) {
        throw new CustomError(
          HttpStatus.BAD_REQUEST,
          Messages.POST_ID_REQUIRED
        );
      }

      if (
        !shareType ||
        (shareType !== ShareType.RESHARE && shareType !== ShareType.QUOTE)
      ) {
        throw new CustomError(
          HttpStatus.BAD_REQUEST,
          Messages.SHARE_TYPE_MUST_BE_RESHARE_QUOTE
        );
      }

      if (
        !targetType ||
        (targetType !== TargetType.GROUP && targetType !== TargetType.USER)
      ) {
        throw new CustomError(
          HttpStatus.BAD_REQUEST,
          "Invalid Target type , Must be User or Group"
        );
      }

      const share = await this.shareService.sharePost(
        postId,
        userId,
        shareType as ShareType,
        caption,
        targetType as TargetType
      );

      res.status(HttpStatus.CREATED).json({
        success: true,
        message: "Post shared successfully",
        data: share,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async getShareCount(
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

      const count = await this.shareService.getShareCount(postId);

      res.status(HttpStatus.OK).json({
        success: true,
        count,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async hasShared(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { postId } = req.params;
      const userId = getUserIdFromRequest(req);

      if (!userId) {
        throw new CustomError(HttpStatus.UNAUTHORIZED, Messages.USER_NOT_FOUND);
      }

      if (!postId) {
        throw new CustomError(
          HttpStatus.BAD_REQUEST,
          Messages.POST_ID_REQUIRED
        );
      }

      const hasShared = await this.shareService.hasShared(postId, userId);

      res.status(HttpStatus.OK).json({
        success: true,
        hasShared,
      });
    } catch (error: any) {
      next(error);
    }
  }
}
