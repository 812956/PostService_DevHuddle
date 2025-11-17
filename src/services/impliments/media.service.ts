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
  constructor(private mediaRepository: IMediaRepository) {}

  async uploadMediaService(
    req: UploadMediaRequest
  ): Promise<UploadMediaResponse> {
    try {
      const mediaId = await this.mediaRepository.createMedia(req);

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
        await this.mediaRepository.findUnusedMedia();
      if (unusedMedia.length === 0) {
        console.log("No unused media found");
        return { deletedFiles: 0, deletedRecords: 0 };
      }

      console.log(` Found ${unusedMedia.length} unused media items`);

      await this.mediaRepository.deleteFilesFromUploadThing(
        unusedMedia.map((m) => m.url as string)
      );

      const deletedCount = await this.mediaRepository.deleteUnusedMediaRepo(
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
