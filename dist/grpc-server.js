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
exports.grpcServer = void 0;
const grpc = __importStar(require("@grpc/grpc-js"));
const logger_util_1 = __importDefault(require("./utils/logger.util"));
const post_1 = require("./grpc/generated/post");
const feed_controller_1 = require("./controllers/impliments/feed.controller");
const error_util_1 = require("./utils/error.util");
const post_service_1 = require("./services/impliments/post.service");
const post_repository_1 = require("./repositories/impliments/post.repository");
const postRepository = new post_repository_1.PostRepository();
const postService = new post_service_1.PostSerive(postRepository);
const postController = new feed_controller_1.PostController(postService);
const postServiceActions = {
    createPost: async (call, callback) => {
        try {
            console.log('request is comming without any problem .......', call.request);
            const response = await postController.feedPosting(call.request);
            callback(null, response);
        }
        catch (err) {
            callback({
                code: err instanceof error_util_1.CustomError ? err.status : grpc.status.INTERNAL,
                message: err.message || "Internal server error",
            }, null);
        }
    },
};
exports.grpcServer = new grpc.Server();
exports.grpcServer.addService(post_1.PostServiceService, postServiceActions);
const GRPC_PORT = process.env.GRPC_PORT || "50051";
exports.grpcServer.bindAsync(`0.0.0.0:${GRPC_PORT}`, grpc.ServerCredentials.createInsecure(), () => {
    logger_util_1.default.info(`✅ gRPC server running on port ${GRPC_PORT}`);
});
