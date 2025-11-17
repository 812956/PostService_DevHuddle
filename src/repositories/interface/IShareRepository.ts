import { Share, Prisma } from ".prisma/client";

export interface IShareRepository {
  createShare(data: {
    postId: string;
    userId: string;
    shareType: string;
    caption?: string;
    targetType?: string;
    targetId?: string;
  }): Promise<Share>;
  findShare(postId: string, userId: string): Promise<Share | null>;
  getSharesByPost(postId: string, limit?: number): Promise<Share[]>;
  getShareCount(postId: string): Promise<number>;
}