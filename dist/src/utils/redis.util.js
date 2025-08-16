"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBlockUserRedisKey = exports.connectRedis = void 0;
const redis_1 = require("redis");
const logger_util_1 = __importDefault(require("./logger.util"));
const redisClient = (0, redis_1.createClient)({
    url: process.env.REDIS_URL,
});
redisClient.on("error", (err) => {
    logger_util_1.default.error("Redis Client Error", { error: err.message });
});
redisClient.on("connect", () => {
    logger_util_1.default.info("redis connected");
});
const connectRedis = async () => {
    if (!redisClient.isOpen) {
        await redisClient.connect();
    }
};
exports.connectRedis = connectRedis;
const generateBlockUserRedisKey = (sensitive) => {
    return `blacklist:user:${sensitive}`;
};
exports.generateBlockUserRedisKey = generateBlockUserRedisKey;
exports.default = redisClient;
