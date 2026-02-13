import { Status } from "@grpc/grpc-js/build/src/constants";
import {
  CreatePostRequest,
  CreatePostResponse,
  DeletePostResponse,
  ListPostsResponse,
  SubmitPostRequest,
  SubmitPostResponse,
  UploadMediaRequest,
  UploadMediaResponse,
  EditPostRequest,
  EditPostResponse,
  GetPostVersionsRequest,
  GetPostVersionsResponse,
  RestorePostVersionRequest,
  RestorePostVersionResponse,
} from "../../grpc/generated/post";
import {
  IPostRepository,
  PostSelectOptions,
} from "../../repositories/interface/IPostRepository";
import { IpostService } from "../interfaces/IpostService";
import { CustomError } from "../../utils/error.util";
// import { PostMapper } from "../../mapper/post.mapper";
import logger from "../../utils/logger.util";
import * as grpc from "@grpc/grpc-js";
import { ILikeRepository } from "../../repositories/interface/ILikeRepository";
import { ICommentRepository } from "../../repositories/interface/ICommentRepository";
import { IShareRepository } from "../../repositories/interface/IShareRepository";
import { IPostVersionRepository } from "../../repositories/interface/IPostVersionRepository";
import { RedisCacheService } from "../../utils/redis.util";
// import { prisma } from "../../config/prisma.config"; // Removed direct dependency
import { IFeedService } from "../interfaces/IFeedService";
import { IOutboxService } from "../interfaces/IOutboxService";
import { OutboxAggregateType, OutboxEventType } from "@prisma/client";
import { KAFKA_TOPICS } from "../../config/kafka.config";
import { userClient } from "../../config/grpc.client";
import { grpcs } from "../../utils/grpc.client.call.util";
import {
  GetFollowersRequest,
  GetFollowersResponse,
  UserServiceClient,
} from "../../grpc/generated/user";

export class PostSerive implements IpostService {
  constructor(
    private _postRepository: IPostRepository,
    private likeRepository?: ILikeRepository,
    private commentRepository?: ICommentRepository,
    private shareRepository?: IShareRepository,
    private postVersionRepository?: IPostVersionRepository,
    private feedService?: IFeedService, //  NEW: Feed service for fan-out
    private outboxService?: IOutboxService //  NEW: Outbox service for events
  ) {}

  

  async submitPost(req: SubmitPostRequest): Promise<SubmitPostResponse> {
    try {
      // 1. Create post in database (transaction ensures atomicity)
      const post: SubmitPostResponse = await this._postRepository.submitPostRepo(
        req
      );

      // 2.  NEW: Fan-out to followers (production-ready feed generation)
      if (this.feedService) {
        try {
          // Get followers from User Service
          let followers: Array<{ id: string; username?: string; name?: string }> = [];
          
            try {
              const followersResponse = await grpcs<
                UserServiceClient,
                GetFollowersRequest,
                GetFollowersResponse
              >(userClient, "getFollowers", { userId: req.userId });
              
              followers = (followersResponse.followers || []).map((f) => ({
                id: f.id,
                username: f.username,
                name: f.name,
              }));
            } catch (followersError: unknown) {
              // If GetFollowers not implemented yet, log and continue
              logger.warn("GetFollowers not available, skipping fan-out", {
                error: (followersError as Error).message,
                userId: req.userId,
              });
              // For now, we'll still create the outbox event
              // Fan-out can be done manually or when GetFollowers is implemented
            }

          // Only fan-out if we have followers and feed service is available
          if (followers.length > 0 && this.feedService) {
            // Extract post metadata
            const postData = await this._postRepository.findPost(post.id);
            if (postData) {
              const metadata = {
                authorId: postData.userId,
                postId: postData.id,
                content: postData.content,
                tags: postData.tags || [],
                visibility: postData.visibility as string,
                likesCount: postData.likesCount,
                commentsCount: postData.commentsCount,
                sharesCount: postData.sharesCount,
                createdAt: postData.createdAt,
              };

              // Fan-out strategy: synchronous for < 1000 followers
              if (followers.length < 1000) {
                await this.feedService.fanOutToFollowers({
                  postId: post.id,
                  authorId: req.userId,
                  followers,
                  metadata,
                });
              } else {
                // For > 1000 followers, queue for async processing
                // TODO: Implement async queue worker
                logger.info("Large follower count, async fan-out recommended", {
                  postId: post.id,
                  followerCount: followers.length,
                });
                // For now, process in batches
                await this.feedService.fanOutToFollowers({
                  postId: post.id,
                  authorId: req.userId,
                  followers: followers.slice(0, 1000), // Process first 1000
                  metadata,
                });
              }
            }
          }
        } catch (fanOutError: unknown) {
          // Log error but don't fail post creation
          logger.error("Fan-out error (non-fatal)", {
            error: (fanOutError as Error).message,
            postId: post.id,
          });
        }
      }

      // 3.  NEW: Publish event for notifications
      if (this.outboxService) {
        try {
          await this.outboxService.createOutboxEvent({
            aggregateType: OutboxAggregateType.POST,
            aggregateId: post.id,
            type: OutboxEventType.POST_CREATED,
            topic: KAFKA_TOPICS.POST_CREATED,
            key: req.userId, // Use userId as partition key
            payload: {
              postId: post.id,
              userId: req.userId,
              visibility: req.visibility || "PUBLIC",
              content: req.content.substring(0, 200), // Preview
              createdAt: new Date().toISOString(),
              version: Date.now(),
              action: "POST_CREATED",
            },
          });
        } catch (eventError: unknown) {
          // Log but don't fail post creation
          logger.error("Outbox event creation error (non-fatal)", {
            error: (eventError as Error).message,
            postId: post.id,
          });
        }
      }

      return post;
    } catch (err: unknown) {
      logger.error("CreatePost error", { error: (err as Error).message });
      throw new CustomError(grpc.status.INTERNAL, (err as Error).message);
    }
  }

