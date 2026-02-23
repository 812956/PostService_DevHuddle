// Media validation response
export interface MediaValidationResponse {
  valid: boolean;
  invalidMediaIds?: string[];
  message?: string;
  validMedia?: ValidatedMedia[];
}

export interface ValidatedMedia {
  id: string;
  mediaType: string;
  cdnUrl?: string;
  originalUrl: string;
  thumbnailUrls?: ThumbnailUrl[];
  thumbnail?: string;
}

export interface ThumbnailUrl {
  cdnUrl: string;
}

// Report metadata
export interface ReportMetadata {
  [key: string]: string | number | boolean;
}

// gRPC user response
export interface UserForFeedListing {
  avatar: string;
  name: string;
  username: string;
}

import { posts, Media } from "@prisma/client";

// Post with user enrichment
export type EnrichedPost = posts & {
  user?: UserForFeedListing;
  Media?: Media[];
};



export interface MediaAttachment {
  id: string;
  type: string;
  url: string;
  thumbnail?: string;
}
