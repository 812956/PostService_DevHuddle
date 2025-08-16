import { CreatePostRequest, CreatePostResponse } from "../../grpc/generated/post";
import { IPostRepository } from "../../repositories/interface/IPostRepository";
import { IpostService } from "../interfaces/IpostService";

export class PostSerive implements IpostService {

    constructor(private postRepository: IPostRepository){}

    async createPost(req: CreatePostRequest): Promise<void> {
        
    }
}