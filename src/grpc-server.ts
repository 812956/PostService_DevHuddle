import * as grpc from "@grpc/grpc-js";
import logger from "./utils/logger.util";
import {
  CreatePostRequest,
  CreatePostResponse,
  DeletePostRequest,
  DeletePostResponse,
  ListPostsRequest,
  ListPostsResponse,
  PostServiceServer,
  PostServiceService,
  SubmitPostRequest,
  SubmitPostResponse,
  UploadMediaRequest,
  UploadMediaResponse,
} from "./grpc/generated/post";
import { PostController } from "./controllers/impliments/feed.controller";
import { CustomError } from "./utils/error.util";
import { PostSerive } from "./services/impliments/post.service";
import { PostRepository } from "./repositories/impliments/post.repository";
import { MediaRepository } from "./repositories/impliments/media.repository";
import { MediaService } from "./services/impliments/media.service";
import { MediaController } from "./controllers/impliments/media.controller";
import { response } from "express";

const postRepository = new PostRepository();
const postService = new PostSerive(postRepository);
const postController = new PostController(postService);

const mediaRepository = new MediaRepository();
const mediaService = new MediaService(mediaRepository);
const mediaController = new MediaController(mediaService);

const postServiceActions: PostServiceServer = {
  createPost: async (
    call: grpc.ServerUnaryCall<CreatePostRequest, CreatePostResponse>,
    callback: grpc.sendUnaryData<CreatePostResponse>
  ) => {
    try {
      console.log(
        "request is comming without any problem .......",
        call.request
      );
      const response = await postController.feedPosting(call.request);
      callback(null, response);
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
  listPosts: async (
    call: grpc.ServerUnaryCall<ListPostsRequest, ListPostsResponse>,
    callback: grpc.sendUnaryData<ListPostsResponse>
  ) => {
    try {
      const response = await postController.getPostsController(call.request);

      callback(null, response);
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
  uploadMedia: async (
    call: grpc.ServerUnaryCall<UploadMediaRequest, UploadMediaResponse>,
    callback: grpc.sendUnaryData<UploadMediaResponse>
  ) => {
    try {
      const response = await mediaController.uploadMediaService(call.request);

      callback(null, response);
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
  submitPost: async (
    call: grpc.ServerUnaryCall<SubmitPostRequest, SubmitPostResponse>,
    callback: grpc.sendUnaryData<SubmitPostResponse>
  ) => {
    try {
      const response = await postController.submitPostController(call.request);

      callback(null, response);
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
  deletePost: async (
    call: grpc.ServerUnaryCall<DeletePostRequest, DeletePostResponse>,
    callback: grpc.sendUnaryData<DeletePostResponse>
  ) => {
    try {
      console.log("this is the reques");
      const response = await postController.deletePostController(call.request);

      callback(null, response);
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
