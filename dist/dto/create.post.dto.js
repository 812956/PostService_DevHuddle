"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatePostSchema = void 0;
const zod_1 = require("zod");
// Zod schema for incoming gRPC CreatePostRequest
exports.CreatePostSchema = zod_1.z.object({
    content: zod_1.z.string().optional(),
    media: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        type: zod_1.z.enum(["image", "video"]),
        name: zod_1.z.string(),
        url: zod_1.z.string(),
        taggedUsers: zod_1.z
            .array(zod_1.z.object({
            id: zod_1.z.string(),
            name: zod_1.z.string(),
            avatar: zod_1.z.string().optional(),
            title: zod_1.z.string().optional(),
            points: zod_1.z.number().optional(),
        }))
            .optional(),
        transform: zod_1.z
            .object({
            image: zod_1.z
                .object({
                rotation: zod_1.z.number(),
                flipH: zod_1.z.boolean(),
                flipV: zod_1.z.boolean(),
                zoom: zod_1.z.number(),
                straighten: zod_1.z.number(),
                aspectRatio: zod_1.z.string(),
                filter: zod_1.z.string(),
                brightness: zod_1.z.number(),
                contrast: zod_1.z.number(),
                saturation: zod_1.z.number(),
                temperature: zod_1.z.number(),
                highlights: zod_1.z.number(),
                shadows: zod_1.z.number(),
                altText: zod_1.z.string().optional(),
            })
                .optional(),
            video: zod_1.z.object({}).optional(), // extend later
        })
            .optional(),
    })),
    visibility: zod_1.z.enum(["PUBLIC", "CONNECTIONS", "GROUP"]),
    commentControl: zod_1.z.enum(["CONNECTIONS", "ANYONE", "NONE"]),
});
