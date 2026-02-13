import { Media, Prisma } from "@prisma/client";
import { DeleteUnusedMediasResponse, UploadMediaRequest } from "../../grpc/generated/post";

export interface IMediaRepository {
    createMedia(data:UploadMediaRequest): Promise<string> ;
    deleteUnusedMediaRepo(mediaIds:string[]):Promise<number>
    findUnusedMedia():Promise<Partial<Media>[]>;
    /**
     * @deprecated This method is deprecated. Media deletion is now handled by Media Service.
     * Use Media Service API: DELETE /api/v1/media/{mediaId}
     */
    deleteFilesFromUploadThing(urls:string[]):Promise<void>
}