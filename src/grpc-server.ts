import * as grpc from "@grpc/grpc-js";
import logger from "./utils/logger.util";
import {
  CreatePostRequest,
  CreatePostResponse,
  DeletePostRequest,
  DeletePostResponse,
  DeleteUnusedMediasRequest,
  DeleteUnusedMediasResponse,
  ListPostsRequest,
  ListPostsResponse,
  PostServiceServer,
  PostServiceService,
  SubmitPostRequest,
  SubmitPostResponse,
  UploadMediaRequest,
  UploadMediaResponse,
  ReportPostRequest,
  ReportPostResponse,
  GetPostShareLinkRequest,
  GetPostShareLinkResponse,
  ResolveShareLinkRequest,
  ResolveShareLinkResponse,
  SharePostRequest,
  SharePostResponse,
  EditPostRequest,
  EditPostResponse,
  GetPostVersionsRequest,
  GetPostVersionsResponse,
  RestorePostVersionRequest,
  RestorePostVersionResponse,
} from "./grpc/generated/post";
import { PostController } from "./controllers/impliments/feed.controller";
import { CustomError } from "./utils/error.util";
import { PostService } from "./services/impliments/post.service";
import { PostRepository } from "./repositories/impliments/post.repository";
import { LikeRepository } from "./repositories/impliments/like.repository";
import { CommentRepository } from "./repositories/impliments/comment.repository";
import { ShareRepository } from "./repositories/impliments/share.repository";
import { PostVersionRepository } from "./repositories/impliments/postVersion.repository";
import { ShareLinkRepository } from "./repositories/impliments/shareLink.repository";
import { MediaRepository } from "./repositories/impliments/media.repository";
import { MediaService } from "./services/impliments/media.service";
import { MediaController } from "./controllers/impliments/media.controller";
import { ShareLinkService } from "./services/impliments/shareLink.service";
import { ReportService } from "./services/impliments/report.service";
import { ReportRepository } from "./repositories/impliments/report.repository";
import { IOutboxService } from "./services/interfaces/IOutboxService";
import { OutboxService } from "./services/impliments/outbox.service";
import { OutboxRepository } from "./repositories/impliments/outbox.repository";
import { grpcHandler } from "./utils/grpc.helper";
// ✅ NEW: Import feed-related services
import { FeedRepository } from "./repositories/impliments/feed.repository";
import { FeedRankingService } from "./services/impliments/feed-ranking.service";
import { FeedService } from "./services/impliments/feed.service";

const postRepository = new PostRepository();
const likeRepository = new LikeRepository();
const commentRepository = new CommentRepository();
const shareRepository = new ShareRepository();
const postVersionRepository = new PostVersionRepository();
const outboxRepository = new OutboxRepository();
const outboxService = new OutboxService(outboxRepository);

// ✅ NEW: Initialize feed services
const feedRepository = new FeedRepository();
const feedRankingService = new FeedRankingService(postRepository);
const feedService = new FeedService(
  feedRepository,
  feedRankingService,
  postRepository
);

const postService = new PostService(
  postRepository,
  likeRepository,
  commentRepository,
  shareRepository,
  postVersionRepository,
  feedService, // ✅ NEW: Inject feed service
  outboxService // ✅ NEW: Inject outbox service
);
const postController = new PostController(postService);

// Share link service setup
const shareLinkRepository = new ShareLinkRepository();
const shareLinkService = new ShareLinkService(shareLinkRepository, postRepository);

// Report service setup (simplified - you may need to adjust based on your actual setup)
// const reportRepository = new ReportRepository();
// const outboxService = new OutboxService(); // You'll need to implement this
// const reportService = new ReportService(reportRepository, postRepository, commentRepository, outboxService);

const mediaRepository = new MediaRepository();
const mediaService = new MediaService(mediaRepository);
const mediaController = new MediaController(mediaService);



const postServiceActions: PostServiceServer = {
  // createPost: grpcHandler(postController.feedPosting.bind(postController)),
  listPosts: grpcHandler(postController.getPostsController.bind(postController)),
  uploadMedia: grpcHandler(
    mediaController.uploadMediaController.bind(mediaController)
  ),
  submitPost: grpcHandler(
    postController.submitPostController.bind(postController)
  ),
  deletePost: grpcHandler(
    postController.deletePostController.bind(postController)
  ),
  deleteUnusedMedias: grpcHandler(
    mediaController.deleteUnusedMedia.bind(mediaController)
  ),
  
  // New endpoints
  reportPost: grpcHandler(async (request: ReportPostRequest) => {
    // This will be handled by REST API, but we can add gRPC handler if needed
    throw new CustomError(grpc.status.UNIMPLEMENTED, "Use REST API for reporting");
  }),
  
  getPostShareLink: grpcHandler(async (request: GetPostShareLinkRequest): Promise<GetPostShareLinkResponse> => {
    const result = await shareLinkService.generateShareLink(
      request.postId,
      request.userId,
      {
        generateShort: request.generateShort,
        isPrivate: request.isPrivate,
      }
    );
    return {
      canonicalUrl: result.canonicalUrl,
      shortUrl: result.shortUrl,
      shareToken: result.shareToken,
      expiresAt: result.expiresAt ? Math.floor(result.expiresAt.getTime() / 1000) : undefined,
    };
  }),
  
  resolveShareLink: grpcHandler(async (request: ResolveShareLinkRequest): Promise<ResolveShareLinkResponse> => {
    const result = await shareLinkService.resolveShareLink(
      request.tokenOrShortId
    );
    return {
      postId: result.postId,
      redirectUrl: result.redirectUrl,
    };
  }),
  
  sharePost: grpcHandler(async (request: SharePostRequest) => {
    // This will be handled by REST API, but we can add gRPC handler if needed
    throw new CustomError(grpc.status.UNIMPLEMENTED, "Use REST API for sharing");
  }),
  
  editPost: grpcHandler(async (request: EditPostRequest): Promise<EditPostResponse> => {
    return await postService.editPost(request);
  }),
  
  getPostVersions: grpcHandler(async (request: GetPostVersionsRequest): Promise<GetPostVersionsResponse> => {
    return await postService.getPostVersions(request);
  }),
  
  restorePostVersion: grpcHandler(async (request: RestorePostVersionRequest): Promise<RestorePostVersionResponse> => {
    return await postService.restorePostVersion(request);
  }),
};
export const grpcServer = new grpc.Server();
grpcServer.addService(PostServiceService, postServiceActions);

const GRPC_PORT = process.env.GRPC_PORT || "50051";
grpcServer.bindAsync(
  `0.0.0.0:${GRPC_PORT}`,
  grpc.ServerCredentials.createInsecure(),
  () => {
    logger.info(`✅ gRPC server running on port ${GRPC_PORT}`);
  }
);
