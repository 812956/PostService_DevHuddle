import { BaseRepository } from "./base.repository";
import { prisma } from "../../config/prisma.config";
import { Prisma, Media } from "@prisma/client";
import { IMediaRepository } from "../../repositories/interface/IMediaRepository";
import { UploadMediaRequest } from "../../grpc/generated/post";
import logger from "../../utils/logger.util";

export class MediaRepository
  extends BaseRepository<
    typeof prisma.media,
    Media,
    Prisma.MediaCreateInput,
    Prisma.MediaUpdateInput,
    Prisma.MediaWhereInput
  >
  implements IMediaRepository
{
  constructor() {
    super(prisma.media);
  }

  async createMedia(data: UploadMediaRequest): Promise<string> {
    try {
      const { id: mediaId } = await super.create(data as any);
      return mediaId;
    } catch (error: any) {
      logger.error("Error creating entity", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }
}
