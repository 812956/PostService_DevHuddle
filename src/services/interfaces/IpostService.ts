import {
  CreatePostRequest,
  CreatePostResponse,
  DeletePostRequest,
  DeletePostResponse,
  ListPostsResponse,
  SubmitPostRequest,
  SubmitPostResponse,
  UploadMediaRequest,
  UploadMediaResponse,
} from "../../grpc/generated/post";

export interface IpostService {
  // createPost(req: CreatePostRequest): Promise<{ postId: string }>;
  getPosts(pageParam?: string): Promise<ListPostsResponse>;
  submitPost(req: SubmitPostRequest): Promise<SubmitPostResponse>;
  deletePostServ(postId: string): Promise<DeletePostResponse>;
}
