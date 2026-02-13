import { Request, Response, NextFunction } from "express";
import { IShareLinkService } from "../../services/interfaces/IShareLinkService";
import { CustomError } from "../../utils/error.util";
import { getUserIdFromRequest } from "../../utils/request.util";
import { HttpStatus } from "../../constands/http.status";
import { Messages } from "../../constands/reqresMessages";

export class ShareLinkController {
  constructor(private _shareLinkService: IShareLinkService) {}

  async getShareLink(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { postId } = req.params;
      const userId = getUserIdFromRequest(req);
      const { generateShort, isPrivate } = req.query;

      if (!userId) {
        throw new CustomError(HttpStatus.UNAUTHORIZED, Messages.USER_NOT_FOUND);
      }

      if (!postId) {
        throw new CustomError(
          HttpStatus.BAD_REQUEST,
          Messages.POST_ID_REQUIRED
        );
      }

      const shareLink = await this._shareLinkService.generateShareLink(
        postId as string,
        userId,
        {
          generateShort: generateShort === "true",
          isPrivate: isPrivate === "true",
        }
      );

      res.status(HttpStatus.OK).json({
        success: true,
        data: shareLink,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async resolveShareLink(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { tokenOrShortId } = req.params;

      if (!tokenOrShortId) {
        throw new CustomError(
          HttpStatus.BAD_REQUEST,
          "Token or short ID is required"
        );
      }

      const result = await this._shareLinkService.resolveShareLink(tokenOrShortId as string);

      // Redirect to the post URL
      res.redirect(result.redirectUrl);
    } catch (error: any) {
      next(error);
    }
  }
}

