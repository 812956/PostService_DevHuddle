import { CreatePostRequest, CreatePostResponse } from "../../grpc/generated/post";

export interface IpostService {
    createPost(req: CreatePostRequest): Promise<void>;
    // getPostsByUserId(userId: string): Promise<GetPostsResponse>;
    // getPostById(postId: string): Promise<GetPostResponse>;
    // updatePost(req: UpdatePostRequest): Promise<UpdatePostResponse>;
    // deletePost(postId: string): Promise<DeletePostResponse>;
    // likePost(req: LikePostRequest): Promise<LikePostResponse>;
    // commentOnPost(req: CommentOnPostRequest): Promise<CommentOnPostResponse>;
}