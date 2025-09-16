import { Post, Prisma } from ".prisma/client";
import { CreatePostRequest, ListPosts, Media } from "../grpc/generated/post";

type PostFetchedType = Post & {
  user: { avatar: string; name: string; username: string };
};

export class PostMapper {
  static toPost(dto: any): Partial<Prisma.PostCreateInput> {
    return {
      userId: dto.userId,
      content: dto.content ?? null,
      type: dto.type,
      tags: [],
      imageMedia: dto.media
        .filter((m: Media) => m.type.startsWith("image/"))
        .map((m: Media) => JSON.stringify(m)),
      videoMedia: dto.media
        .filter((m: Media) => m.type.startsWith("video/"))
        .map((m: Media) => JSON.stringify(m)),
      visibility: dto.visibility,
      commentControl: dto.commentControl,
    };
  }

  static fromPosts(posts: PostFetchedType[]): ListPosts[] {
    return posts.map((post: PostFetchedType) => ({
      id: post.id,
      userId: post.userId,
      type: post.type,
      content: post.content ?? "",
      tags: post.tags ?? [],
      imageMedia: (post.imageMedia ?? []).map(
        (m) => JSON.parse(m as string) as Media
      ),
      videoMedia: (post.videoMedia ?? []).map(
        (m) => JSON.parse(m as string) as Media
      ),
      visibility: post.visibility,
      commentControl: post.commentControl,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      impressions: post.impressions ?? 0,
      user: post.user,
    }));
  }
}
