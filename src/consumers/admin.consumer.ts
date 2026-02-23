import { getConsumer } from "../utils/kafka.util";
import { KAFKA_TOPICS } from "../config/kafka.config";
import logger from "../utils/logger.util";
import { PostRepository } from "../repositories/impliments/post.repository";
import { CommentRepository } from "../repositories/impliments/comment.repository";

const postRepository = new PostRepository();
const commentRepository = new CommentRepository();

/**
 * Handles moderation enforcement for the post-service domain.
 * Listens for admin-action-enforced and user-state-toggled events
 * and applies the appropriate visibility changes to posts and comments.
 */
export async function startAdminConsumer(): Promise<void> {
  const consumer = await getConsumer("post-service-admin-enforcement");

  await consumer.subscribe({
    topics: [
      KAFKA_TOPICS.ADMIN_ACTION_ENFORCED, 
      KAFKA_TOPICS.USER_STATE_TOGGLED,
      KAFKA_TOPICS.USER_DELETED
    ],
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ topic, message }: any) => {
      const rawValue = message.value?.toString();
      if (!rawValue) return;

      let event: any;
      try {
        event = JSON.parse(rawValue);
      } catch (err) {
        logger.error("AdminConsumer: Failed to parse message", { rawValue });
        return;
      }

      logger.info(`AdminConsumer received event on topic: ${topic}`, {
        eventType: event.eventType || event.type,
      });

      try {
        if (topic === KAFKA_TOPICS.USER_STATE_TOGGLED) {
          await handleUserStateToggled(event);
        } else if (topic === KAFKA_TOPICS.ADMIN_ACTION_ENFORCED) {
          await handleAdminActionEnforced(event);
        } else if (topic === KAFKA_TOPICS.USER_DELETED) {
          await handleUserDeleted(event);
        }
      } catch (err: any) {
        logger.error("AdminConsumer: Failed to handle event", {
          topic,
          error: err.message,
          event,
        });
        // No re-throw — prevent consumer crash on bad events
      }
    },
  });

  logger.info("AdminConsumer started and subscribed to moderation topics");
}

async function handleUserStateToggled(event: {
  userId: string;
  isBlocked: boolean;
  reason?: string;
}) {
  const { userId, isBlocked, reason = "Account moderation" } = event;

  if (isBlocked) {
    logger.info(`Hiding all posts and comments for blocked user: ${userId}`);
    await Promise.all([
      postRepository.hideAllPostsByUser(userId, reason),
      commentRepository.hideAllCommentsByUser(userId, reason),
    ]);
  } else {
    logger.info(`Unhiding all posts and comments for unblocked user: ${userId}`);
    await Promise.all([
      postRepository.unhideAllPostsByUser(userId),
      commentRepository.unhideAllCommentsByUser(userId),
    ]);
  }
}

async function handleAdminActionEnforced(event: {
  action: "SUSPEND" | "BAN" | "HIDE" | "WARN";
  targetType: string;
  targetId: string;
  reason: string;
}) {
  const { action, targetType, targetId, reason } = event;

  if (action === "HIDE") {
    if (targetType === "POST") {
      logger.info(`Hiding post: ${targetId}`);
      await postRepository.hidePost(targetId, reason);
    } else if (targetType === "COMMENT") {
      logger.info(`Hiding comment: ${targetId}`);
      await commentRepository.hideComment(targetId, reason);
    } else if (targetType === "USER") {
      // Hide all content from this user if HIDE action targets a USER
      logger.info(`Hiding all content for user: ${targetId}`);
      await Promise.all([
        postRepository.hideAllPostsByUser(targetId, reason),
        commentRepository.hideAllCommentsByUser(targetId, reason),
      ]);
    }
  } else if (action === "BAN" || action === "SUSPEND") {
    if (targetType === "USER") {
      logger.info(`Hiding all content for ${action} user: ${targetId}`);
      await Promise.all([
        postRepository.hideAllPostsByUser(targetId, reason),
        commentRepository.hideAllCommentsByUser(targetId, reason),
      ]);
    }
  }
  // WARN action — no content visibility change needed
}

async function handleUserDeleted(event: { userId: string }) {
  const { userId } = event;
  logger.info(`🗑️ Account deletion Saga: Deleting all content for user: ${userId}`);

  try {
    await Promise.all([
      postRepository.deleteAllPostsByUser(userId),
      commentRepository.deleteAllCommentsByUser(userId),
    ]);
    logger.info(`✅ Successfully deleted all posts and comments for user: ${userId}`);
  } catch (err: any) {
    logger.error(`❌ Failed to delete content for user: ${userId}`, { error: err.message });
    // In a production Saga, we might want to retry or move to a DLQ
    // For now, we log the error
    throw err;
  }
}

