"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostSchema = exports.MediaSchema = exports.PollSchema = exports.PollOptionSchema = exports.VideoTransformSchema = exports.ImageTransformSchema = exports.ImageDataSchema = exports.UserSchema = void 0;
const zod_1 = require("zod");
// ---------- User ----------
exports.UserSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    avatar: zod_1.z.string(),
    title: zod_1.z.string().optional(),
});
// ---------- ImageData ----------
exports.ImageDataSchema = zod_1.z.object({
    id: zod_1.z.number(),
    name: zod_1.z.string(),
    url: zod_1.z.string(),
});
// ---------- ImageTransform ----------
exports.ImageTransformSchema = zod_1.z.object({
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
    altText: zod_1.z.string(),
});
// ---------- VideoTransform ----------
exports.VideoTransformSchema = zod_1.z.object({}).optional(); // empty for now
// ---------- Poll ----------
exports.PollOptionSchema = zod_1.z.object({
    id: zod_1.z.number(),
    text: zod_1.z.string(),
});
exports.PollSchema = zod_1.z.object({
    question: zod_1.z.string(),
    options: zod_1.z.array(exports.PollOptionSchema),
    durationDays: zod_1.z.number(),
});
// ---------- Media ----------
exports.MediaSchema = zod_1.z.object({
    id: zod_1.z.string(),
    type: zod_1.z.enum(["image", "video"]),
    name: zod_1.z.string(),
    taggedUsers: zod_1.z.array(exports.UserSchema).default([]).optional(),
    transform: zod_1.z
        .union([
        exports.ImageTransformSchema,
        exports.VideoTransformSchema,
        zod_1.z.null()
    ])
        .optional(),
});
// ---------- Post ----------
exports.PostSchema = zod_1.z.object({
    content: zod_1.z.string().default(''),
    media: zod_1.z.array(exports.MediaSchema).optional(),
    poll: exports.PollSchema.nullable().optional(),
    visibility: zod_1.z.enum(["PUBLIC", "VISIBILITY_CONNECTIONS"]),
    comment_control: zod_1.z.enum(["ANYONE", "CONNECTIONS", "NOBODY"]),
});
