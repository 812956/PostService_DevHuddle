import { PostVersion } from "@prisma/client";

export interface IPostVersionRepository {
  createVersion(data: {
    postId: string;
    versionNumber: number;
    content: string;
    attachmentIds: string[];
    editedById: string;
  }): Promise<PostVersion>;

  getByPostId(postId: string): Promise<PostVersion[]>;
  getByPostAndVersion(postId: string, versionNumber: number): Promise<PostVersion | null>;
  getLatestVersion(postId: string): Promise<PostVersion | null>;
}

