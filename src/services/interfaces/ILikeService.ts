export interface ILikeService {
  // Post Likes
  likePost(postId: string, userId: string): Promise<void>;
  unlikePost(postId: string, userId: string): Promise<void>;
  isPostLiked(postId: string, userId: string): Promise<boolean>;
  getPostLikeCount(postId: string): Promise<number>;
  getPostLikesUsers(postId: string, limit?: number, page?: number): Promise<{ users: any[], totalCount: number, hasMore: boolean }>;

  // Comment Likes
  likeComment(commentId: string, userId: string): Promise<void>;
  unlikeComment(commentId: string, userId: string): Promise<void>;
  isCommentLiked(commentId: string, userId: string): Promise<boolean>;
  getCommentLikeCount(commentId: string): Promise<number>;
}