// import compression from "compression";
// import dotenv from "dotenv";
// import express, { Express, NextFunction, Request, Response } from "express";
// import helmet from "helmet";
// import cookieParser from "cookie-parser";
// import logger from "./utils/logger.util";
// import { CustomError, sendErrorResponse } from "./utils/error.util";
// import { app, startServer } from "./utils/server.start.util";
// import path from "path"

// dotenv.config();

// app.use(helmet());
// app.use(compression());
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// app.use(cookieParser());

// // app.use((req: Request, res: Response, next: NextFunction) => {
// //   logger.info(`${req.method} ${req.url}`);
// //   next();
// // });

// app.get("/health", (req: Request, res: Response) => {
//   res.status(200).json({ status: "Post service is running" });
// });

// app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
//   sendErrorResponse(
//     res,
//     err instanceof CustomError
//       ? err
//       : { status: 500, message: "Internal server error" }
//   );
// });

// startServer();

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
import { ShareRepository } from "./repositories/impliments/share.repository";
import { ReportRepository } from "./repositories/impliments/report.repository";
import { PostRepository } from "./repositories/impliments/post.repository";
import { MentionRepository } from "./repositories/impliments/mention.repository";
import { OutboxRepository } from "./repositories/impliments/outbox.repository";
import { IdempotencyRepository } from "./repositories/impliments/idempotency.repository";

// Import services
import { LikeService } from "./services/impliments/like.service";
import { CommentService } from "./services/impliments/comment.service";
import { ShareService } from "./services/impliments/share.service";
import { ReportService } from "./services/impliments/report.service";
import { OutboxService } from "./services/impliments/outbox.service";
import { MentionService } from "./services/impliments/mention.service";

// Import controllers
import { LikeController } from "./controllers/impliments/like.controller";
import { CommentController } from "./controllers/impliments/comment.controller";
import { ShareController } from "./controllers/impliments/share.controller";
import { ReportController } from "./controllers/impliments/report.controller";
import { MentionController } from "./controllers/impliments/mention.controller";

// Import routes
import { setupEngagementRoutes } from "./routes/engagement.routes";

dotenv.config();

app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Initialize repositories
const likeRepository = new LikeRepository();
const commentRepository = new CommentRepository();
const shareRepository = new ShareRepository();
const reportRepository = new ReportRepository();
const postRepository = new PostRepository();
const mentionRepository = new MentionRepository();
const outboxRepository = new OutboxRepository();
const idempotencyRepository = new IdempotencyRepository();

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
  outboxService
);
const shareService = new ShareService(
  shareRepository,
  postRepository,
  outboxService
);
const reportService = new ReportService(
  reportRepository,
  postRepository,
  commentRepository,
  outboxService
);

// Initialize controllers
const likeController = new LikeController(likeService);
const commentController = new CommentController(commentService);
const shareController = new ShareController(shareService);
const reportController = new ReportController(reportService);
const mentionController = new MentionController(
  mentionRepository,
  mentionService
);
// Setup routes
const engagementRouter = setupEngagementRoutes(
  likeController,
  commentController,
  shareController,
  reportController,
  mentionController,
  idempotencyRepository
);

app.use("/api/v1", engagementRouter);

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
