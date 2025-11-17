import { Reaction, Prisma, ReactionTargetType } from ".prisma/client";

// export type LikeTargetType = "POST" | "COMMENT";

export interface CreateLikeData {
  userId: string;
  type?: string;
  postId?: string;
  commentId?: string;
  targetType: ReactionTargetType;
}

export interface ILikeRepository {
  // Unified methods that work for both posts and comments
  createLike(data: CreateLikeData): Promise<Reaction>;
  deleteLike(targetType: ReactionTargetType, targetId: string, userId: string): Promise<void>;
  findLike(targetType: ReactionTargetType, targetId: string, userId: string): Promise<Reaction | null>;
  getLikes(targetType: ReactionTargetType, targetId: string, limit?: number): Promise<Reaction[]>;
  getLikeCount(targetType: ReactionTargetType, targetId: string): Promise<number>;
}