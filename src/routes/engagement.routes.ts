import { Router } from "express";
import { LikeController } from "../controllers/impliments/like.controller";
import { CommentController } from "../controllers/impliments/comment.controller";
import { ShareController } from "../controllers/impliments/share.controller";
import { ReportController } from "../controllers/impliments/report.controller";
import { idempotencyMiddleware } from "../middlewares/idempotency.middleware";
import { createRateLimiters } from "../middlewares/rateLimit.middleware";
import { IIdempotencyRepository } from "../repositories/interface/IIdempotencyRepository";
import { MentionController } from "../controllers/impliments/mention.controller";

const router = Router();
const rateLimiters = createRateLimiters();

export const setupEngagementRoutes = (
  likeController: LikeController,
  commentController: CommentController,
  shareController: ShareController,
  reportController: ReportController,
  mentionController: MentionController,
  idempotencyRepository: IIdempotencyRepository
) => {
  // Like routes
  router.post(
    "/posts/:postId/likes",
    rateLimiters.strict,
    idempotencyMiddleware(idempotencyRepository),
    likeController.likePost.bind(likeController)
  );

  router.delete(
    "/posts/:postId/likes",
    rateLimiters.strict,
    idempotencyMiddleware(idempotencyRepository),
    likeController.unlikePost.bind(likeController)
  );

  router.get(
    "/posts/:postId/likes/count",
    rateLimiters.moderate,
    likeController.getPostLikeCount.bind(likeController)
  );

  router.get(
    "/posts/:postId/likes/status",
    rateLimiters.moderate,
    likeController.isPostLiked.bind(likeController)
  );

  // Comment routes
  router.post(
    "/posts/:postId/comments",
    rateLimiters.strict,
    idempotencyMiddleware(idempotencyRepository),
    commentController.createComment.bind(commentController)
  );

  router.patch(
    "/comments/:commentId",
    rateLimiters.strict,
    idempotencyMiddleware(idempotencyRepository),
    commentController.updateComment.bind(commentController)
  );

  router.delete(
    "/comments/:commentId",
    rateLimiters.strict,
    idempotencyMiddleware(idempotencyRepository),
    commentController.deleteComment.bind(commentController)
  );

  router.get(
    "/posts/:postId/comments",
    rateLimiters.moderate,
    commentController.getComments.bind(commentController)
  );

  router.get(
    "/posts/:postId/comments/count",
    rateLimiters.moderate,
    commentController.getCommentCount.bind(commentController)
  );

  // Share routes
  router.post(
    "/posts/:postId/share",
    rateLimiters.strict,
    idempotencyMiddleware(idempotencyRepository),
    shareController.sharePost.bind(shareController)
  );

  router.get(
    "/posts/:postId/shares/count",
    rateLimiters.moderate,
    shareController.getShareCount.bind(shareController)
  );

  router.get(
    "/posts/:postId/shares/status",
    rateLimiters.moderate,
    shareController.hasShared.bind(shareController)
  );

  // Report routes
  router.post(
    "/posts/:postId/report",
    rateLimiters.strict,
    idempotencyMiddleware(idempotencyRepository),
    reportController.reportPost.bind(reportController)
  );

  router.post(
    "/comments/:commentId/report",
    rateLimiters.strict,
    idempotencyMiddleware(idempotencyRepository),
    reportController.reportComment.bind(reportController)
  );

  router.get(
    "/reports/count",
    rateLimiters.moderate,
    reportController.getReportCount.bind(reportController)
  );

  router.get(
    "/reports/status",
    rateLimiters.moderate,
    reportController.hasReported.bind(reportController)
  );

  // Mention routes
  router.get(
    "/posts/:postId/mentions",
    rateLimiters.moderate,
    mentionController.getPostMentions.bind(mentionController)
  );

  router.get(
    "/comments/:commentId/mentions",
    rateLimiters.moderate,
    mentionController.getCommentMentions.bind(mentionController)
  );

  // Optional: Manual mention processing endpoint (for testing/reprocessing)
  router.post(
    "/mentions/process",
    rateLimiters.strict,
    idempotencyMiddleware(idempotencyRepository),
    mentionController.processMentions.bind(mentionController)
  );

  return router;
};