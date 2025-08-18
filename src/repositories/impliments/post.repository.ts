import { IPostRepository } from "../interface/IPostRepository";
import { BaseRepository } from "./base.repository";
import { prisma } from "../../config/prisma.config";
import logger from "../../utils/logger.util";
import { Post, Prisma } from ".prisma/client";

export class PostRepository
  extends BaseRepository<
    typeof prisma.post,
    Post,
    Prisma.PostCreateInput,
    Prisma.PostUpdateInput,
    Prisma.PostWhereInput
  >
  implements IPostRepository
{
  constructor() {
    super(prisma.post);
  }

  async createPostLogics(data: Partial<Prisma.PostCreateInput>): Promise<void> {
    try {
      await super.create(data);
    } catch (error: any) {
      logger.error("Error creating entity", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }
}