  async getPosts(
    pageParam?: string,
    userId?: string, // This is viewerId
    authorId?: string // This is filter by author
  ): Promise<ListPostsResponse> {
    try {
      // If authorId is provided, we are fetching a profile feed (not a personal timeline)
      // So we skip the FeedService logic and go straight to the repository with a filter
      if (!authorId && this.feedService && userId) {
        try {
          const feedResponse = await this.feedService.getFeed(
            userId,
            pageParam,
            10
          );

          //  FIX: If feed is empty, fall back to legacy query (for cases where UserFeed hasn't been populated yet)
          if (feedResponse.posts.length === 0) {
            logger.info("Feed service returned empty, falling back to legacy query", {
              userId,
              pageParam,
            });
            // Fall through to legacy implementation below
          } else {
            const postIds = feedResponse.posts.map((p: any) => p.id);

            // Enrich with engagement data
            let userLikesMap: Record<string, boolean> = {};
            let userSharesMap: Record<string, boolean> = {};

            if (postIds.length > 0) {
              userLikesMap =
                (await this.likeRepository?.getUserLikesForPosts(userId, postIds)) ||
                {};
              userSharesMap =
                (await this.shareRepository?.getUserSharesForPosts(userId, postIds)) ||
                {};
            }

            const enrichedPosts = feedResponse.posts.map((post: any) => {
              //  FIX: Transform Media array to Attachments format
              const attachments = (post.Media || []).map((media: any) => ({
                id: media.id,
                post_id: media.postId || post.id,
                type: String(media.type || "IMAGE"), // Convert enum to string (IMAGE or VIDEO)
                url: media.url,
                created_at: media.createdAt ? new Date(media.createdAt).toISOString() : new Date().toISOString(),
              }));

              return {
                ...post,
                attachments, //  Add attachments array
                engagement: {
                  likesCount: post.likesCount ?? 0,
                  commentsCount: post.commentsCount ?? 0,
                  sharesCount: post.sharesCount ?? 0,
                  isLiked: userLikesMap[post.id] ?? false,
                  isShared: userSharesMap[post.id] ?? false,
                },
              };
            });

            return {
              pages: enrichedPosts,
              nextCursor: feedResponse.nextCursor ?? undefined,
            };
          }
        } catch (feedError: unknown) {
          // If feed service fails, fall back to naive approach
          logger.warn("Feed service error, falling back to naive query", {
            error: (feedError as Error).message,
            userId,
          });
          // Fall through to legacy implementation
        }
      }

      //  FALLBACK: Legacy naive query (for backwards compatibility or if feedService unavailable)
      //  FIX: Order by createdAt DESC to ensure newest posts appear first (UUIDs don't sort chronologically)
      const PAGE_SIZE = 10;
      
      //  FIX: Use offset-based pagination with createdAt ordering
      // If pageParam (post ID) is provided, find how many posts to skip based on createdAt
      let skipCount = 0;
      if (pageParam) {
        const cursorPost = await this._postRepository.findPost(pageParam);
        if (cursorPost && cursorPost.createdAt) {
          // Count posts created after this one (newer posts) to determine skip count
          skipCount = await this._postRepository.countPostsAfter(cursorPost.createdAt);
        }
      }
      
      const PostselectOptions: PostSelectOptions = {
        include: {
          Media: true, //  FIX: Changed from 'attachments' to 'Media' to match schema
        },
        take: PAGE_SIZE + 1,
        skip: skipCount,
        where: authorId ? { userId: authorId } : undefined, // Filter by author if provided
        orderBy: { createdAt: "desc" }, //  CRITICAL FIX: Order by createdAt DESC for chronological ordering (UUIDs are not chronological!)
      };

      const prismaPosts = await this._postRepository.getPostsRepo(
        PostselectOptions
      );

      const hasMore = prismaPosts.length > PAGE_SIZE;
      const items = prismaPosts.slice(0, PAGE_SIZE);
      const postIds = items.map((post) => post.id);

      let userLikesMap: Record<string, boolean> = {};
      let userSharesMap: Record<string, boolean> = {};

      if (userId && postIds.length > 0) {
        userLikesMap =
          (await this.likeRepository?.getUserLikesForPosts(userId, postIds)) ||
          {};
        userSharesMap =
          (await this.shareRepository?.getUserSharesForPosts(userId, postIds)) ||
          {};
      }

      const enrichedPosts = items.map((post) => {
        //  FIX: Transform Media array to Attachments format
        const attachments = (post.Media || []).map((media) => ({
          id: media.id,
          postId: media.postId || post.id,
          type: String(media.type || "IMAGE"),
          url: media.url,
          createdAt: media.createdAt ? new Date(media.createdAt).toISOString() : new Date().toISOString(),
        }));

        return {
          ...post,
          createdAt: post.createdAt.toISOString(),
          updatedAt: post.updatedAt.toISOString(),
          deletedAt: post.deletedAt ? post.deletedAt.toISOString() : null,
          pinnedAt: post.pinnedAt ? post.pinnedAt.toISOString() : null,
          editedAt: post.lastEditedAt ? post.lastEditedAt.toISOString() : null,
          scheduledAt: null, // Field not in current Prisma model
          attachments,
          user: post.user ? { ...post.user, id: post.userId } : { id: post.userId, username: "Unknown", name: "Unknown", avatar: "" },
          engagement: {
            likesCount: post.likesCount ?? 0,
            commentsCount: post.commentsCount ?? 0,
            sharesCount: post.sharesCount ?? 0,
            isLiked: userLikesMap[post.id] ?? false,
            isShared: userSharesMap[post.id] ?? false,
          },
        };
      });

      //  FIX: Use post ID as cursor (for next page pagination)
      const nextCursor = hasMore ? enrichedPosts[enrichedPosts.length - 1].id : undefined;

      return {
        pages: enrichedPosts,
        nextCursor,
      };
    } catch (err: unknown) {
      throw new CustomError(grpc.status.INTERNAL, (err as Error).message);
    }
  }

