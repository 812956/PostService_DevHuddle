"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostRepository = void 0;
const base_repository_1 = require("./base.repository");
const prisma_config_1 = require("../../config/prisma.config");
const logger_util_1 = __importDefault(require("../../utils/logger.util"));
class PostRepository extends base_repository_1.BaseRepository {
    constructor() {
        super(prisma_config_1.prisma.post);
    }
    async createPostLogics(data) {
        try {
            await super.create(data);
        }
        catch (error) {
            logger_util_1.default.error("Error creating entity", {
                error: error.message,
            });
            throw new Error("Database error");
        }
    }
}
exports.PostRepository = PostRepository;
