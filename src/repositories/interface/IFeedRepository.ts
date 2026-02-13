export interface FeedEntry {
  userId: string;
  postId: string;
  relevanceScore: number;
  isRead: boolean;
  readAt?: Date;
  rankPosition?: number;
  createdAt: Date;
  scoreUpdatedAt: Date;
}

export interface FeedQueryOptions {
  userId: string;
  cursor?: string;
  limit?: number;
  includeRead?: boolean;
}

export interface IFeedRepository {
  /**
   * Batch insert feed entries (for fan-out)
   */
  batchInsertFeedEntries(entries: Omit<FeedEntry, "readAt">[]): Promise<void>;

  /**
   * Get feed entries for a user (ranked by relevance score)
   */
  getFeedEntries(options: FeedQueryOptions): Promise<FeedEntry[]>;

  /**
   * Get feed entries by post ID (for score recalculation)
   */
  getFeedEntriesByPostId(postId: string): Promise<FeedEntry[]>;

  /**
   * Remove post from all user feeds (when post is deleted)
   */
  removeFromFeeds(postId: string): Promise<void>;

  /**
   * Update relevance score for a feed entry
   */
  updateRelevanceScore(
    userId: string,
    postId: string,
    score: number
  ): Promise<void>;

  /**
   * Mark feed entry as read
   */
  markAsRead(userId: string, postId: string): Promise<void>;

  /**
   * Check if feed entry exists
   */
  feedEntryExists(userId: string, postId: string): Promise<boolean>;

  /**
   * Get unread feed count for a user
   */
  getUnreadCount(userId: string): Promise<number>;

  /**
   * Batch update relevance scores (for score recalculation)
   */
  batchUpdateScores(
    updates: Array<{ userId: string; postId: string; score: number }>
  ): Promise<void>;
}

