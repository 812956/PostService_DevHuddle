import { IsArray, IsString, ArrayMinSize, IsOptional, IsEnum, IsObject } from 'class-validator';

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

/**
 * Request DTO for sending a post to users
 */
export class SendPostDto {
  @IsArray()
  @ArrayMinSize(1, { message: "At least one recipient is required" })
  @IsString({ each: true })
  recipientIds!: string[];

  @IsOptional()
  @IsString()
  message?: string;
}

/**
 * Request DTO for reporting a post
 */
export class ReportPostDto {
  @IsEnum(ReportReason, { message: "Valid report reason is required" })
  reason!: ReportReason;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsString()
  description?: string;
}

/**
 * Request DTO for reporting a comment
 */
export class ReportCommentDto {
  @IsEnum(ReportReason, { message: "Valid report reason is required" })
  reason!: ReportReason;

  @IsOptional()
  @IsObject()
  metadata?: any;
}
