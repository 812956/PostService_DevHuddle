"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendErrorResponse = exports.CustomError = void 0;
const logger_util_1 = __importDefault(require("./logger.util"));
class CustomError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
exports.CustomError = CustomError;
const sendErrorResponse = (res, error) => {
    logger_util_1.default.error(error.message, { status: error.status });
    res
        .status(error.status)
        .json({
        status: error.status,
        message: error.message,
        success: error.success,
    });
};
exports.sendErrorResponse = sendErrorResponse;
