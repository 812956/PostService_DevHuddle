"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostMapper = void 0;
class PostMapper {
    static toPost(dto) {
        return {
            userId: dto.userId,
            content: dto.content ?? null,
            type: dto.type,
            tags: [],
            imageMedia: dto.media
                .filter((m) => m.type.startsWith("image/"))
                .map((m) => JSON.stringify(m)),
            videoMedia: dto.media
                .filter((m) => m.type.startsWith("video/"))
                .map((m) => JSON.stringify(m)),
            visibility: dto.visibility,
            commentControl: dto.commentControl,
        };
    }
    static fromPosts(posts) {
        return posts.map((post) => ({
            id: post.id,
            userId: post.userId,
            type: post.type,
            content: post.content ?? "",
            tags: post.tags ?? [],
            imageMedia: (post.imageMedia ?? []).map((m) => JSON.parse(m)),
            videoMedia: (post.videoMedia ?? []).map((m) => JSON.parse(m)),
            visibility: post.visibility,
            commentControl: post.commentControl,
            createdAt: post.createdAt.toISOString(),
            updatedAt: post.updatedAt.toISOString(),
            impressions: post.impressions ?? 0,
            user: post.user,
        }));
    }
}
exports.PostMapper = PostMapper;
