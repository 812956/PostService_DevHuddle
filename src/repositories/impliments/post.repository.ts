import {
  IPostRepository,
  PostSelectOptions,
} from "../interface/IPostRepository";
import { BaseRepository } from "./base.repository";
import { prisma } from "../../config/prisma.config";
import logger from "../../utils/logger.util";
import { Post, Posts, Prisma } from ".prisma/client";
import { resolve } from "path";
import { userClient } from "../../config/grpc.client";
import { response } from "express";
import {
  DeletePostResponse,
  SubmitPostRequest,
  SubmitPostResponse,
} from "../../grpc/generated/post";
import { error } from "console";

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

  async createPostLogics(
    data: Partial<Prisma.PostCreateInput>
  ): Promise<{ postId: string }> {
    try {
      const { id: postId } = await super.create(data);
      return { postId };
    } catch (error: any) {
      logger.error("Error creating entity", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async submitPostRepo(data: SubmitPostRequest): Promise<SubmitPostResponse> {
    try {
      const post = await prisma.posts.create({ data });

      return post;
    } catch (error: any) {
      logger.error("Error creating entity", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async findPost(postId: string): Promise<Posts | null> {
    try {
      const post = await prisma.posts.findUnique({
        where: {
          id: postId,
        },
      });
      return post;
    } catch (error: any) {
      logger.error("Error find entity", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async deletePost(postId: string) {
    try {
      const post = await prisma.posts.delete({
        where: {
          id: postId,
        },
      });

      console.log('this is the deleted posts ------------------------------', post)
      
      return post;
    } catch (error: any) {
      logger.error("Error delete entity", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  

  async getPostsRepo(postSelectOptions: PostSelectOptions): Promise<any> {
    try {
      const posts = await prisma.posts.findMany(postSelectOptions);

      // console.log('this is the fetched data .......', posts)

      const enrichedPosts = await Promise.all(
        posts.map(
          (post) =>
            new Promise((resolve, reject) => {
              userClient.getUserForFeedListing(
                { userId: post.userId },
                (err, response) => {
                  // if (err) {
                  //   console.error("gRPC error fetching user:", err);
                  //   return resolve({ ...post, user: undefined });
                  // }
                  resolve({
                    ...post,
                    user: {
                      avatar: response.avatar,
                      name: response.name,
                      username: response.username,
                    },
                  });
                }
              );
            })
        )
      );

      return enrichedPosts;
    } catch (err: any) {
      logger.error("Error fetching the posts ", {
        error: (err as Error).message,
      });
      throw new Error("Database error");
    }
  }
}