  async deletePostServ(postId: string): Promise<DeletePostResponse> {
    try {
      const isthere = await this._postRepository.findPost(postId);

      if (!isthere) {
        throw new CustomError(grpc.status.NOT_FOUND, "Post Not found");
      }

      // 1. Get media IDs before deletion for cleanup saga
      const mediaIds = await this._postRepository.getMediaIds(postId);

      const deletedPost = await this._postRepository.deletePost(postId);

      // 2. Remove post from all user feeds
      if (this.feedService) {
        try {
          await this.feedService.removeFromAllFeeds(postId);
        } catch (feedError: unknown) {
          logger.error("Error removing post from feeds (non-fatal)", {
            error: (feedError as Error).message,
            postId,
          });
        }
      }

      // 3. Publish POST_DELETED event for Media Service cleanup
      if (this.outboxService && mediaIds.length > 0) {
        try {
          await this.outboxService.createOutboxEvent({
            aggregateType: OutboxAggregateType.POST,
            aggregateId: postId,
            type: "POST_DELETED" as OutboxEventType, // Cast if enum not updated yet
            topic: KAFKA_TOPICS.POST_DELETED,
            key: isthere.userId, // Use userId as partition key
            payload: {
              postId,
              userId: isthere.userId,
              mediaIds,
              action: "POST_DELETED",
              timestamp: new Date().toISOString(),
            },
          });
          logger.info("Outbox event created: POST_DELETED", { postId, mediaCount: mediaIds.length });
        } catch (eventError: unknown) {
          logger.error("Error creating POST_DELETED event", {
            error: (eventError as Error).message,
            postId,
          });
        }
      }

      return deletedPost;
    } catch (err: unknown) {
      logger.error("delete Post error", { error: (err as Error).message });
      throw new CustomError(grpc.status.INTERNAL, (err as Error).message);
    }
  }

