import { Status } from "@grpc/grpc-js/build/src/constants";
import {
  UploadMediaRequest,
  UploadMediaResponse,
} from "../../grpc/generated/post";
import {
  IPostRepository,
  PostSelectOptions,
} from "../../repositories/interface/IPostRepository";
import { IpostService } from "../interfaces/IpostService";
import { CustomError } from "../../utils/error.util";
import { PostMapper } from "../../mapper/post.mapper";
import logger from "../../utils/logger.util";
import * as grpc from "@grpc/grpc-js";
import { IMediaRepository } from "../../repositories/interface/IMediaRepository";
import { IMediaService } from "../../services/interfaces/IMediaService";

export class MediaService implements IMediaService {
  constructor(private mediaRepository: IMediaRepository) {}

  async uploadMediaService(
    req: UploadMediaRequest
  ): Promise<UploadMediaResponse> {
    try {
    //   const updatedMediaData : UploadMediaRequest = {
    //     ...req,
    //     url: req.url.replace(
    //       "/f/",
    //       `/a/${process.env.NEXT_PUBLIC_UPLOADTHING_APP_ID}/`
    //     ),

    //   };

      const mediaId = await this.mediaRepository.createMedia(req);

      return { mediaId };
    } catch (err: any) {
      logger.error("delete Post error", { error: err.message });
      throw new CustomError(grpc.status.INTERNAL, err.message);
    }
  }
}
