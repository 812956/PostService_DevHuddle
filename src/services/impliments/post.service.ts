
import { PostMapper } from "../../mapper/post.mapper";
import { CreatePostSchema } from "../../dto/create.post.dto";
import {
  CreatePostRequest,
  CreatePostResponse,
} from "../../grpc/generated/post";
import { IPostRepository } from "../../repositories/interface/IPostRepository";
import { IpostService } from "../interfaces/IpostService";

export class PostSerive implements IpostService {
  constructor(private postRepository: IPostRepository) {}

  async createPost(req: CreatePostRequest): Promise<void> {

    const dto = CreatePostSchema.parse(req)

    const prismaInput = PostMapper.toPost(dto,"123")

    this.postRepository.createPostLogics(prismaInput)
    
  }

}
