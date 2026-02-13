/**
 * Response DTO for a post
 */
export interface PostResponseDto {
  id: string;
  userId: string;
  content: string;
  mediaIds?: string[];
  visibility: string;
  commentControl: string;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Response DTO for a comment
 */
export interface CommentResponseDto {
  id: string;
  postId: string;
  userId: string;
  content: string;
  parentCommentId?: string;
  likeCount?: number;
  replyCount?: number;
  createdAt: Date;
  updatedAt: Date;
}
