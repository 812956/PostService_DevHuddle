import { IsString, MinLength, IsOptional, IsArray, IsEnum } from 'class-validator';

export enum Visibility {
  PUBLIC = 'PUBLIC',
  CONNECTIONS = 'CONNECTIONS',
}

export enum CommentControl {
  ANYONE = 'ANYONE',
  CONNECTIONS = 'CONNECTIONS',
  NOBODY = 'NOBODY',
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
