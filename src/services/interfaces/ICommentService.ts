import { Comment } from "@prisma/client";
import { userClient } from "../../config/grpc.client";
import { grpcs } from "../../utils/grpc.client.call.util";
import { 
  getUserForFeedListingRequest, 
  getUserForFeedListingResponse,
  UserServiceClient 
} from "../../grpc/generated/user";

export interface ICommentService {
    createComment(
      postId: string,
      userId: string,
      content: string,
      parentCommentId?: string
    ): Promise<any>;
    updateComment(commentId: string, userId: string, content: string): Promise<any>;
    deleteComment(commentId: string, userId: string): Promise<void>;
    getComments(postId: string, limit?: number, offset?: number, userId?: string): Promise<Comment[]>;
    getComment(commentId: string): Promise<Comment | null>;
    getCommentCount(postId: string): Promise<number>;
    getReplies(commentId: string, limit?: number, userId?: string): Promise<Comment[]>;
    getCommentPreview(postId: string, userId?: string): Promise<{ comment: Comment | null; totalCount: number; hasMore: boolean }>;
  }