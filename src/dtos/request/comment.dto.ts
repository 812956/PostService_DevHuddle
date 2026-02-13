import { IsString, MinLength, IsOptional } from 'class-validator';

/**
 * Request DTO for creating a comment
 */
export class CreateCommentDto {
  @IsString()
  @MinLength(1, { message: "Comment content is required" })
  content!: string;

  @IsOptional()
  @IsString()
  parentCommentId?: string;
}

/**
 * Request DTO for updating a comment
 */
export class UpdateCommentDto {
  @IsString()
  @MinLength(1, { message: "Comment content is required" })
  content!: string;
}
