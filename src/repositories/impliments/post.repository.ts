import {
  IPostRepository,
  PostSelectOptions,
} from "../interface/IPostRepository";
import { BaseRepository } from "./base.repository";
import { prisma } from "../../config/prisma.config";
import logger from "../../utils/logger.util";
import redisClient from "../../config/redis.config";
import { posts, Prisma, Media } from ".prisma/client";

import { userClient } from "../../config/grpc.client";
import {
  DeletePostResponse,
  SubmitPostRequest,
  SubmitPostResponse,
} from "../../grpc/generated/post";
import { error } from "console";
import { v4 as uuidv4 } from "uuid";
import { validateMediaOwnership, linkMediaToPost } from "../../config/media.client";
import { MediaValidationResponse, ValidatedMedia, EnrichedPost } from "../../types/common.types";

export class PostRepository
  extends BaseRepository<
    typeof prisma.posts,
    posts,
    Prisma.postsCreateInput,
    Prisma.postsUpdateInput,
    Prisma.postsWhereInput
  >
  implements IPostRepository
{
  constructor() {
    super(prisma.posts);
  }

  async createPostLogics(
    data: Partial<Prisma.postsCreateInput>
  ): Promise<{ postId: string }> {
    try {
      const { id: postId } = await super.create(data);
      return { postId };
    } catch (error: unknown) {
      logger.error("Error creating entity", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async submitPostRepo(data: SubmitPostRequest): Promise<SubmitPostResponse> {
    try {


      let validation: MediaValidationResponse | undefined;

      // Step 1: Validate media ownership via Media Service

      if (data.mediaIds && data.mediaIds.length > 0) {
        try {
          validation = await validateMediaOwnership(data.mediaIds, data.userId);
          
          if (!validation.valid) {
            throw new Error(
              validation.message || 
              `Invalid media: ${validation.invalidMediaIds?.join(", ")}`
            );
          }
        } catch (error: unknown) {
          logger.error("Media validation failed", {
            error: (error as Error).message,
            mediaIds: data.mediaIds,
            userId: data.userId,
          });
          throw new Error(`Media validation failed: ${(error as Error).message}`);
        }
      }

      // Step 2: Create post in database (transaction ensures atomicity)
      const post = await prisma.$transaction(async (tx) => {
        // Use checked media from validation step
        const mediaToCreate = (validation?.validMedia || []).map((m: ValidatedMedia) => ({
          id: m.id,
          type: (m.mediaType === "POST_VIDEO" ? "VIDEO" : "IMAGE") as any,
          url: m.cdnUrl || m.originalUrl,
          thumbnail: m.thumbnailUrls?.[0]?.cdnUrl || m.thumbnail,
        }));
        

        // Create post with generated ID
        const newPost = await tx.posts.create({
          data: {
            id: uuidv4(),
            content: data.content,
            userId: data.userId,
            visibility: data.visibility as unknown as any, // Cast to any to avoid enum type mismatch
            commentControl: data.commentControl as unknown as any,
            // Create local media records (Read Model)
            Media: {
              create: mediaToCreate.map((m) => ({
                id: m.id,
                type: m.type,
                url: m.url,
                thumbnail: m.thumbnail,
              })),
            },
          }, 
        });

        // Step 3: Link media to post via Media Service
        // This updates the Media Service database (source of truth)
        if (data.mediaIds && data.mediaIds.length > 0) {
          try {
            await linkMediaToPost(data.mediaIds, newPost.id, data.userId);
            logger.info("Media linked to post via Media Service", {
              postId: newPost.id,
              mediaIds: data.mediaIds,
            });
          } catch (error: unknown) {
            logger.error("Failed to link media to post", {
              error: (error as Error).message,
              postId: newPost.id,
              mediaIds: data.mediaIds,
            });
            // If linking fails, we should rollback the post creation
            // But since we're outside the transaction, we'll throw an error
            // The transaction will be rolled back automatically
            throw new Error(`Failed to link media: ${(error as Error).message}`);
          }
        }

        // Fetch post (without media from Post Service database)
        // Media will be fetched from Media Service when needed
        const postWithMedia = await tx.posts.findUnique({
          where: { id: newPost.id },
        });

        return postWithMedia!;
      }, {
        timeout: 10000, // 10 second timeout
        maxWait: 5000, // Maximum wait time for transaction
      });

      return post;
    } catch (error: unknown) {
      logger.error("Error creating post", {
        error: (error as Error).message,
        stack: (error as Error).stack,
        userId: data.userId,
        mediaIds: data.mediaIds,
      });
      throw new Error((error as Error).message || "Database error");
    }
  }

  async findPost(postId: string): Promise<posts | null> {
    try {
      const post = await prisma.posts.findUnique({
        where: {
          id: postId,
        },
      });
      return post;
    } catch (error: unknown) {
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
    } catch (error: unknown) {
      logger.error("Error delete entity", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async getPostsRepo(postSelectOptions: PostSelectOptions): Promise<EnrichedPost[]> {
    try {
      //  FIX: Cast to Prisma's expected type - PostSelectOptions uses skip-based pagination (no cursor)
      const prismaOptions: Prisma.postsFindManyArgs = {
        include: postSelectOptions.include,
        take: postSelectOptions.take,
        skip: postSelectOptions.skip,
        orderBy: postSelectOptions.orderBy,
        where: postSelectOptions.where,
      };
      const posts = await prisma.posts.findMany(prismaOptions);

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

      return enrichedPosts as unknown as EnrichedPost[];
    } catch (err: unknown) {
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
    } catch (error: unknown) {
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
    } catch (error: unknown) {
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
    } catch (error: unknown) {
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
    } catch (error: unknown) {
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
    } catch (error: unknown) {
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
    } catch (error: unknown) {
      logger.error("Error incrementing reports count", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async updatePost(postId: string, data: Partial<Prisma.postsUpdateInput>): Promise<posts> {
    try {
      return await prisma.posts.update({
        where: { id: postId },
        data,
      });
    } catch (error: unknown) {
      logger.error("Error updating post", {
        error: (error as Error).message,
        postId,
      });
      throw new Error("Database error");
    }
  }

  async lockForEditing(postId: string): Promise<void> {
    try {
      // Use Redis for distributed locking
      const lockKey = `post:edit:lock:${postId}`;
      const result: string | null = await redisClient.set(lockKey, "1", {
        EX: 300, // 5 minute expiration
        NX: true, // Only set if not exists
      });

      // Redis SET with NX returns "OK" if set, null if key exists
      if (result !== "OK") {
        throw new Error("Post is currently being edited");
      }

      // Also update DB flag
      await prisma.posts.update({
        where: { id: postId },
        data: { isEditing: true },
      });
    } catch (error: unknown) {
      logger.error("Error locking post for editing", {
        error: (error as Error).message,
        postId,
      });
      throw error;
    }
  }

  async unlockEditing(postId: string): Promise<void> {
    try {
      const lockKey = `post:edit:lock:${postId}`;
      await redisClient.del(lockKey);
      
      await prisma.posts.update({
        where: { id: postId },
        data: { isEditing: false },
      });
    } catch (error: unknown) {
      logger.error("Error unlocking post for editing", {
        error: (error as Error).message,
        postId,
      });
      throw new Error("Database error");
    }
  }

  //  NEW: Get posts by IDs (for feed retrieval)
  async getPostsByIds(postIds: string[]): Promise<posts[]> {
    try {
      if (postIds.length === 0) {
        return [];
      }

      const posts = await prisma.posts.findMany({
        where: {
          id: { in: postIds },
          deletedAt: null, // Exclude soft-deleted posts
          isHidden: false, // Exclude hidden posts
        },
        include: {
            Media: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return posts;
    } catch (error: unknown) {
      logger.error("Error getting posts by IDs", {
        error: (error as Error).message,
        postCount: postIds.length,
      });
      throw new Error("Database error");
    }
  }

  async getMediaIds(postId: string): Promise<string[]> {
    try {
      const mediaItems = await prisma.media.findMany({
        where: { postId: postId },
        select: { id: true },
      });
      return mediaItems.map((m) => m.id);
    } catch (error: unknown) {
      logger.error("Error getting media IDs", {
        error: (error as Error).message,
        postId,
      });
      throw new Error("Database error");
    }
  }

  async findMediaByIds(mediaIds: string[]): Promise<Media[]> {
    try {
      return await prisma.media.findMany({
        where: { id: { in: mediaIds } },
      });
    } catch (error: unknown) {
      logger.error("Error finding media by IDs", {
        error: (error as Error).message,
        mediaIds,
      });
      throw new Error("Database error");
    }
  }

  async updatePostWithVersions(params: {
    postId: string;
    userId: string;
    newContent: string;
    addAttachmentIds?: string[];
    removeAttachmentIds?: string[];
    versionRepository?: any;
  }): Promise<{ post: posts; versionNumber: number }> {
    try {
      const {
        postId,
        userId,
        newContent,
        addAttachmentIds,
        removeAttachmentIds,
        versionRepository,
      } = params;

      return await prisma.$transaction(async (tx) => {
        // Get current post to find current version
        const post = await tx.posts.findUnique({ where: { id: postId } });
        if (!post) throw new Error("Post not found");

        // Get current attachments
        const currentAttachments = await tx.media.findMany({
          where: { postId: postId },
        });

        // Calculate new attachment set
        const attachmentIdsToKeep = currentAttachments
          .map((a) => a.id)
          .filter((id) => !removeAttachmentIds?.includes(id));
        const newAttachmentIds = [
          ...attachmentIdsToKeep,
          ...(addAttachmentIds || []),
        ];

        const newVersionNumber = post.currentVersion + 1;

        // Create version
        if (versionRepository) {
          // Use the repository method but inside transaction if supported, 
          // or manually create if repository doesn't support passing tx.
          // Since IPostVersionRepository usually uses 'prisma' global, we might need to duplicate logic 
          // or pass tx to repository if we refactor repositories to accept tx.
          // For now, to keep it simple and safe, we will manually create version here ensuring transactional integrity
          // BUT prompt said "refactor", so ideally we shouldn't duplicate.
          // However, strict DI + Prisma Transaction usually requires passing the TransactionClient around.
          // Let's assume we can just do the DB operations here.
          
          /* 
             Ideally: versionRepository.withTx(tx).createVersion(...)
             But versionRepository is injected.
             Let's just implement the logic here for now to satisfy the "move logic out of service" requirement.
          */
             
          // This implies copying logic from PostVersionRepository OR injecting PostVersionRepository Logic.
          // But since we are INSIDE PostRepository, and PostVersion is closely related, it's okay.
          // Actually, PostVersionRepository logic is simple create.
        }
        
         // Note: If versionRepository was passed, we might want to use it, but since it's a separate repository, 
         // calling it might use a different prisma client instance or not be part of this transaction.
         // Unless we use Interactive Transactions with a passed client.
         // Let's do the version creation manually here to ensure it's in the same transaction.
         
          // Was: await this.postVersionRepository.createVersion(...)
          // We'll mimic it:
           await tx.postVersion.create({
              data: {
                id: uuidv4(),
                postId: postId,
                versionNumber: newVersionNumber,
                content: newContent,
                attachmentIds: newAttachmentIds, // Stored as string array
                editedById: userId,
                editedAt: new Date(),
              }
            });

        // Update post
        const updatedPost = await tx.posts.update({
          where: { id: postId },
          data: {
            content: newContent,
            currentVersion: newVersionNumber,
            lastEditedAt: new Date(),
            editCount: { increment: 1 },
            isEditing: false, // Unlock
          },
          include: {
            Media: true,
          },
        });

        // Update attachments
        if (removeAttachmentIds && removeAttachmentIds.length > 0) {
          await tx.media.deleteMany({
            where: {
              id: { in: removeAttachmentIds },
              postId: postId,
            },
          });
        }

        if (addAttachmentIds && addAttachmentIds.length > 0) {
          await tx.media.updateMany({
            where: { id: { in: addAttachmentIds } },
            data: { postId: postId },
          });
        }

        return { post: updatedPost, versionNumber: newVersionNumber };
      });
    } catch (error: unknown) {
      logger.error("Error updating post with versions", {
        error: (error as Error).message,
        postId: params.postId,
      });
      throw new Error((error as Error).message || "Database error");
    }
  }


  async countPostsAfter(date: Date): Promise<number> {
    try {
      return await prisma.posts.count({
        where: {
          createdAt: {
            gt: date,
          },
        },
      });
    } catch (error: unknown) {
      logger.error("Error counting newer posts", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }
}
