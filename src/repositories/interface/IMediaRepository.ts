import { Media, Prisma } from "@prisma/client";
import { DeleteUnusedMediasResponse, UploadMediaRequest } from "../../grpc/generated/post";

export interface IMediaRepository {
    createMedia(data:UploadMediaRequest): Promise<string> ;
    deleteUnusedMediaRepo(mediaIds:string[]):Promise<number>
    findUnusedMedia():Promise<Partial<Media>[]>;
    deleteFilesFromUploadThing(urls:string[]):Promise<void>
}