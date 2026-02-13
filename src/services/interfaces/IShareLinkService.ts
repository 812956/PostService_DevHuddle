export interface IShareLinkService {
  generateShareLink(
    postId: string,
    userId: string,
    options: {
      generateShort?: boolean;
      isPrivate?: boolean;
    }
  ): Promise<{
    canonicalUrl: string;
    shortUrl?: string;
    shareToken?: string;
    expiresAt?: Date;
  }>;

  resolveShareLink(
    tokenOrShortId: string
  ): Promise<{
    postId: string;
    redirectUrl: string;
  }>;
}

