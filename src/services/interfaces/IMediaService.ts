import { UploadMediaRequest, UploadMediaResponse } from "../../grpc/generated/post";

export interface IMediaService {
  uploadMediaService(req: UploadMediaRequest): Promise<UploadMediaResponse>;
}
