import { Router } from "express";
import { LikeController } from "../controllers/impliments/like.controller";
import { CommentController } from "../controllers/impliments/comment.controller";
import { SendController } from "../controllers/impliments/send.controller";
import { ReportController } from "../controllers/impliments/report.controller";
import { ShareLinkController } from "../controllers/impliments/shareLink.controller";
import { idempotencyMiddleware } from "../middlewares/idempotency.middleware";
import { createRateLimiters } from "../middlewares/rateLimit.middleware";
import { IIdempotencyRepository } from "../repositories/interface/IIdempotencyRepository";
import { MentionController } from "../controllers/impliments/mention.controller";
import { validateDto } from "../middleware/validation.middleware";
import { 
  CreateCommentDto, 
  UpdateCommentDto, 
  SendPostDto, 
  ReportPostDto, 
  ReportCommentDto 
} from "../dto/post.dto";

const router = Router();
const rateLimiters = createRateLimiters();

export const setupEngagementRoutes = (
  likeController: LikeController,
  commentController: CommentController,
  sendController: SendController,
  reportController: ReportController,
  mentionController: MentionController,
  shareLinkController: ShareLinkController,
  idempotencyRepository: IIdempotencyRepository
) => {
  // Like routes
  router.post(
    "/posts/:postId/likes",
    // rateLimiters.strict,
    idempotencyMiddleware(idempotencyRepository),
    likeController.likePost.bind(likeController)
  );

  router.delete(
    "/posts/:postId/likes",
    // rateLimiters.strict,
    idempotencyMiddleware(idempotencyRepository),
    likeController.unlikePost.bind(likeController)
  );

  router.get(
    "/posts/:postId/likes/count",
    // rateLimiters.moderate,
    likeController.getPostLikeCount.bind(likeController)
  );

  router.get(
    "/posts/:postId/likes/status",
    // rateLimiters.moderate,
    likeController.isPostLiked.bind(likeController)
  );

  // Comment Like routes
  router.post(
    "/comments/:commentId/likes",
    // rateLimiters.strict,
    idempotencyMiddleware(idempotencyRepository),
    likeController.likeComment.bind(likeController)
  );

  router.delete(
    "/comments/:commentId/likes",
    // rateLimiters.strict,
    idempotencyMiddleware(idempotencyRepository),
    likeController.unlikeComment.bind(likeController)
  );

  router.get(
    "/comments/:commentId/likes/count",
    // rateLimiters.moderate,
    likeController.getCommentLikeCount.bind(likeController)
  );

  router.get(
    "/comments/:commentId/likes/status",
    // rateLimiters.moderate,
    likeController.isCommentLiked.bind(likeController)
  );

  // Comment routes
  router.post(
    "/posts/:postId/comments",
    // rateLimiters.strict,
    idempotencyMiddleware(idempotencyRepository),
    idempotencyMiddleware(idempotencyRepository),
    validateDto(CreateCommentDto),
    commentController.createComment.bind(commentController)
  );

  router.patch(
    "/comments/:commentId",
    // rateLimiters.strict,
    idempotencyMiddleware(idempotencyRepository),
    idempotencyMiddleware(idempotencyRepository),
    validateDto(UpdateCommentDto),
    commentController.updateComment.bind(commentController)
  );

  router.delete(
    "/comments/:commentId",
    // rateLimiters.strict,
    idempotencyMiddleware(idempotencyRepository),
    commentController.deleteComment.bind(commentController)
  );

  router.get(
    "/posts/:postId/comments",
    // rateLimiters.moderate,
    commentController.getComments.bind(commentController)
  );

  router.get(
    "/posts/:postId/comments/preview",
    // rateLimiters.moderate,
    commentController.getCommentPreview.bind(commentController)
  );

  router.get(
    "/posts/:postId/comments/count",
    // rateLimiters.moderate,
    commentController.getCommentCount.bind(commentController)
  );

  router.get(
    "/comments/:commentId/replies",
    // rateLimiters.moderate,
    commentController.getReplies.bind(commentController)
  );

  // Send Post routes
  router.get(
    "/connections",
    // rateLimiters.moderate,
    sendController.getConnections.bind(sendController)
  );

  router.post(
    "/posts/:postId/send",
    // rateLimiters.strict,
    idempotencyMiddleware(idempotencyRepository),
    idempotencyMiddleware(idempotencyRepository),
    validateDto(SendPostDto),
    sendController.sendPost.bind(sendController)
  );

  // Report routes
  router.post(
    "/posts/:postId/report",
    // rateLimiters.strict,
    idempotencyMiddleware(idempotencyRepository),
    idempotencyMiddleware(idempotencyRepository),
    validateDto(ReportPostDto),
    reportController.reportPost.bind(reportController)
  );

  router.post(
    "/comments/:commentId/report",
    // rateLimiters.strict,
    idempotencyMiddleware(idempotencyRepository),
    idempotencyMiddleware(idempotencyRepository),
    validateDto(ReportCommentDto),
    reportController.reportComment.bind(reportController)
  );

  router.get(
    "/reports/count",
    // rateLimiters.moderate,
    reportController.getReportCount.bind(reportController)
  );

  router.get(
    "/reports/status",
    // rateLimiters.moderate,
    reportController.hasReported.bind(reportController)
  );

  // Mention routes
  router.get(
    "/posts/:postId/mentions",
    // rateLimiters.moderate,
    mentionController.getPostMentions.bind(mentionController)
  );

  router.get(
    "/comments/:commentId/mentions",
    // rateLimiters.moderate,
    mentionController.getCommentMentions.bind(mentionController)
  );

  // Optional: Manual mention processing endpoint (for testing/reprocessing)
  router.post(
    "/mentions/process",
    // rateLimiters.strict,
    idempotencyMiddleware(idempotencyRepository),
    mentionController.processMentions.bind(mentionController)
  );

  // Share Link routes
  router.get(
    "/posts/:postId/share-link",
    // rateLimiters.moderate,
    shareLinkController.getShareLink.bind(shareLinkController)
  );

  router.get(
    "/share/:tokenOrShortId",
    // rateLimiters.moderate,
    shareLinkController.resolveShareLink.bind(shareLinkController)
  );

  return router;
};