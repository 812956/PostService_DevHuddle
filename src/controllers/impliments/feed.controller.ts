import { success, ZodTypeAny } from "zod";
import { PostDTO, PostSchema } from "../../dto/feed.dto";
import {
  CreatePostRequest,
  CreatePostResponse,
  Post,
} from "../../grpc/generated/post";
import { IfeedController } from "../interfaces/IfeedController";
import { partial } from "zod/v4/core/util.cjs";
import { IpostService } from "../../services/interfaces/IpostService";
import * as grpc from "@grpc/grpc-js";
import { CustomError } from "../../utils/error.util";
import { Messages } from "../../constands/reqresMessages";

export class PostController implements IfeedController {
  
  constructor(private postService:IpostService){}
    
  async feedPosting(req: CreatePostRequest): Promise<CreatePostResponse> {
 
        console.log('this is the req data,', req.post)
        await this.postService.createPost(req)

        return {
            message:"hello "
        }

  }
}
