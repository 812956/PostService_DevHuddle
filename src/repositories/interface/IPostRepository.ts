import { Posts, Prisma } from ".prisma/client";
import {
  SubmitPostRequest,
  SubmitPostResponse,
} from "../../grpc/generated/post";

export interface PostSelectOptions {
  include: any;
  take: number;
  orderBy: {
    id: "asc" | "desc";
  };
  cursor?: {
    id: string;
  };
  skip: number;
}

export interface IPostRepository {
  createPostLogics(
    data: Partial<Prisma.PostsCreateInput>
  ): Promise<{ postId: string }>;
  getPostsRepo(postSelectOptions: PostSelectOptions): Promise<Posts[]>;
  submitPostRepo(data: SubmitPostRequest): Promise<SubmitPostResponse>;
  findPost(postId: string): Promise<Posts | null>;
  deletePost(postId: string): Promise<any>;
  // Counter update methods
  incrementLikesCount(postId: string): Promise<void>;
  decrementLikesCount(postId: string): Promise<void>;
  incrementCommentsCount(postId: string): Promise<void>;
  decrementCommentsCount(postId: string): Promise<void>;
  incrementSharesCount(postId: string): Promise<void>;
  incrementReportsCount(postId: string): Promise<void>;
}
