import { IfeedController } from "../interfaces/IfeedController";
import { partial } from "zod/v4/core/util.cjs";
import { IpostService } from "../../services/interfaces/IpostService";
import * as grpc from "@grpc/grpc-js";
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
      throw new CustomError(grpc.status.INTERNAL, err.message);
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
      throw new CustomError(grpc.status.INTERNAL, err.message);
    }
  }
}
