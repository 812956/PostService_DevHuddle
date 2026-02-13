import { FeedEntry, FeedQueryOptions } from "../../repositories/interface/IFeedRepository";
import { PostMetadata } from "../impliments/feed-ranking.service";

export interface Follower {
  id: string;
  username?: string;
  name?: string;
}

export interface FanOutOptions {
  postId: string;
  authorId: string;
  followers: Follower[];
  metadata: PostMetadata;
}

export interface FeedResponse {
  posts: any[];
  nextCursor: string | null;
}

export interface IFeedService {
  /**
   * Fan-out post to followers' feeds (with relevance scores)
   */
  fanOutToFollowers(options: FanOutOptions): Promise<void>;

  /**
   * Get personalized feed for a user
   */
  getFeed(
    userId: string,
    cursor?: string,
    limit?: number
  ): Promise<FeedResponse>;

  /**
   * Recalculate relevance scores for a post (when engagement changes)
   */
  recalculatePostScores(postId: string): Promise<void>;

  /**
   * Remove post from all feeds (when post is deleted)
   */
  removeFromAllFeeds(postId: string): Promise<void>;
}

