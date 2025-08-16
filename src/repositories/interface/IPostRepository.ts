import { Prisma, Post } from "../../../generated/prisma-client";

export interface IPostRepository {
    createPostLogics(data:Prisma.PostCreateInput):Promise<void>
}