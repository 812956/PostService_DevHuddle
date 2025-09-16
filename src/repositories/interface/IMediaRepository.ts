import { Prisma } from "@prisma/client";
import { UploadMediaRequest } from "../../grpc/generated/post";

export interface IMediaRepository {
    createMedia(data:UploadMediaRequest): Promise<string> 
}