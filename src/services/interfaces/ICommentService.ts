import { Comment } from "@prisma/client";

export interface ICommentService {
    createComment(
      postId: string,
      userId: string,
      content: string,
      parentCommentId?: string
    ): Promise<any>;
    updateComment(commentId: string, userId: string, content: string): Promise<any>;
    deleteComment(commentId: string, userId: string): Promise<void>;
    getComments(postId: string, limit?: number, offset?: number): Promise<Comment[]>;
    getComment(commentId: string): Promise<Comment | null>;
    getCommentCount(postId: string): Promise<number>;
  }