"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = exports.app = void 0;
const logger_util_1 = __importDefault(require("./logger.util"));
const express_1 = __importDefault(require("express"));
const redis_util_1 = require("./redis.util");
const grpc_server_1 = require("../grpc-server");
exports.app = (0, express_1.default)();
const startServer = async () => {
    try {
        logger_util_1.default.info("Prisma connection established");
        await (0, redis_util_1.connectRedis)();
        logger_util_1.default.info("Redis connection established");
        const PORT = process.env.PORT || 3002;
        exports.app.listen(PORT, () => {
            logger_util_1.default.info(`Auth Service running on port ${PORT}`);
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
