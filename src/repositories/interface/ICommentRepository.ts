import { Comment, Prisma } from ".prisma/client";

export interface CommentSelectOptions {
  include?: {
    commentMentions?: boolean;
    Replies?: {
      where?: Prisma.CommentWhereInput;
      take?: number;
      orderBy?: Prisma.CommentOrderByWithRelationInput;
    };
  };
  where?: Prisma.CommentWhereInput;
  orderBy?: Prisma.CommentOrderByWithRelationInput;
  take?: number;
  skip?: number;
}

export interface ICommentRepository {
  createComment(data: {
    postId: string;
    userId: string;
    content: string;
    parentCommentId?: string;
  }): Promise<Comment>;
  updateComment(commentId: string, content: string): Promise<Comment>;
  deleteComment(commentId: string): Promise<void>;
  findComment(commentId: string): Promise<Comment | null>;
  // getCommentsByPost(postId: string, options?: CommentSelectOptions): Promise<Comment[]>;
  getCommentsByPost(
    postId: string,
    limit: number,
    offset: number,
    includeReplies?: boolean,
    includeMentions?: boolean
  ): Promise<Comment[]>;
  getCommentCount(postId: string): Promise<number>;
  getReplies(commentId: string, limit?: number): Promise<Comment[]>;
  incrementLikesCount(commentId: string): Promise<void>;
  decrementLikesCount(commentId: string): Promise<void>;
}