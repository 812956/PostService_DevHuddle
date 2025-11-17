import * as grpc from "@grpc/grpc-js";
import logger from "./utils/logger.util";
import {
  CreatePostRequest,
  CreatePostResponse,
  DeletePostRequest,
  DeletePostResponse,
  DeleteUnusedMediasRequest,
  DeleteUnusedMediasResponse,
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
import { grpcHandler } from "./utils/grpc.helper";

const postRepository = new PostRepository();
const postService = new PostSerive(postRepository);
const postController = new PostController(postService);

const mediaRepository = new MediaRepository();
const mediaService = new MediaService(mediaRepository);
const mediaController = new MediaController(mediaService);



const postServiceActions: PostServiceServer = {
  // createPost: grpcHandler(postController.feedPosting.bind(postController)),
  listPosts: grpcHandler(postController.getPostsController.bind(postController)),
  uploadMedia: grpcHandler(
    mediaController.uploadMediaController.bind(mediaController)
  ),
  submitPost: grpcHandler(
    postController.submitPostController.bind(postController)
  ),
  deletePost: grpcHandler(
    postController.deletePostController.bind(postController)
  ),
  deleteUnusedMedias: grpcHandler(
    mediaController.deleteUnusedMedia.bind(mediaController)
  ),
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
