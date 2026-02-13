import { ShareType, TargetType, Visibility } from "@prisma/client";

export interface IShareService {
    sharePost(
      postId: string,
      userId: string,
      shareType: ShareType,
      targetType?: TargetType,
      caption?: string,
      visibility?: Visibility,
      sharedToUserId?: string
    ): Promise<any>;
    getShareCount(postId: string): Promise<number>;
    hasShared(postId: string, userId: string): Promise<boolean>;
  }