/**
 * Media Service HTTP Client
 * 
 * This client communicates with the Media Service (HTTP REST API)
 * to validate media ownership and link media to posts.
 * 
 * Why HTTP instead of gRPC?
 * - Media Service uses HTTP REST API (simpler for file operations)
 * - Easier to integrate with existing infrastructure
 * - Standard REST patterns for media operations
 */

const MEDIA_SERVICE_URL = process.env.MEDIA_SERVICE_URL || "http://media-service:5003";

export interface ValidateMediaRequest {
  mediaIds: string[];
  userId: string;
}

export interface LinkMediaRequest {
  mediaIds: string[];
  postId: string;
  userId: string;
}

export interface MediaValidationResponse {
  valid: boolean;
  invalidMediaIds?: string[];
  message?: string;
  validMedia?: any[];
}

/**
 * Validate that media belongs to the user and is not already linked
 * 
 * Why this is important:
 * - Security: Prevents users from linking other users' media to their posts
 * - Data integrity: Ensures media can only be linked to one post at a time
 * - Prevents orphaned media records
 */
export async function validateMediaOwnership(
  mediaIds: string[],
  userId: string
): Promise<MediaValidationResponse> {
  try {
    const response = await fetch(`${MEDIA_SERVICE_URL}/api/v1/media/validate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mediaIds,
        userId,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Validation failed" }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    const result = await response.json();
    return result.data || result;
  } catch (error: any) {
    // If Media Service is unavailable, log and allow (graceful degradation)
    // In production, you might want to fail fast instead
    console.error("Media Service validation failed:", error.message);
    throw new Error(`Media validation failed: ${error.message}`);
  }
}

/**
 * Link media to a post in the Media Service
 * 
 * Why call Media Service instead of updating Post Service database?
 * - Single source of truth: Media Service owns all media records
 * - Consistency: Media Service manages media lifecycle
 * - Separation of concerns: Post Service doesn't manage media directly
 */
export async function linkMediaToPost(
  mediaIds: string[],
  postId: string,
  userId: string
): Promise<void> {
  try {
    const response = await fetch(`${MEDIA_SERVICE_URL}/api/v1/media/link-to-post`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mediaIds,
        postId,
        userId,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Linking failed" }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }
  } catch (error: any) {
    console.error("Failed to link media to post:", error.message);
    throw new Error(`Failed to link media: ${error.message}`);
  }
}

