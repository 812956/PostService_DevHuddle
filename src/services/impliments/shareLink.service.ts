import { IShareLinkService } from "../interfaces/IShareLinkService";
import { IShareLinkRepository } from "../../repositories/interface/IShareLinkRepository";
import { IPostRepository } from "../../repositories/interface/IPostRepository";
import { CustomError } from "../../utils/error.util";
import * as grpc from "@grpc/grpc-js";
import logger from "../../utils/logger.util";
import crypto from "crypto";

// Helper function to generate short IDs (CommonJS compatible)
function generateShortId(length: number = 8): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

// Helper function to generate secure tokens
function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString("base64url");
}

export class ShareLinkService implements IShareLinkService {
  constructor(
    private _shareLinkRepository: IShareLinkRepository,
    private _postRepository: IPostRepository
  ) {}

  async generateShareLink(
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
  }> {
    try {
      // 1. Check post exists
      const post = await this._postRepository.findPost(postId);
      if (!post) {
        throw new CustomError(grpc.status.NOT_FOUND, "Post not found");
      }

      // 2. Check privacy - can user share this?
      if (post.visibility === "VISIBILITY_CONNECTIONS" && post.userId !== userId) {
        // In a real system, check if users are connected
        // For now, allow if not the owner
      }

      // 3. Generate canonical URL
      const baseUrl = process.env.APP_URL || "http://localhost:3000";
      const canonicalUrl = `${baseUrl}/posts/${postId}`;

      let shortUrl: string | undefined;
      let shareToken: string | undefined;
      let expiresAt: Date | undefined;

      // 4. Generate short link if requested
      if (options.generateShort) {
        const shortId = await this.generateShortId();
        await this._shareLinkRepository.createShareLink({
          postId,
          shortId,
          createdById: userId,
        });
        shortUrl = `${baseUrl}/p/${shortId}`;
      }

      // 5. Generate share token for private posts
      if (post.visibility === "VISIBILITY_CONNECTIONS" && options.isPrivate) {
        shareToken = generateSecureToken(32);
        expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await this._shareLinkRepository.createShareLink({
          postId,
          shortId: await this.generateShortId(), // Generate shortId even if not requested for token
          shareToken,
          tokenExpiresAt: expiresAt,
          createdById: userId,
        });
      }

      return {
        canonicalUrl,
        shortUrl,
        shareToken,
        expiresAt,
      };
    } catch (error: any) {
      logger.error("Error generating share link", {
        error: error.message,
        postId,
        userId,
      });
      throw error;
    }
  }

  async resolveShareLink(
    tokenOrShortId: string
  ): Promise<{
    postId: string;
    redirectUrl: string;
  }> {
    try {
      // Try to find by token first, then by shortId
      let link =
        (await this._shareLinkRepository.findByShareToken(tokenOrShortId)) ||
        (await this._shareLinkRepository.findByShortId(tokenOrShortId));

      if (!link) {
        throw new CustomError(grpc.status.NOT_FOUND, "Invalid link");
      }

      // Check token expiration
      if (link.tokenExpiresAt && link.tokenExpiresAt < new Date()) {
        throw new CustomError(grpc.status.NOT_FOUND, "Link expired");
      }

      // Increment click count (async, don't wait)
      this._shareLinkRepository.incrementClickCount(link.id).catch((err) => {
        logger.error("Error incrementing click count", { error: err.message });
      });

      return {
        postId: link.postId,
        redirectUrl: `/posts/${link.postId}`,
      };
    } catch (error: any) {
      logger.error("Error resolving share link", {
        error: error.message,
        tokenOrShortId,
      });
      throw error;
    }
  }

  private async generateShortId(): Promise<string> {
    // Generate 8-character alphanumeric ID
    // Check for collisions
    let attempts = 0;
    while (attempts < 10) {
      const shortId = generateShortId(8);
      const exists = await this._shareLinkRepository.findByShortId(shortId);
      if (!exists) return shortId;
      attempts++;
    }
    throw new CustomError(
      grpc.status.INTERNAL,
      "Failed to generate unique short ID"
    );
  }
}

