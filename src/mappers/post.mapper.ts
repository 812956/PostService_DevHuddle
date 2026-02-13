import { posts, Comment, Prisma } from '@prisma/client';
import { PostResponseDto, CommentResponseDto } from '../dtos/response/post.dto';
import { CreatePostDto } from '../dtos/request/create-post.dto';

/**
 * Mapper class for Post entity transformations
 */
export class PostMapper {
  /**
   * Map Prisma posts entity to PostResponseDto
   */
  static toResponseDto(entity: posts, likeCount?: number, commentCount?: number, shareCount?: number): PostResponseDto {
    return {
      id: entity.id,
      userId: entity.userId,
      content: entity.content || '',
      // Note: posts schema doesn't have imageMedia array, it uses Media relation
      mediaIds: [],
      visibility: entity.visibility,
      commentControl: entity.commentControl,
      likeCount,
      commentCount,
      shareCount,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    };
  }

  /**
   * Map CreatePostDto to Prisma posts create input
   */
  static toCreateInput(dto: CreatePostDto, userId: string): Prisma.postsCreateInput {
    return {
      userId,
      content: dto.content,
      visibility: dto.visibility || 'PUBLIC',
      commentControl: dto.commentControl || 'ANYONE',
      tags: []
      // Note: posts schema doesn't have type, imageMedia, videoMedia fields
      // Media is handled via Media relation
    };
  }

  /**
   * Map multiple Posts entities to response DTOs
   */
  static toResponseDtoList(entities: posts[]): PostResponseDto[] {
    return entities.map(entity => this.toResponseDto(entity));
  }
}

/**
 * Mapper class for Comment entity transformations
 */
export class CommentMapper {
  /**
   * Map Prisma Comment entity to CommentResponseDto
   */
  static toResponseDto(entity: Comment, likeCount?: number, replyCount?: number): CommentResponseDto {
    return {
      id: entity.id,
      postId: entity.postId,
      userId: entity.userId,
      content: entity.content,
      parentCommentId: entity.parentCommentId || undefined,
      likeCount,
      replyCount,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    };
  }

  /**
   * Map multiple Comment entities to response DTOs
   */
  static toResponseDtoList(entities: Comment[]): CommentResponseDto[] {
    return entities.map(entity => this.toResponseDto(entity));
  }
}
