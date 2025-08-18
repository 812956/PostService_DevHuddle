import { Prisma } from ".prisma/client";

export interface IPostRepository {
    createPostLogics(data:Prisma.PostCreateInput):Promise<void>
}