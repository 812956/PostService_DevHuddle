"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = exports.app = void 0;
const logger_util_1 = __importDefault(require("./logger.util"));
const express_1 = __importDefault(require("express"));
const grpc_server_1 = require("../grpc-server");
const redis_config_1 = require("../config/redis.config");
const kafka_util_1 = require("./kafka.util");
const admin_consumer_1 = require("../consumers/admin.consumer");
exports.app = (0, express_1.default)();
const startServer = async () => {
    try {
        logger_util_1.default.info("Prisma connection established");
        await (0, redis_config_1.connectRedis)();
        logger_util_1.default.info("Redis connection established");
        await (0, kafka_util_1.initializeKafkaTopics)();
        logger_util_1.default.info("Kafka topics initialized");
        await (0, admin_consumer_1.startAdminConsumer)();
        logger_util_1.default.info("Admin consumer started");
        const PORT = process.env.PORT || 3002;
        exports.app.listen(PORT, () => {
            logger_util_1.default.info(`Post Service running on port ${PORT}`);
        });
        grpc_server_1.grpcServer;
    }
    catch (err) {
        logger_util_1.default.error("Failed to start server", {
            error: err.message,
            stack: err.stack,
        });
        process.exit(1);
    }
};
exports.startServer = startServer;
// Graceful shutdown
const gracefulShutdown = async () => {
    logger_util_1.default.info("Shutting down gracefully...");
    // Disconnect Kafka clients
    await (0, kafka_util_1.disconnectProducer)();
    await (0, kafka_util_1.disconnectAdmin)();
    logger_util_1.default.info("Kafka clients disconnected");
};
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
