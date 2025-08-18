"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostMapper = void 0;
class PostMapper {
    static toPost(dto, userId) {
        return {
            userId,
            content: dto.content ?? null,
            type: "TEXT",
            tags: [],
            mentions: [],
            imageUrls: dto.media
                .filter((m) => m.type === "image")
                .map((m) => m.url),
            videoUrl: dto.media.find((m) => m.type === "video")?.url ??
                "",
            visibility: dto.visibility,
            commentControl: dto.commentControl,
        };
    }
}
exports.PostMapper = PostMapper;
