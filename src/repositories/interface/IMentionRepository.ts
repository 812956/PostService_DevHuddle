import { PostMention, CommentMention, Prisma } from ".prisma/client";

export interface IMentionRepository {
  createPostMention(data: {
    postId: string;
    mentionedUserId: string;
    actorId: string;
  }): Promise<PostMention>;
  createCommentMention(data: {
    commentId: string;
    mentionedUserId: string;
    actorId: string;
  }): Promise<CommentMention>;
  getPostMentions(postId: string): Promise<PostMention[]>;
  getCommentMentions(commentId: string): Promise<CommentMention[]>;
  deletePostMentions(postId: string): Promise<void>;
  deleteCommentMentions(commentId: string): Promise<void>;
}