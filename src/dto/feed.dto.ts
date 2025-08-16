import { z } from "zod";

// ---------- User ----------
export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatar: z.string(),
  title: z.string().optional(),
});

// ---------- ImageData ----------
export const ImageDataSchema = z.object({
  id: z.number(),
  name: z.string(),
  url: z.string(),
});

// ---------- ImageTransform ----------
export const ImageTransformSchema = z.object({
  rotation: z.number(),
  flipH: z.boolean(),
  flipV: z.boolean(),
  zoom: z.number(),
  straighten: z.number(),
  aspectRatio: z.string(),
  filter: z.string(),
  brightness: z.number(),
  contrast: z.number(),
  saturation: z.number(),
  temperature: z.number(),
  highlights: z.number(),
  shadows: z.number(),
  altText: z.string(),
});

// ---------- VideoTransform ----------
export const VideoTransformSchema = z.object({}).optional(); // empty for now

// ---------- Poll ----------
export const PollOptionSchema = z.object({
  id: z.number(),
  text: z.string(),
});

export const PollSchema = z.object({
  question: z.string(),
  options: z.array(PollOptionSchema),
  durationDays: z.number(),
});

// ---------- Media ----------
export const MediaSchema = z.object({
  id: z.string(),
  type: z.enum(["image", "video"]),
  name: z.string(),
  taggedUsers: z.array(UserSchema).default([]).optional(),
  transform: z
    .union([
      ImageTransformSchema,
      VideoTransformSchema,
      z.null()
    ])
    .optional(),
});

// ---------- Post ----------
export const PostSchema = z.object({
  content: z.string().default(''),
  media: z.array(MediaSchema).optional(),
  poll: PollSchema.nullable().optional(),
  visibility: z.enum(["PUBLIC", "VISIBILITY_CONNECTIONS"]),
  comment_control: z.enum(["ANYONE", "CONNECTIONS", "NOBODY"]),
});

// ---------- TypeScript Types from Zod ----------
export type PostDTO = z.infer<typeof PostSchema>;
