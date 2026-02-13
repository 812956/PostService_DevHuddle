

import compression from "compression";
import dotenv from "dotenv";
import express, { Express, NextFunction, Request, Response } from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import logger from "./utils/logger.util";
import { CustomError, sendErrorResponse } from "./utils/error.util";
import { app, startServer } from "./utils/server.start.util";
import path from "path";
import { OutboxProcessor } from "./services/impliments/outbox.processor";

// Import repositories
import { LikeRepository } from "./repositories/impliments/like.repository";
import { CommentRepository } from "./repositories/impliments/comment.repository";
import { ReportRepository } from "./repositories/impliments/report.repository";
import { PostRepository } from "./repositories/impliments/post.repository";
import { MentionRepository } from "./repositories/impliments/mention.repository";
import { OutboxRepository } from "./repositories/impliments/outbox.repository";
import { IdempotencyRepository } from "./repositories/impliments/idempotency.repository";
import { ShareLinkRepository } from "./repositories/impliments/shareLink.repository";

// Import services
import { LikeService } from "./services/impliments/like.service";
import { CommentService } from "./services/impliments/comment.service";
import { ReportService } from "./services/impliments/report.service";
import { OutboxService } from "./services/impliments/outbox.service";
import { MentionService } from "./services/impliments/mention.service";
import { ShareLinkService } from "./services/impliments/shareLink.service";

// Import controllers
import { LikeController } from "./controllers/impliments/like.controller";
import { CommentController } from "./controllers/impliments/comment.controller";
import { ReportController } from "./controllers/impliments/report.controller";
import { MentionController } from "./controllers/impliments/mention.controller";
import { SendController } from "./controllers/impliments/send.controller";
import { SendService } from "./services/impliments/send.service";
import { ShareLinkController } from "./controllers/impliments/shareLink.controller";

// Import routes
import { setupEngagementRoutes } from "./routes/engagement.routes";
import adminRouter from "./routes/admin.routes";
import feedRouter from "./routes/feed.routes";
import { disconnectProducer } from "./utils/kafka.util";
import { disconnectAdmin } from "./utils/kafka.util";

dotenv.config();

app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Initialize repositories
const likeRepository = new LikeRepository();
const commentRepository = new CommentRepository();
const reportRepository = new ReportRepository();
const postRepository = new PostRepository();
const mentionRepository = new MentionRepository();
const outboxRepository = new OutboxRepository();
const idempotencyRepository = new IdempotencyRepository();
const shareLinkRepository = new ShareLinkRepository();

// Initialize services
const outboxService = new OutboxService(outboxRepository);
const outboxProcessor = new OutboxProcessor(outboxRepository);
const mentionService = new MentionService(mentionRepository, outboxService);
const likeService = new LikeService(
  likeRepository,
  postRepository,
  commentRepository,
  outboxService
);
const commentService = new CommentService(
  commentRepository,
  postRepository,
  mentionService,
  outboxService,
  likeRepository
);
const sendService = new SendService(
  postRepository,
  outboxService
);
const reportService = new ReportService(
  reportRepository,
  postRepository,
  commentRepository,
  outboxService
);
const shareLinkService = new ShareLinkService(
  shareLinkRepository,
  postRepository
);

// Initialize controllers
const likeController = new LikeController(likeService);
const commentController = new CommentController(commentService);
const sendController = new SendController(sendService);
const reportController = new ReportController(reportService);
const mentionController = new MentionController(
  mentionRepository,
  mentionService
);
const shareLinkController = new ShareLinkController(shareLinkService);

// Setup routes
const engagementRouter = setupEngagementRoutes(
  likeController,
  commentController,
  sendController,
  reportController,
  mentionController,
  shareLinkController,
  idempotencyRepository
);

app.use("/api/v1", engagementRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/posts", feedRouter);

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "Post service is running" });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  sendErrorResponse(
    res,
    err instanceof CustomError
      ? err
      : { status: 500, message: "Internal server error" }
  );
});

const startOutboxProcessor = () => {
  outboxProcessor.start();
  logger.info("Outbox processor started");
};

startServer().then(() => {
  startOutboxProcessor();
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down gracefully");
  outboxProcessor.stop();
  await disconnectProducer();
  await disconnectAdmin();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received, shutting down gracefully");
  outboxProcessor.stop();
  await disconnectProducer();
  await disconnectAdmin();
  process.exit(0);
});
