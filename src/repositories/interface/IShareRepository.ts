import { Share, Prisma } from ".prisma/client";

export interface IShareRepository {
  createShare(data: {
    postId: string;
    userId: string;
    shareType: string;
    caption?: string;
    visibility?: string;
    targetType?: string;
    targetId?: string;
    sharedToUserId?: string;
  }): Promise<Share>;
  findShare(postId: string, userId: string): Promise<Share | null>;
  getSharesByPost(postId: string, limit?: number): Promise<Share[]>;
  getShareCount(postId: string): Promise<number>;
  hasShared(postId: string, userId: string): Promise<boolean>;
  getUserSharesForPosts(userId: string, postIds: string[]): Promise<Record<string, boolean>>;
}