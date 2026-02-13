import { IsString, IsOptional, IsArray, IsEnum, MinLength, ArrayMinSize, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export interface ReportMetadata {
  [key: string]: string | number | boolean;
}


export enum Visibility {
  PUBLIC = 'PUBLIC',
  VISIBILITY_CONNECTIONS = 'VISIBILITY_CONNECTIONS',
}

export enum CommentControl {
  ANYONE = 'ANYONE',
  CONNECTIONS = 'CONNECTIONS',
  NONE = 'NONE',
}

export enum ReportReason {
  SPAM = 'SPAM',
  INAPPROPRIATE = 'INAPPROPRIATE',
  HARASSMENT = 'HARASSMENT',
  HATE_SPEECH = 'HATE_SPEECH',
  VIOLENCE = 'VIOLENCE',
  SELF_HARM = 'SELF_HARM',
  OTHER = 'OTHER',
  FALSE_INFORMATION = 'FALSE_INFORMATION',
  COPYRIGHT_VIOLATION = 'COPYRIGHT_VIOLATION',
}

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

export class CreateCommentDto {
  @IsString()
  @MinLength(1, { message: "Comment content is required" })
  content!: string;

  @IsOptional()
  @IsString()
  parentCommentId?: string;
}

export class UpdateCommentDto {
  @IsString()
  @MinLength(1, { message: "Comment content is required" })
  content!: string;
}

export class SendPostDto {
  @IsArray()
  @ArrayMinSize(1, { message: "At least one recipient is required" })
  @IsString({ each: true })
  recipientIds!: string[];

  @IsOptional()
  @IsString()
  message?: string;
}

export class ReportPostDto {
  @IsEnum(ReportReason, { message: "Valid report reason is required" })
  reason!: ReportReason;

  @IsOptional()
  @IsObject()
  metadata?: ReportMetadata;

  @IsOptional()
  @IsString()
  description?: string;
}

export class ReportCommentDto {
  @IsEnum(ReportReason, { message: "Valid report reason is required" })
  reason!: ReportReason;

  @IsOptional()
  @IsObject()
  metadata?: any;
}
