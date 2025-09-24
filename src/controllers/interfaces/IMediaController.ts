import { DeleteUnusedMediasRequest, DeleteUnusedMediasResponse, UploadMediaRequest, UploadMediaResponse } from "../../grpc/generated/post";

export interface IMediaController {
    uploadMediaController(req:UploadMediaRequest):Promise<UploadMediaResponse>;
    deleteUnusedMedia():Promise<DeleteUnusedMediasResponse>;
}