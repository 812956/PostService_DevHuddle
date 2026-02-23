import { posts, Comment, Prisma, Visibility as PrismaVisibility, CommentControl as PrismaCommentControl } from '@prisma/client';
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
      visibility: (dto.visibility as unknown as PrismaVisibility) || PrismaVisibility.PUBLIC,
      commentControl: (dto.commentControl as unknown as PrismaCommentControl) || PrismaCommentControl.ANYONE,
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

  /**
   * Map Prisma posts entity to gRPC Post message
   */
  static toGrpcPost(entity: any): any {
    return {
      id: entity.id,
      content: entity.content || '',
      userId: entity.userId,
      createdAt: entity.createdAt.toISOString(),
      user: entity.user || { id: entity.userId, username: 'Unknown', name: 'Unknown', avatar: '' },
      attachments: (entity.Media || []).map((m: any) => ({
        id: m.id,
        post_id: m.postId || entity.id,
        type: String(m.type || 'IMAGE'),
        url: m.url,
        created_at: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
      })),
      engagement: {
        likesCount: entity.likesCount || 0,
        commentsCount: entity.commentsCount || 0,
        sharesCount: entity.sharesCount || 0,
        isLiked: false,
        isShared: false,
      }
    };
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
