import { IPostVersionRepository } from "../interface/IPostVersionRepository";
import { BaseRepository } from "./base.repository";
import { prisma } from "../../config/prisma.config";
import { PostVersion, Prisma } from ".prisma/client";
import logger from "../../utils/logger.util";

export class PostVersionRepository
  extends BaseRepository<
    typeof prisma.postVersion,
    PostVersion,
    Prisma.PostVersionCreateInput,
    Prisma.PostVersionUpdateInput,
    Prisma.PostVersionWhereInput
  >
  implements IPostVersionRepository
{
  constructor() {
    super(prisma.postVersion);
  }

  async createVersion(data: {
    postId: string;
    versionNumber: number;
    content: string;
    attachmentIds: string[];
    editedById: string;
  }): Promise<PostVersion> {
    try {
      return await super.create({
        posts: {
          connect: { id: data.postId },
        },
        versionNumber: data.versionNumber,
        content: data.content,
        attachmentIds: data.attachmentIds,
        editedById: data.editedById,
      });
    } catch (error: any) {
      logger.error("Error creating post version", { error: error.message });
      throw new Error("Failed to create post version");
    }
  }

  async getByPostId(postId: string): Promise<PostVersion[]> {
    try {
      return await prisma.postVersion.findMany({
        where: { postId },
        orderBy: { versionNumber: "desc" },
      });
    } catch (error: any) {
      logger.error("Error getting post versions", { error: error.message });
      throw new Error("Failed to get post versions");
    }
  }

  async getByPostAndVersion(
    postId: string,
    versionNumber: number
  ): Promise<PostVersion | null> {
    try {
      return await prisma.postVersion.findUnique({
        where: {
          postId_versionNumber: {
            postId,
            versionNumber,
          },
        },
      });
    } catch (error: any) {
      logger.error("Error getting post version", { error: error.message });
      throw new Error("Failed to get post version");
    }
  }

  async getLatestVersion(postId: string): Promise<PostVersion | null> {
    try {
      return await prisma.postVersion.findFirst({
        where: { postId },
        orderBy: { versionNumber: "desc" },
      });
    } catch (error: any) {
      logger.error("Error getting latest version", { error: error.message });
      throw new Error("Failed to get latest version");
    }
  }
}

