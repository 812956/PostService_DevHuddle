import {
  IPostRepository,
  PostSelectOptions,
} from "../interface/IPostRepository";
import { BaseRepository } from "./base.repository";
import { prisma } from "../../config/prisma.config";
import logger from "../../utils/logger.util";
import { Posts, Prisma } from ".prisma/client";
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
    typeof prisma.posts,
    Posts,
    Prisma.PostsCreateInput,
    Prisma.PostsUpdateInput,
    Prisma.PostsWhereInput
  >
  implements IPostRepository
{
  constructor() {
    super(prisma.posts);
  }

  async createPostLogics(
    data: Partial<Prisma.PostsCreateInput>
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
      const post = await prisma.posts.create({
        data: {
          content: data.content,
          userId: data.userId,
          attachments: {
            connect: data.mediaIds.map((id) => ({ id })),
          },
        },
      });

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


  async incrementLikesCount(postId: string): Promise<void> {
    try {
      await prisma.posts.update({
        where: { id: postId },
        data: {
          likesCount: {
            increment: 1,
          },
        },
      });
    } catch (error: any) {
      logger.error("Error incrementing likes count", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }


  async decrementLikesCount(postId: string): Promise<void> {
    try {
      await prisma.posts.update({
        where: { id: postId },
        data: {
          likesCount: {
            decrement: 1,
          },
        },
      });
    } catch (error: any) {
      logger.error("Error decrementing likes count", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async incrementCommentsCount(postId: string): Promise<void> {
    try {
      await prisma.posts.update({
        where: { id: postId },
        data: {
          commentsCount: {
            increment: 1,
          },
        },
      });
    } catch (error: any) {
      logger.error("Error incrementing comments count", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async decrementCommentsCount(postId: string): Promise<void> {
    try {
      await prisma.posts.update({
        where: { id: postId },
        data: {
          commentsCount: {
            decrement: 1,
          },
        },
      });
    } catch (error: any) {
      logger.error("Error decrementing comments count", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async incrementSharesCount(postId: string): Promise<void> {
    try {
      await prisma.posts.update({
        where: { id: postId },
        data: {
          sharesCount: {
            increment: 1,
          },
        },
      });
    } catch (error: any) {
      logger.error("Error incrementing shares count", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async incrementReportsCount(postId: string): Promise<void> {
    try {
      await prisma.posts.update({
        where: { id: postId },
        data: {
          reportsCount: {
            increment: 1,
          },
        },
      });
    } catch (error: any) {
      logger.error("Error incrementing reports count", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

}
