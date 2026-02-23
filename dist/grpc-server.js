"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.grpcServer = void 0;
const grpc = __importStar(require("@grpc/grpc-js"));
const logger_util_1 = __importDefault(require("./utils/logger.util"));
const post_1 = require("./grpc/generated/post");
const feed_controller_1 = require("./controllers/impliments/feed.controller");
const error_util_1 = require("./utils/error.util");
const post_service_1 = require("./services/impliments/post.service");
const post_repository_1 = require("./repositories/impliments/post.repository");
const like_repository_1 = require("./repositories/impliments/like.repository");
const comment_repository_1 = require("./repositories/impliments/comment.repository");
const share_repository_1 = require("./repositories/impliments/share.repository");
const postVersion_repository_1 = require("./repositories/impliments/postVersion.repository");
const shareLink_repository_1 = require("./repositories/impliments/shareLink.repository");
const media_repository_1 = require("./repositories/impliments/media.repository");
const media_service_1 = require("./services/impliments/media.service");
const media_controller_1 = require("./controllers/impliments/media.controller");
const shareLink_service_1 = require("./services/impliments/shareLink.service");
const outbox_service_1 = require("./services/impliments/outbox.service");
const outbox_repository_1 = require("./repositories/impliments/outbox.repository");
const grpc_helper_1 = require("./utils/grpc.helper");
// ✅ NEW: Import feed-related services
const feed_repository_1 = require("./repositories/impliments/feed.repository");
const feed_ranking_service_1 = require("./services/impliments/feed-ranking.service");
const feed_service_1 = require("./services/impliments/feed.service");
const postRepository = new post_repository_1.PostRepository();
const likeRepository = new like_repository_1.LikeRepository();
const commentRepository = new comment_repository_1.CommentRepository();
const shareRepository = new share_repository_1.ShareRepository();
const postVersionRepository = new postVersion_repository_1.PostVersionRepository();
const outboxRepository = new outbox_repository_1.OutboxRepository();
const outboxService = new outbox_service_1.OutboxService(outboxRepository);
// ✅ NEW: Initialize feed services
const feedRepository = new feed_repository_1.FeedRepository();
const feedRankingService = new feed_ranking_service_1.FeedRankingService(postRepository);
const feedService = new feed_service_1.FeedService(feedRepository, feedRankingService, postRepository);
const postService = new post_service_1.PostService(postRepository, likeRepository, commentRepository, shareRepository, postVersionRepository, feedService, // ✅ NEW: Inject feed service
outboxService // ✅ NEW: Inject outbox service
);
const postController = new feed_controller_1.PostController(postService);
// Share link service setup
const shareLinkRepository = new shareLink_repository_1.ShareLinkRepository();
const shareLinkService = new shareLink_service_1.ShareLinkService(shareLinkRepository, postRepository);
// Report service setup (simplified - you may need to adjust based on your actual setup)
// const reportRepository = new ReportRepository();
// const outboxService = new OutboxService(); // You'll need to implement this
// const reportService = new ReportService(reportRepository, postRepository, commentRepository, outboxService);
const mediaRepository = new media_repository_1.MediaRepository();
const mediaService = new media_service_1.MediaService(mediaRepository);
const mediaController = new media_controller_1.MediaController(mediaService);
const postServiceActions = {
    // createPost: grpcHandler(postController.feedPosting.bind(postController)),
    listPosts: (0, grpc_helper_1.grpcHandler)(postController.getPostsController.bind(postController)),
    uploadMedia: (0, grpc_helper_1.grpcHandler)(mediaController.uploadMediaController.bind(mediaController)),
    submitPost: (0, grpc_helper_1.grpcHandler)(postController.submitPostController.bind(postController)),
    deletePost: (0, grpc_helper_1.grpcHandler)(postController.deletePostController.bind(postController)),
    deleteUnusedMedias: (0, grpc_helper_1.grpcHandler)(mediaController.deleteUnusedMedia.bind(mediaController)),
    // New endpoints
    reportPost: (0, grpc_helper_1.grpcHandler)(async (request) => {
        // This will be handled by REST API, but we can add gRPC handler if needed
        throw new error_util_1.CustomError(grpc.status.UNIMPLEMENTED, "Use REST API for reporting");
    }),
    getPostShareLink: (0, grpc_helper_1.grpcHandler)(async (request) => {
        const result = await shareLinkService.generateShareLink(request.postId, request.userId, {
            generateShort: request.generateShort,
            isPrivate: request.isPrivate,
        });
        return {
            canonicalUrl: result.canonicalUrl,
            shortUrl: result.shortUrl,
            shareToken: result.shareToken,
            expiresAt: result.expiresAt ? Math.floor(result.expiresAt.getTime() / 1000) : undefined,
        };
    }),
    resolveShareLink: (0, grpc_helper_1.grpcHandler)(async (request) => {
        const result = await shareLinkService.resolveShareLink(request.tokenOrShortId);
        return {
            postId: result.postId,
            redirectUrl: result.redirectUrl,
        };
    }),
    sharePost: (0, grpc_helper_1.grpcHandler)(async (request) => {
        // This will be handled by REST API, but we can add gRPC handler if needed
        throw new error_util_1.CustomError(grpc.status.UNIMPLEMENTED, "Use REST API for sharing");
    }),
    editPost: (0, grpc_helper_1.grpcHandler)(async (request) => {
        return await postService.editPost(request);
    }),
    getPostVersions: (0, grpc_helper_1.grpcHandler)(async (request) => {
        return await postService.getPostVersions(request);
    }),
    restorePostVersion: (0, grpc_helper_1.grpcHandler)(async (request) => {
        return await postService.restorePostVersion(request);
    }),
};
exports.grpcServer = new grpc.Server();
exports.grpcServer.addService(post_1.PostServiceService, postServiceActions);
const GRPC_PORT = process.env.GRPC_PORT || "50051";
exports.grpcServer.bindAsync(`0.0.0.0:${GRPC_PORT}`, grpc.ServerCredentials.createInsecure(), () => {
    logger_util_1.default.info(`✅ gRPC server running on port ${GRPC_PORT}`);
});
