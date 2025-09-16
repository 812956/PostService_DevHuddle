"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostRepository = void 0;
const base_repository_1 = require("./base.repository");
const prisma_config_1 = require("../../config/prisma.config");
const logger_util_1 = __importDefault(require("../../utils/logger.util"));
const grpc_client_1 = require("../../config/grpc.client");
class PostRepository extends base_repository_1.BaseRepository {
    constructor() {
        super(prisma_config_1.prisma.post);
    }
    async createPostLogics(data) {
        try {
            const { id: postId } = await super.create(data);
            return { postId };
        }
        catch (error) {
            logger_util_1.default.error("Error creating entity", {
                error: error.message,
            });
            throw new Error("Database error");
        }
    }
    async getPostsRepo(pageParam, pageSize) {
        try {
            console.log("request comming inside the repositori");
            const posts = await prisma_config_1.prisma.post.findMany({
                take: pageSize,
                skip: pageParam ? 1 : 0,
                cursor: pageParam ? { id: pageParam } : undefined,
                orderBy: {
                    createdAt: "desc",
                },
            });
            console.log('this is the fetched data .......', posts);
            const enrichedPosts = await Promise.all(posts.map((post) => new Promise((resolve, reject) => {
                grpc_client_1.userClient.getUserForFeedListing({ userId: post.userId }, (err, response) => {
                    // if (err) {
                    //   console.error("gRPC error fetching user:", err);
                    //   return resolve({ ...post, user: undefined });
                    // }
                    resolve({
                        ...post,
                        user: {
                            avatar: response.avatar,
                            name: response.name,
                            username: response.username,
                        },
                    });
                });
            })));
            return enrichedPosts;
        }
        catch (err) {
            logger_util_1.default.error("Error fetching the posts ", {
                error: err.message,
            });
            throw new Error("Database error");
        }
    }
}
exports.PostRepository = PostRepository;
