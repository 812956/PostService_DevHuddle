import { DeleteUnusedMediasRequest, DeleteUnusedMediasResponse, UploadMediaRequest, UploadMediaResponse } from "../../grpc/generated/post";


export interface CleanupResult {
  deletedFiles: number;
  deletedRecords: number;
}
export interface IMediaService {
  uploadMediaService(req: UploadMediaRequest): Promise<UploadMediaResponse>;
  deleteUnusedMediaService() : Promise<CleanupResult>;
}
