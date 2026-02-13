import { PostShareLink } from "@prisma/client";

export interface IShareLinkRepository {
  createShareLink(data: {
    postId: string;
    shortId: string;
    shareToken?: string;
    tokenExpiresAt?: Date;
    createdById: string;
  }): Promise<PostShareLink>;

  findByShortId(shortId: string): Promise<PostShareLink | null>;
  findByShareToken(token: string): Promise<PostShareLink | null>;
  findByPostId(postId: string): Promise<PostShareLink | null>;
  incrementClickCount(id: string): Promise<void>;
  deleteExpiredTokens(): Promise<number>;
}

