import { Request, Response } from "express";
import { CustomError, sendErrorResponse } from "../../utils/error.util";
import { Messages } from "../../constands/reqresMessages";
import logger from "../../utils/logger.util";
import { IMediaController } from "../../controllers/interfaces/IMediaController";
import { IMediaService } from "../../services/interfaces/IMediaService";
import {
  DeleteUnusedMediasRequest,
  DeleteUnusedMediasResponse,
  UploadMediaRequest,
  UploadMediaResponse,
} from "../../grpc/generated/post";
import { HttpStatus } from "../../constands/http.status";

export class MediaController implements IMediaController {
  constructor(private _MediaService: IMediaService) {}

  async uploadMediaController(
    req: UploadMediaRequest
  ): Promise<UploadMediaResponse> {
    try {
      const uploadMediaResponse: UploadMediaResponse =
        await this._MediaService.uploadMediaService(req);

      return uploadMediaResponse;
    } catch (err: any) {
      logger.error("delete Post error", { error: err.message });
      throw new CustomError(HttpStatus.INTERNAL_SERVER_ERROR, err.message);
    }
  }

  async deleteUnusedMedia():Promise<DeleteUnusedMediasResponse> {
    try {

      const result = await this._MediaService.deleteUnusedMediaService()

      return {
        message: `Cleanup completed: ${result.deletedRecords} files deleted`,
        deletedCount: result.deletedRecords,
        success: true,
      }
       
    } catch (err:any) {
      logger.error("delete Post error", { error: err.message });
      throw new CustomError(HttpStatus.INTERNAL_SERVER_ERROR, err.message);
    }
  }

  // ============================================
  // HTTP Controller Methods (for Express routes)
  // ============================================

  async uploadMediaHttp(req: Request, res: Response): Promise<void> {
    try {
      const response = await this.uploadMediaController(req.body);
      res.status(HttpStatus.OK).json(response);
    } catch (err: any) {
      logger.error("Error in POST /api/v1/posts/media", {
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

  async deleteUnusedMediaHttp(req: Request, res: Response): Promise<void> {
    try {
      const response = await this.deleteUnusedMedia();
      res.status(HttpStatus.OK).json(response);
    } catch (err: any) {
      logger.error("Error in DELETE /api/v1/posts/medias/unused", {
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
}
