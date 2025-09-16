import { CreatePostRequest, CreatePostResponse, DeletePostRequest, DeletePostResponse, ListPostsRequest, ListPostsResponse, SubmitPostRequest, SubmitPostResponse } from "../../grpc/generated/post";

export interface IfeedController {
    feedPosting(req:CreatePostRequest):Promise<CreatePostResponse>;
    getPostsController(req:any):Promise<any>;
    submitPostController(req:SubmitPostRequest):Promise<SubmitPostResponse>
    deletePostController(req:DeletePostRequest):Promise<DeletePostResponse>
} 