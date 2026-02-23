import { Router } from "express";
import { PostController } from "../controllers/impliments/feed.controller";
import { validateDto } from "../middleware/validation.middleware";
import { CreatePostDto } from "../dto/post.dto";
import { MediaController } from "../controllers/impliments/media.controller";
import { PostService } from "../services/impliments/post.service";
import { MediaService } from "../services/impliments/media.service";
import { PostRepository } from "../repositories/impliments/post.repository";
import { LikeRepository } from "../repositories/impliments/like.repository";
import { CommentRepository } from "../repositories/impliments/comment.repository";
import { ShareRepository } from "../repositories/impliments/share.repository";
import { PostVersionRepository } from "../repositories/impliments/postVersion.repository";
import { MediaRepository } from "../repositories/impliments/media.repository";
import { OutboxRepository } from "../repositories/impliments/outbox.repository";
import { OutboxService } from "../services/impliments/outbox.service";
import { FeedRepository } from "../repositories/impliments/feed.repository";
import { FeedRankingService } from "../services/impliments/feed-ranking.service";
import { FeedService } from "../services/impliments/feed.service";

const router = Router();

// Initialize repositories
const postRepository = new PostRepository();
const likeRepository = new LikeRepository();
const commentRepository = new CommentRepository();
const shareRepository = new ShareRepository();
const postVersionRepository = new PostVersionRepository();
const mediaRepository = new MediaRepository();
const outboxRepository = new OutboxRepository();
const feedRepository = new FeedRepository();

// Initialize services
const outboxService = new OutboxService(outboxRepository);
const feedRankingService = new FeedRankingService(postRepository);
const feedService = new FeedService(feedRepository, feedRankingService, postRepository);
const postService = new PostService(
  postRepository,
  likeRepository,
  commentRepository,
  shareRepository,
  postVersionRepository,
  feedService,
  outboxService
);
const postController = new PostController(postService);
const mediaService = new MediaService(mediaRepository);
const mediaController = new MediaController(mediaService);

// HTTP route handlers - clean routes using bind()
// Note: Authentication is handled by API Gateway, so no jwtMiddleware needed here
router
  // Submit post
  .post("/submit", validateDto(CreatePostDto), postController.submitPostHttp.bind(postController))

  // List posts
  .get("/list", postController.listPostsHttp.bind(postController))

  // Upload media
  .post("/media", mediaController.uploadMediaHttp.bind(mediaController))

  // Delete post by body (backward compatibility)
  .delete("/delete", postController.deletePostFromBodyHttp.bind(postController))

  // Delete unused medias
  .delete("/medias/unused", mediaController.deleteUnusedMediaHttp.bind(mediaController))

  // Delete post by path parameter
  // CRITICAL: This must be defined AFTER specific paths like /delete and /medias/unused
  .patch("/:postId", postController.editPostHttp.bind(postController))
  .get("/:postId", postController.getPostByIdHttp.bind(postController))
  .delete("/:postId", postController.deletePostHttp.bind(postController));

export default router;

