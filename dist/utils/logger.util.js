"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pino_1 = __importDefault(require("pino"));
// Create base Pino logger
const pinoLogger = (0, pino_1.default)({
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV !== 'production' ? {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
        },
    } : undefined,
});
// Wrapper to maintain Winston-like API compatibility
const logger = {
    info: (message, meta) => {
        if (meta) {
            pinoLogger.info(meta, message);
        }
        else {
            pinoLogger.info(message);
        }
    },
    error: (message, meta) => {
        if (meta) {
            pinoLogger.error(meta, message);
        }
        else {
            pinoLogger.error(message);
        }
    },
    warn: (message, meta) => {
        if (meta) {
            pinoLogger.warn(meta, message);
        }
        else {
            pinoLogger.warn(message);
        }
    },
    debug: (message, meta) => {
        if (meta) {
            pinoLogger.debug(meta, message);
        }
        else {
            pinoLogger.debug(message);
        }
    },
};
exports.default = logger;