  async editPost(req: EditPostRequest): Promise<EditPostResponse> {
    try {
      // 1. Get post
      const post = await this._postRepository.findPost(req.postId);
      if (!post) {
        throw new CustomError(grpc.status.NOT_FOUND, "Post not found");
      }

      // 2. Authorization: Only owner can edit
      if (post.userId !== req.userId) {
        throw new CustomError(
          grpc.status.PERMISSION_DENIED,
          "Unauthorized: Only post owner can edit"
        );
      }

      // 3. Check if post is locked (attachments processing)
      if (post.isEditing) {
        throw new CustomError(
          grpc.status.FAILED_PRECONDITION,
          "Post is currently being edited. Please wait."
        );
      }

      // 4. Lock post for editing
      await this._postRepository.lockForEditing(req.postId);

      try {
        // 5. Validate attachments if adding
        if (req.addAttachmentIds && req.addAttachmentIds.length > 0) {
          const existingMedia = await this._postRepository.findMediaByIds(req.addAttachmentIds);
          if (existingMedia.length !== req.addAttachmentIds.length) {
            throw new CustomError(
              grpc.status.NOT_FOUND,
              "One or more media files not found"
            );
          }
        }

        // 6. Create new version (transaction via repository)
        const result = await this._postRepository.updatePostWithVersions({
            postId: req.postId,
            userId: req.userId,
            newContent: req.content ?? post.content,
            addAttachmentIds: req.addAttachmentIds,
            removeAttachmentIds: req.removeAttachmentIds,
            versionRepository: this.postVersionRepository
        });

        // 7. Invalidate caches
        await RedisCacheService.invalidatePostCaches(req.postId);

        return {
          success: true,
          post: result.post as any,
          newVersionNumber: result.versionNumber,
        };
      } catch (error: any) {
        // Unlock on error
        await this._postRepository.unlockEditing(req.postId);
        throw error;
      }
    } catch (err: unknown) {
      logger.error("Error editing post", {
        error: (err as Error).message,
        postId: req.postId,
        userId: req.userId,
      });
      throw err instanceof CustomError
        ? err
        : new CustomError(grpc.status.INTERNAL, "Failed to edit post");
    }
  }

  async getPostVersions(
    req: GetPostVersionsRequest
  ): Promise<GetPostVersionsResponse> {
    try {
      // Verify ownership
      const post = await this._postRepository.findPost(req.postId);
      if (!post || post.userId !== req.userId) {
        throw new CustomError(
          grpc.status.PERMISSION_DENIED,
          "Unauthorized"
        );
      }

      if (!this.postVersionRepository) {
        throw new CustomError(
          grpc.status.INTERNAL,
          "Post version repository not available"
        );
      }

      const versions = await this.postVersionRepository.getByPostId(req.postId);

      return {
        versions: versions.map((v) => ({
          id: v.id,
          postId: v.postId,
          versionNumber: v.versionNumber,
          content: v.content,
          attachmentIds: v.attachmentIds,
          editedAt: v.editedAt.toISOString(),
          editedById: v.editedById,
        })),
      };
    } catch (err: unknown) {
      logger.error("Error getting post versions", {
        error: (err as Error).message,
        postId: req.postId,
      });
      throw err instanceof CustomError
        ? err
        : new CustomError(grpc.status.INTERNAL, "Failed to get post versions");
    }
  }

  async restorePostVersion(
    req: RestorePostVersionRequest
  ): Promise<RestorePostVersionResponse> {
    try {
      if (!this.postVersionRepository) {
        throw new CustomError(
          grpc.status.INTERNAL,
          "Post version repository not available"
        );
      }

      // Get version
      const version = await this.postVersionRepository.getByPostAndVersion(
        req.postId,
        req.versionNumber
      );
      if (!version) {
        throw new CustomError(grpc.status.NOT_FOUND, "Version not found");
      }

      // Verify ownership
      const post = await this._postRepository.findPost(req.postId);
      if (!post || post.userId !== req.userId) {
        throw new CustomError(
          grpc.status.PERMISSION_DENIED,
          "Unauthorized"
        );
      }

      // Restore (create new version with old content)
      const editResult = await this.editPost({
        postId: req.postId,
        userId: req.userId,
        content: version.content,
        addAttachmentIds: version.attachmentIds,
        removeAttachmentIds: [],
        idempotencyKey: `restore-${req.postId}-${req.versionNumber}`,
      });

      return {
        success: true,
        post: editResult.post,
      };
    } catch (err: unknown) {
      logger.error("Error restoring post version", {
        error: (err as Error).message,
        postId: req.postId,
        versionNumber: req.versionNumber,
      });
      throw err instanceof CustomError
        ? err
        : new CustomError(grpc.status.INTERNAL, "Failed to restore post version");
    }
  }
}
