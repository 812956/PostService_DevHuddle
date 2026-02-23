"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const compression_1 = __importDefault(require("compression"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const logger_util_1 = __importDefault(require("./utils/logger.util"));
const error_util_1 = require("./utils/error.util");
const server_start_util_1 = require("./utils/server.start.util");
const outbox_processor_1 = require("./services/impliments/outbox.processor");
// Import repositories
const like_repository_1 = require("./repositories/impliments/like.repository");
const comment_repository_1 = require("./repositories/impliments/comment.repository");
const report_repository_1 = require("./repositories/impliments/report.repository");
const post_repository_1 = require("./repositories/impliments/post.repository");
const mention_repository_1 = require("./repositories/impliments/mention.repository");
const outbox_repository_1 = require("./repositories/impliments/outbox.repository");
const idempotency_repository_1 = require("./repositories/impliments/idempotency.repository");
const shareLink_repository_1 = require("./repositories/impliments/shareLink.repository");
// Import services
const like_service_1 = require("./services/impliments/like.service");
const comment_service_1 = require("./services/impliments/comment.service");
const report_service_1 = require("./services/impliments/report.service");
const outbox_service_1 = require("./services/impliments/outbox.service");
const mention_service_1 = require("./services/impliments/mention.service");
const shareLink_service_1 = require("./services/impliments/shareLink.service");
// Import controllers
const like_controller_1 = require("./controllers/impliments/like.controller");
const comment_controller_1 = require("./controllers/impliments/comment.controller");
const report_controller_1 = require("./controllers/impliments/report.controller");
const mention_controller_1 = require("./controllers/impliments/mention.controller");
const send_controller_1 = require("./controllers/impliments/send.controller");
const send_service_1 = require("./services/impliments/send.service");
const shareLink_controller_1 = require("./controllers/impliments/shareLink.controller");
// Import routes
const engagement_routes_1 = require("./routes/engagement.routes");
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const feed_routes_1 = __importDefault(require("./routes/feed.routes"));
const kafka_util_1 = require("./utils/kafka.util");
const kafka_util_2 = require("./utils/kafka.util");
dotenv_1.default.config();
server_start_util_1.app.use((0, helmet_1.default)());
server_start_util_1.app.use((0, compression_1.default)());
server_start_util_1.app.use(express_1.default.json());
server_start_util_1.app.use(express_1.default.urlencoded({ extended: true }));
server_start_util_1.app.use((0, cookie_parser_1.default)());
// Initialize repositories
const likeRepository = new like_repository_1.LikeRepository();
const commentRepository = new comment_repository_1.CommentRepository();
const reportRepository = new report_repository_1.ReportRepository();
const postRepository = new post_repository_1.PostRepository();
const mentionRepository = new mention_repository_1.MentionRepository();
const outboxRepository = new outbox_repository_1.OutboxRepository();
const idempotencyRepository = new idempotency_repository_1.IdempotencyRepository();
const shareLinkRepository = new shareLink_repository_1.ShareLinkRepository();
// Initialize services
const outboxService = new outbox_service_1.OutboxService(outboxRepository);
const outboxProcessor = new outbox_processor_1.OutboxProcessor(outboxRepository);
const mentionService = new mention_service_1.MentionService(mentionRepository, outboxService);
const likeService = new like_service_1.LikeService(likeRepository, postRepository, commentRepository, outboxService);
const commentService = new comment_service_1.CommentService(commentRepository, postRepository, mentionService, outboxService, likeRepository);
const sendService = new send_service_1.SendService(postRepository, outboxService);
const reportService = new report_service_1.ReportService(reportRepository, postRepository, commentRepository, outboxService);
const shareLinkService = new shareLink_service_1.ShareLinkService(shareLinkRepository, postRepository);
// Initialize controllers
const likeController = new like_controller_1.LikeController(likeService);
const commentController = new comment_controller_1.CommentController(commentService);
const sendController = new send_controller_1.SendController(sendService);
const reportController = new report_controller_1.ReportController(reportService);
const mentionController = new mention_controller_1.MentionController(mentionRepository, mentionService);
const shareLinkController = new shareLink_controller_1.ShareLinkController(shareLinkService);
// Setup routes
const engagementRouter = (0, engagement_routes_1.setupEngagementRoutes)(likeController, commentController, sendController, reportController, mentionController, shareLinkController, idempotencyRepository);
server_start_util_1.app.use("/", engagementRouter);
server_start_util_1.app.use("/admin", admin_routes_1.default);
server_start_util_1.app.use("/posts", feed_routes_1.default);
server_start_util_1.app.get("/health", (req, res) => {
    res.status(200).json({ status: "Post service is running" });
});
server_start_util_1.app.use((err, req, res, next) => {
    (0, error_util_1.sendErrorResponse)(res, err instanceof error_util_1.CustomError
        ? err
        : { status: 500, message: "Internal server error" });
});
const startOutboxProcessor = () => {
    outboxProcessor.start();
    logger_util_1.default.info("Outbox processor started");
};
(0, server_start_util_1.startServer)().then(() => {
    startOutboxProcessor();
});
// Graceful shutdown
process.on("SIGTERM", async () => {
    logger_util_1.default.info("SIGTERM received, shutting down gracefully");
    outboxProcessor.stop();
    await (0, kafka_util_1.disconnectProducer)();
    await (0, kafka_util_2.disconnectAdmin)();
    process.exit(0);
});
process.on("SIGINT", async () => {
    logger_util_1.default.info("SIGINT received, shutting down gracefully");
    outboxProcessor.stop();
    await (0, kafka_util_1.disconnectProducer)();
    await (0, kafka_util_2.disconnectAdmin)();
    process.exit(0);
});
