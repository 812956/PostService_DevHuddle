import { BaseRepository } from "./base.repository";
import { prisma } from "../../config/prisma.config";
import { Prisma, Media } from "@prisma/client";
import { IMediaRepository } from "../../repositories/interface/IMediaRepository";
import {
  DeleteUnusedMediasResponse,
  UploadMediaRequest,
} from "../../grpc/generated/post";
import logger from "../../utils/logger.util";
import { v4 as uuidv4 } from "uuid";

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
      // ✅ FIX: Generate ID for Media (same as posts)
      const { id: mediaId } = await super.create({
        ...data,
        id: uuidv4(), // Generate ID using UUID v4
      } as any);
      return mediaId;
    } catch (error: any) {
      logger.error("Error creating entity", {
        error: (error as Error).message,
        stack: (error as Error).stack,
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

  /**
   * ✅ REMOVED: deleteFilesFromUploadThing
   * 
   * This method is no longer needed as we use Media Service for all media operations.
   * Media deletion is handled by Media Service, which manages R2 storage.
   * 
   * If you need to delete media, use the Media Service API:
   * DELETE /api/v1/media/{mediaId}
   */
  async deleteFilesFromUploadThing(urls: string[]): Promise<void> {
    // This method is deprecated - media deletion is handled by Media Service
    logger.warn("deleteFilesFromUploadThing is deprecated. Use Media Service API instead.");
    return;
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
