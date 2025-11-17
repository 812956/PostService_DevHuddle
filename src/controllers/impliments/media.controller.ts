import { IfeedController } from "../interfaces/IfeedController";
import { partial } from "zod/v4/core/util.cjs";
import { IpostService } from "../../services/interfaces/IpostService";
import { CustomError } from "../../utils/error.util";
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
  constructor(private MediaService: IMediaService) {}

  async uploadMediaController(
    req: UploadMediaRequest
  ): Promise<UploadMediaResponse> {
    try {
      const uploadMediaResponse: UploadMediaResponse =
        await this.MediaService.uploadMediaService(req);

      return uploadMediaResponse;
    } catch (err: any) {
      logger.error("delete Post error", { error: err.message });
      throw new CustomError(HttpStatus.INTERNAL_SERVER_ERROR, err.message);
    }
  }

  async deleteUnusedMedia():Promise<DeleteUnusedMediasResponse> {
    try {

      const result = await this.MediaService.deleteUnusedMediaService()

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
}
