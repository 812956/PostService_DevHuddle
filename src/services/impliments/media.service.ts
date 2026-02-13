import {
  Media,
  UploadMediaRequest,
  UploadMediaResponse,
} from "../../grpc/generated/post";
import { HttpStatus } from "../../constands/http.status";
import { CustomError } from "../../utils/error.util";
import logger from "../../utils/logger.util";
import { IMediaRepository } from "../../repositories/interface/IMediaRepository";
import {
  CleanupResult,
  IMediaService,
} from "../../services/interfaces/IMediaService";

export class MediaService implements IMediaService {
  constructor(private _mediaRepository: IMediaRepository) {}

  async uploadMediaService(
    req: UploadMediaRequest
  ): Promise<UploadMediaResponse> {
    try {
      const mediaId = await this._mediaRepository.createMedia(req);

      return { mediaId };
    } catch (err: any) {
      logger.error("delete Post error", { error: err.message });
      throw new CustomError(HttpStatus.INTERNAL_SERVER_ERROR, err.message);
    }
  }

  async deleteUnusedMediaService(

  ): Promise<CleanupResult> {
    try {
      const unusedMedia: Partial<Media>[] =
        await this._mediaRepository.findUnusedMedia();
      if (unusedMedia.length === 0) {
        console.log("No unused media found");
        return { deletedFiles: 0, deletedRecords: 0 };
      }

      console.log(` Found ${unusedMedia.length} unused media items`);

      // ✅ REMOVED: UploadThing deletion
      // Media deletion is now handled by Media Service
      // Unused media should be deleted via Media Service API
      logger.warn("Media deletion should be handled by Media Service, not Post Service");

      const deletedCount = await this._mediaRepository.deleteUnusedMediaRepo(
        unusedMedia.map((m) => m.id as string)
      );

      console.log(`Cleanup complete: ${deletedCount} records deleted`);

      return {
        deletedFiles: unusedMedia.length,
        deletedRecords: deletedCount,
      };

    } catch (err: any) {
      logger.error("delete Medias error", { error: err.message });
      throw new CustomError(HttpStatus.INTERNAL_SERVER_ERROR, err.message);
    }
  }
}
