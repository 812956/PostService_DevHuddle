import { Prisma } from ".prisma/client";
import { CreatePostDto } from "../dto/create.post.dto";

export class PostMapper {
    static toPost(dto: CreatePostDto, userId: string): Prisma.PostCreateInput {
    return {
      userId,
      content: dto.content ?? null,
      type: "TEXT",
      tags: [], 
      mentions: [], 
      imageUrls: dto.media
        .filter((m) => m.type === "image")
        .map((m) => m.url),
      videoUrl:
        dto.media.find((m) => m.type === "video")?.url ??
        "", 
      visibility: dto.visibility,
      commentControl: dto.commentControl,
    };
  }
}