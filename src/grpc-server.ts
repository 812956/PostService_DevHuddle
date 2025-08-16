import * as grpc from "@grpc/grpc-js";
import logger from "./utils/logger.util";
import {
  CreatePostRequest,
  CreatePostResponse,
  PostServiceServer,
  PostServiceService,
} from "./grpc/generated/post";
import { PostController } from "./controllers/impliments/feed.controller";
import { CustomError } from "./utils/error.util";
import { PostSerive } from "./services/impliments/post.service";
import { PostRepository } from "./repositories/impliments/post.repository";

const postRepository = new PostRepository();
const postService = new PostSerive(postRepository);
const postController = new PostController(postService);

const postServiceActions: PostServiceServer = {
  createPost: async (
    call: grpc.ServerUnaryCall<CreatePostRequest, CreatePostResponse>,
    callback: grpc.sendUnaryData<CreatePostResponse>
  ) => {
    try {
      const response = await postController.feedPosting(call.request);
      callback(null,response)
    } catch (err: any) {
      callback(
        {
          code: err instanceof CustomError ? err.status : grpc.status.INTERNAL,
          message: err.message || "Internal server error",
        },
        null
      );
    }
  },
};

export const grpcServer = new grpc.Server();
grpcServer.addService(PostServiceService, postServiceActions);

const GRPC_PORT = process.env.GRPC_PORT || "50051";
grpcServer.bindAsync(
  `0.0.0.0:${GRPC_PORT}`,
  grpc.ServerCredentials.createInsecure(),
  () => {
    logger.info(`✅ gRPC server running on port ${GRPC_PORT}`);
  }
);
