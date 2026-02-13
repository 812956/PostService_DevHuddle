import { Request, Response, NextFunction } from "express";
import { IShareService } from "../../services/interfaces/IShareService";
import { CustomError } from "../../utils/error.util";
import { ShareType, TargetType } from "@prisma/client";
import { getUserIdFromRequest } from "../../utils/request.util";
import { HttpStatus } from "../../constands/http.status";
import { Messages } from "../../constands/reqresMessages";
import { IShareController } from "../../controllers/interfaces/IShareController";

export class ShareController implements IShareController {
  constructor(private _shareService: IShareService) {}

  async sharePost(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { postId } = req.params;
      const userId = getUserIdFromRequest(req);
      const { shareType, caption, targetType, visibility, sharedToUserId } = req.body;

      if (!userId) {
        throw new CustomError(HttpStatus.UNAUTHORIZED, Messages.USER_NOT_FOUND);
      }

      if (!postId) {
        throw new CustomError(
          HttpStatus.BAD_REQUEST,
          Messages.POST_ID_REQUIRED
        );
      }

      if (!shareType) {
        throw new CustomError(
          HttpStatus.BAD_REQUEST,
          "Share type is required"
        );
      }

      const share = await this._shareService.sharePost(
        postId as string,
        userId,
        shareType,
        targetType,
        caption,
        visibility,
        sharedToUserId
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

      const count = await this._shareService.getShareCount(postId as string);

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

      const hasShared = await this._shareService.hasShared(postId as string, userId);

      res.status(HttpStatus.OK).json({
        success: true,
        hasShared,
      });
    } catch (error: any) {
      next(error);
    }
  }
}
