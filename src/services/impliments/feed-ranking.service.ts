import logger from "../../utils/logger.util";
import { userClient } from "../../config/grpc.client";
import { grpcs } from "../../utils/grpc.client.call.util";
import {
  CheckFollowRequest,
  CheckFollowResponse,
  UserServiceClient,
} from "../../grpc/generated/user";
import { posts } from ".prisma/client";
import { IPostRepository } from "../../repositories/interface/IPostRepository";

export interface PostMetadata {
  authorId: string;
  postId: string;
  content: string;
  tags: string[];
  visibility: string;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  createdAt: Date;
}

export class FeedRankingService {
  constructor(private _postRepository: IPostRepository) {}

  /**
   * Calculate relevance score for a post in a user's feed
   * Formula: (socialGraph * 0.40) + (engagement * 0.35) + (content * 0.20) + (temporal * 0.05)
   */
  async calculateScore(
    postId: string,
    userId: string,
    metadata: PostMetadata
  ): Promise<number> {
    try {
      // 1. Social Graph Score (40% weight)
      const socialScore = await this.calculateSocialGraphScore(
        metadata.authorId,
        userId
      );

      // 2. Engagement Score (35% weight)
      const engagementScore = this.calculateEngagementScore(metadata);

      // 3. Content Relevance Score (20% weight)
      const contentScore = await this.calculateContentRelevanceScore(
        userId,
        metadata
      );

      // 4. Temporal Score (5% weight)
      const temporalScore = this.calculateTemporalScore(metadata.createdAt);

      // Weighted combination
      const finalScore =
        socialScore * 0.4 +
        engagementScore * 0.35 +
        contentScore * 0.2 +
        temporalScore * 0.05;

      // Clamp between 0 and 1
      return Math.min(1.0, Math.max(0.0, finalScore));
    } catch (error: any) {
      logger.error("Error calculating relevance score", {
        error: error.message,
        postId,
        userId,
      });
      // Return default score if calculation fails
      return 0.5;
    }
  }

  /**
   * Calculate social graph score (40% weight)
   * - Direct followers: 1.0
   * - Mutual connections: 0.8
   * - Second-degree: 0.6
   * - No connection: 0.1 (for public posts)
   */
  private async calculateSocialGraphScore(
    authorId: string,
    userId: string
  ): Promise<number> {
    try {
      // Check if user follows author (direct follower)
      const isFollowing = await this.checkFollow(userId, authorId);
      if (isFollowing) {
        return 1.0; // Highest priority: posts from followed users
      }

      // Check if author follows user (mutual connection indicator)
      const authorFollowsUser = await this.checkFollow(authorId, userId);
      if (authorFollowsUser) {
        return 0.8; // High priority: mutual connections
      }

      // TODO: Add second-degree connection check when available
      // For now, treat as public post from unknown user
      return 0.1;
    } catch (error: any) {
      logger.error("Error calculating social graph score", {
        error: error.message,
        authorId,
        userId,
      });
      return 0.1; // Default to low score if check fails
    }
  }

  /**
   * Calculate engagement score (35% weight)
   * Normalizes engagement metrics (likes, comments, shares)
   */
  private calculateEngagementScore(metadata: PostMetadata): number {
    // Normalize engagement metrics
    // Weights: likes (1.0), comments (2.0), shares (3.0)
    const weightedEngagement =
      metadata.likesCount * 1.0 +
      metadata.commentsCount * 2.0 +
      metadata.sharesCount * 3.0;

    // Normalize to 0-1 range using logarithmic scale (to handle large numbers)
    // Using log base 10, scaled to max engagement of 1000
    const normalizedScore = Math.min(
      1.0,
      Math.log10(weightedEngagement + 1) / Math.log10(1001)
    );

    return normalizedScore;
  }

  /**
   * Calculate content relevance score (20% weight)
   * - Matching hashtags/interests
   * - Content type preferences (future enhancement)
   */
  private async calculateContentRelevanceScore(
    userId: string,
    metadata: PostMetadata
  ): Promise<number> {
    try {
      let score = 0.0;

      // TODO: Match hashtags with user interests
      // For now, return base score
      // Future: Check user's followed hashtags, interests, etc.

      // Base score for all content
      score = 0.5;

      // Boost for posts with hashtags (engagement signal)
      if (metadata.tags && metadata.tags.length > 0) {
        score += 0.2;
      }

      return Math.min(1.0, score);
    } catch (error: any) {
      logger.error("Error calculating content relevance score", {
        error: error.message,
        userId,
      });
      return 0.5; // Default middle score
    }
  }

  /**
   * Calculate temporal score (5% weight)
   * Newer posts get higher scores, decay over time (7 days)
   */
  private calculateTemporalScore(createdAt: Date): number {
    const now = new Date();
    const hoursSinceCreation =
      (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

    // Decay over 7 days (168 hours)
    // Score starts at 1.0 and decays to 0.0 over 7 days
    const score = Math.max(0, 1 - hoursSinceCreation / 168);

    return score;
  }

  /**
   * Check if followerId follows followingId
   */
  private async checkFollow(
    followerId: string,
    followingId: string
  ): Promise<boolean> {
    try {
      const request: CheckFollowRequest = {
        followerId,
        followingId,
      };

      const response = await grpcs<
        UserServiceClient,
        CheckFollowRequest,
        CheckFollowResponse
      >(userClient, "checkFollow", request);

      return response.isFollowing;
    } catch (error: any) {
      logger.error("Error checking follow relationship", {
        error: error.message,
        followerId,
        followingId,
      });
      return false;
    }
  }

  /**
   * Calculate initial score for a newly created post
   * Uses basic heuristics without engagement data
   */
  async calculateInitialScore(
    authorId: string,
    userId: string,
    metadata: Partial<PostMetadata>
  ): Promise<number> {
    // For new posts, engagement is 0, so we weight other factors more
    const socialScore = await this.calculateSocialGraphScore(authorId, userId);
    const contentScore = await this.calculateContentRelevanceScore(
      userId,
      metadata as PostMetadata
    );
    const temporalScore = 1.0; // New posts get full temporal score

    // Adjusted weights for new posts (no engagement yet)
    const score =
      socialScore * 0.5 + // Increased weight for social graph
      contentScore * 0.3 + // Increased weight for content
      temporalScore * 0.2; // Temporal factor

    return Math.min(1.0, Math.max(0.0, score));
  }
}

