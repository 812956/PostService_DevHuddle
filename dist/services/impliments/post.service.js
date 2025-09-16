"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostSerive = void 0;
const error_util_1 = require("../../utils/error.util");
const post_mapper_1 = require("../../mapper/post.mapper");
const logger_util_1 = __importDefault(require("../../utils/logger.util"));
const grpc = __importStar(require("@grpc/grpc-js"));
const PAGE_SIZE = 10; // Default page size
class PostSerive {
    constructor(postRepository) {
        this.postRepository = postRepository;
    }
    async createPost(payload) {
        try {
            const newPost = post_mapper_1.PostMapper.toPost(payload);
            console.log("this is the post detiales .................... ", newPost);
            const { postId } = await this.postRepository.createPostLogics(newPost);
            return { postId };
        }
        catch (err) {
            logger_util_1.default.error("CreatePost error", { error: err.message });
            throw new error_util_1.CustomError(grpc.status.INTERNAL, err.message);
        }
    }
    async getPosts(pageParam) {
        try {
            const prismaPosts = await this.postRepository.getPostsRepo(pageParam, PAGE_SIZE);
            const fromPostToListPostRes = post_mapper_1.PostMapper.fromPosts(prismaPosts);
            const nextCursor = prismaPosts.length === PAGE_SIZE ? prismaPosts[prismaPosts.length - 1].id : null;
            return {
                pages: fromPostToListPostRes,
                nextCursor,
            };
        }
        catch (err) {
            logger_util_1.default.error("GetPosts error", { error: err.message });
            throw new error_util_1.CustomError(grpc.status.INTERNAL, err.message);
        }
    }
}
exports.PostSerive = PostSerive;
