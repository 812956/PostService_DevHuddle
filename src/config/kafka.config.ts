import { KafkaConfig } from "kafkajs";

export const KAFKA_CONFIG: KafkaConfig = {
  brokers: [process.env.KAFKA_BROKER || "localhost:9092"],
  clientId: process.env.KAFKA_CLIENT_ID || "post-service",
  retry: {
    initialRetryTime: 100,
    retries: 5,
    maxRetryTime: 30000,
  },
};

export const KAFKA_TOPICS = {
    // Like events - Posts
    POST_LIKE_CREATED: "post.like.created.v1",
    POST_LIKE_REMOVED: "post.like.removed.v1",
    POST_LIKE_CREATED_DLQ: "post.like.created.v1-dlq",
    POST_LIKE_REMOVED_DLQ: "post.like.removed.v1-dlq",
  
    // Like events - Comments
    COMMENT_LIKE_CREATED: "comment.like.created.v1",
    COMMENT_LIKE_REMOVED: "comment.like.removed.v1",
    COMMENT_LIKE_CREATED_DLQ: "comment.like.created.v1-dlq",
    COMMENT_LIKE_REMOVED_DLQ: "comment.like.removed.v1-dlq",
  
    // Comment events
    POST_COMMENT_CREATED: "post.comment.created.v1",
    POST_COMMENT_EDITED: "post.comment.edited.v1",
    POST_COMMENT_DELETED: "post.comment.deleted.v1",
    POST_COMMENT_CREATED_DLQ: "post.comment.created.v1-dlq",
    POST_COMMENT_EDITED_DLQ: "post.comment.edited.v1-dlq",
    POST_COMMENT_DELETED_DLQ: "post.comment.deleted.v1-dlq",
  
    // Share events
    POST_SHARED: "post.shared.v1",
    POST_SHARED_DLQ: "post.shared.v1-dlq",
  
    // Report events
    POST_REPORTED: "post.reported.v1",
    POST_REPORTED_DLQ: "post.reported.v1-dlq",
  
    // Mention events
    USER_MENTIONED: "user.mentioned.v1",
    USER_MENTIONED_DLQ: "user.mentioned.v1-dlq",
  } as const;