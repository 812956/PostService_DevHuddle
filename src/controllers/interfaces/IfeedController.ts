import { CreatePostRequest, CreatePostResponse } from "../../grpc/generated/post";

export interface IfeedController {
    feedPosting(req:CreatePostRequest):Promise<CreatePostResponse>
} 