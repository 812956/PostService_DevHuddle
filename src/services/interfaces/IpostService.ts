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
  EditPostRequest,
  EditPostResponse,
  GetPostVersionsRequest,
  GetPostVersionsResponse,
  RestorePostVersionRequest,
  RestorePostVersionResponse,
} from "../../grpc/generated/post";

export interface IpostService {
  // createPost(req: CreatePostRequest): Promise<{ postId: string }>;
  getPosts(
    pageParam?: string,
    userId?: string,
    authorId?: string,
    sortBy?: string, // 'RECENT' | 'TOP'
    limit?: number // Add limit parameter
  ): Promise<ListPostsResponse>;
  getPostById(postId: string, userId?: string): Promise<any>;
  submitPost(req: SubmitPostRequest): Promise<SubmitPostResponse>;
  deletePostServ(postId: string): Promise<DeletePostResponse>;
  editPost(req: EditPostRequest): Promise<EditPostResponse>;
  getPostVersions(req: GetPostVersionsRequest): Promise<GetPostVersionsResponse>;
  restorePostVersion(req: RestorePostVersionRequest): Promise<RestorePostVersionResponse>;
}
