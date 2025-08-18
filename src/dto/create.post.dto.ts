import { z } from "zod";

// Zod schema for incoming gRPC CreatePostRequest
export const CreatePostSchema = z.object({
  content: z.string().optional(),
  media: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["image", "video"]),
      name: z.string(),
      url: z.string(),
      taggedUsers: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            avatar: z.string().optional(),
            title: z.string().optional(),
          })
        ) 
        .optional(),
      transform: z
        .object({
          image: z
            .object({
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
              altText: z.string().optional(),
            })
            .optional(),
          video: z.object({}).optional(), // extend later
        })
        .optional(),
    })
  ),
  visibility: z.enum(["PUBLIC", "CONNECTIONS", "GROUP"]),
  commentControl: z.enum(["CONNECTIONS", "ANYONE", "NONE"]),
});

// Infer the TS type from the schema
export type CreatePostDto = z.infer<typeof CreatePostSchema>;
