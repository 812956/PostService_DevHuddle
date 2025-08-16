import { IPostRepository } from "../interface/IPostRepository";
import { BaseRepository } from "./base.repository";
import { Prisma, Post } from "../../../generated/prisma-client";
import { prisma } from "../../config/prisma.config";
import { CreatePostRequest } from "../../grpc/generated/post";
import logger from "../../utils/logger.util";

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

  async createPostLogics(data:Prisma.PostCreateInput): Promise<void> {
    try {
      
    } catch (error: any) {
      logger.error("Error creating entity", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }
}
