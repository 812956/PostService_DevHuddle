import { IsString, MinLength, IsOptional, IsArray, IsEnum } from 'class-validator';

export enum Visibility {
  PUBLIC = 'PUBLIC',
  VISIBILITY_CONNECTIONS = 'VISIBILITY_CONNECTIONS',
}

export enum CommentControl {
  ANYONE = 'ANYONE',
  CONNECTIONS = 'CONNECTIONS',
  NONE = 'NONE',
}

/**
 * Request DTO for creating a post
 */
export class CreatePostDto {
  @IsString()
  @MinLength(1, { message: "Post content is required" })
  content!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaIds?: string[];

  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility;

  @IsOptional()
  @IsEnum(CommentControl)
  commentControl?: CommentControl;
}
