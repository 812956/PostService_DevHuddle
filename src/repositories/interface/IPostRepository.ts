import { Post, Posts, Prisma } from ".prisma/client";
import { SubmitPostRequest, SubmitPostResponse } from "../../grpc/generated/post";


export interface PostSelectOptions {
  take: number;
  orderBy: {
    id: "asc" | "desc";
  };
  cursor?: {
    id: string;
  };
  skip: number, 
}


export interface IPostRepository {
    createPostLogics(data:Partial<Prisma.PostCreateInput>):Promise<{postId:string}>;
    getPostsRepo(postSelectOptions:PostSelectOptions):Promise<Posts[]>;
    submitPostRepo(data:SubmitPostRequest):Promise<SubmitPostResponse>;
    findPost(postId:string):Promise<Posts | null>;
    deletePost(postId:string):Promise<any>
}