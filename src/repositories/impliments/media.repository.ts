import { BaseRepository } from "./base.repository";
import { prisma } from "../../config/prisma.config";
import { Prisma, Media } from "@prisma/client";
import { IMediaRepository } from "../../repositories/interface/IMediaRepository";
import {
  DeleteUnusedMediasResponse,
  UploadMediaRequest,
} from "../../grpc/generated/post";
import logger from "../../utils/logger.util";
import { UTApi } from "uploadthing/server";

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
  private utapi: UTApi;

  constructor() {
    super(prisma.media);
    this.utapi = new UTApi();
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

  async findUnusedMedia(): Promise<Partial<Media>[]> {
    try {
      return await this.model.findMany({
        where: {
          postId: null,
          ...(process.env.NODE_ENV === "production"
            ? {
                createdAt: {
                  lte: new Date(Date.now() - 1000 * 60 * 60 * 24),
                },
              }
            : {}),
        },
        select: {
          id: true,
          url: true,
        },
      });
    } catch (error: any) {
      logger.error("Error deleting entities", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async deleteFilesFromUploadThing(urls: string[]): Promise<void> {
    if (urls.length === 0) return;

    const fileKeys = urls
      .map((url) => {
        const appId = process.env.NEXT_PUBLIC_UPLOADTHING_APP_ID!;
        return url.split("/f/")[1]; // Handle both formats
      })
      .filter(Boolean);

    await this.utapi.deleteFiles(fileKeys);
  }

  async deleteUnusedMediaRepo(mediaIds: string[]): Promise<number> {
    try {
      let result = await this.model.deleteMany({
        where: { id: { in: mediaIds } },
      });

      return result.count;
    } catch (error: any) {
      logger.error("Error creating entity", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }
}
