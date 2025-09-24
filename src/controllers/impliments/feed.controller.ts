import { success, ZodTypeAny } from "zod";
import {
  CreatePostRequest,
  CreatePostResponse,
  DeletePostRequest,
  DeletePostResponse,
  ListPostsRequest,
  ListPostsResponse,
  SubmitPostRequest,
  SubmitPostResponse,
  UploadMediaRequest,
  UploadMediaResponse,
} from "../../grpc/generated/post";
import { IfeedController } from "../interfaces/IfeedController";
import { partial } from "zod/v4/core/util.cjs";
import { IpostService } from "../../services/interfaces/IpostService";
import * as grpc from "@grpc/grpc-js";
import { CustomError } from "../../utils/error.util";
import { Messages } from "../../constands/reqresMessages";
import logger from "../../utils/logger.util";

export class PostController implements IfeedController {
  constructor(private postService: IpostService) {}

  async feedPosting(req: CreatePostRequest): Promise<CreatePostResponse> {
    try {
      const post = await this.postService.createPost(req);
      return {
        message: "Post created",
        postId: post.postId,
      };
    } catch (err: any) {
      logger.error("CreatePost error", { error: err.message });
      throw new CustomError(grpc.status.INTERNAL, err.message);
    }
  }

  async submitPostController(
    req: SubmitPostRequest
  ): Promise<SubmitPostResponse> {
    try {
      const post = await this.postService.submitPost(req);
      return post;
    } catch (err: any) {
      logger.error("CreatePost error", { error: err.message });
      throw new CustomError(grpc.status.INTERNAL, err.message);
    }
  }

  async getPostsController(req: ListPostsRequest): Promise<ListPostsResponse> {
    try {
      const { pageParam } = req;
      const result: ListPostsResponse = await this.postService.getPosts(
        pageParam as string | undefined
      );

      return result;
    } catch (err: any) {
      logger.error("List posts error", { error: err.message });
      throw new CustomError(grpc.status.INTERNAL, err.message);
    }
  }

  async deletePostController(
    req: DeletePostRequest
  ): Promise<DeletePostResponse> {
    try {
      const { postId } = req;
      const deletePost: DeletePostResponse =
        await this.postService.deletePostServ(postId as string);

      return deletePost;
    } catch (err: any) {
      logger.error("delete Post error", { error: err.message });
      throw new CustomError(grpc.status.INTERNAL, err.message);
    }
  }

}
