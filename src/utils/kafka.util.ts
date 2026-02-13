import { Kafka, Producer,Admin } from "kafkajs";
import { KAFKA_CONFIG, KAFKA_TOPICS } from "../config/kafka.config";
import logger from "./logger.util";
import { v4 as uuidv4 } from "uuid";

let producer: Producer | null = null;
let admin: Admin | null = null;

/**
 * Initialize Kafka topics (create if they don't exist)
 * This should be called once when the service starts
 */
export async function initializeKafkaTopics(): Promise<void> {
  try {
    if (!admin) {
      const kafka = new Kafka(KAFKA_CONFIG);
      admin = kafka.admin();
      await admin.connect();
      logger.info("Kafka admin connected");
    }

    // Get all topic names from KAFKA_TOPICS
    const topics = Object.values(KAFKA_TOPICS).map((topicName) => ({
      topic: topicName,
      numPartitions: 3, // Match KAFKA_NUM_PARTITIONS in docker-compose
      replicationFactor: 1, // Match KAFKA_DEFAULT_REPLICATION_FACTOR
      configEntries: [
        {
          name: "retention.ms",
          value: "604800000", // 7 days
        },
        // Removed compression.type: "snappy" - KafkaJS doesn't support Snappy by default
        // If compression is needed, use producer-level compression with gzip instead
      ],
    }));

    // Check which topics already exist
    const existingTopics = await admin.listTopics();
    const topicsToCreate = topics.filter(
      (topic) => !existingTopics.includes(topic.topic)
    );

    if (topicsToCreate.length > 0) {
      logger.info(`Creating ${topicsToCreate.length} Kafka topics...`, {
        topics: topicsToCreate.map((t) => t.topic),
      });

      await admin.createTopics({
        topics: topicsToCreate,
        waitForLeaders: true,
        timeout: 30000,
      });

      logger.info("Kafka topics created successfully", {
        topics: topicsToCreate.map((t) => t.topic),
      });
    } else {
      logger.info("All Kafka topics already exist");
    }
  } catch (error: any) {
    // If topics already exist, that's okay - just log and continue
    if (error.message?.includes("already exists") || error.code === 36) {
      logger.info("Kafka topics already exist, continuing...");
    } else {
      logger.error("Failed to initialize Kafka topics", {
        error: error.message,
      });
      throw error;
    }
  }
}

export async function getProducer(): Promise<Producer> {
  if (!producer) {
    const kafka = new Kafka(KAFKA_CONFIG);
    producer = kafka.producer({
      retry: {
        initialRetryTime: 100,
        retries: 5,
        maxRetryTime: 30000,
        restartOnFailure: async (err: Error) => {
          logger.error("Kafka producer restart on failure", {
            error: err.message,
          });
          return true;
        },
      },
      allowAutoTopicCreation: false,
      idempotent: true, // Ensure exactly-once semantics
      // Compression is disabled - KafkaJS doesn't support Snappy by default
      // If compression is needed, install 'snappy' package and enable it here
    });
    await producer.connect();
    logger.info("Kafka producer connected");
  }
  return producer;
}

/**
 * Publish event to Kafka with retry logic
 */
export async function publishEvent(
  topic: string,
  event: any,
  key?: string,
  dedupeId?: string,
  retryCount: number = 0
): Promise<void> {
  const maxRetries = 3;
  const baseDelay = 1000;

  try {
    const kafkaProducer = await getProducer();
    // Ensure version is a number (if present in event)
    // schemaVersion is separate metadata about the event schema version
    const eventWithMetadata = {
      ...event,
      // Preserve version as number if it exists (for event ordering/conflict resolution)
      ...(event.version !== undefined && { version: typeof event.version === 'number' ? event.version : Number(event.version) }),
      dedupeId: dedupeId || uuidv4(),
      timestamp: new Date().toISOString(),
      source: "post-service",
      schemaVersion: "1.0", // Schema version (metadata), separate from event version
      retryCount,
    };

    await kafkaProducer.send({
      topic,
      messages: [
        {
          key: key || event.postId || event.commentId || event.userId || event.mentionedUserId || "default",
          value: JSON.stringify(eventWithMetadata),
          headers: {
            "event-type": topic,
            "dedupe-id": eventWithMetadata.dedupeId,
            source: "post-service",
          },
        },
      ],
    });

    logger.info(`Event published successfully`, {
      topic,
      dedupeId: eventWithMetadata.dedupeId,
      key,
      retryCount,
    });
  } catch (error: any) {
    logger.error(`Failed to publish event`, {
      topic,
      error: error.message,
      retryCount,
    });

    if (retryCount < maxRetries) {
      const delay = baseDelay * Math.pow(2, retryCount);
      logger.info(`Retrying event publication in ${delay}ms`, {
        topic,
        retryCount: retryCount + 1,
      });

      setTimeout(() => {
        publishEvent(topic, event, key, dedupeId, retryCount + 1);
      }, delay);
    } else {
      // Send to DLQ after max retries
      await publishToDLQ(topic, event, error.message, key);
    }
  }
}

/**
 * Publish failed events to Dead Letter Queue
 */
async function publishToDLQ(
  originalTopic: string,
  event: any,
  errorMessage: string,
  key?: string
): Promise<void> {
  try {
    const dlqTopic = `${originalTopic}-dlq`;
    const dlqEvent = {
      ...event,
      originalTopic,
      errorMessage,
      dlqTimestamp: new Date().toISOString(),
      dlqReason: "max_retries_exceeded",
    };

    const kafkaProducer = await getProducer();
    await kafkaProducer.send({
      topic: dlqTopic,
      messages: [
        {
          key: key || event.postId || event.commentId || event.userId || "default",
          value: JSON.stringify(dlqEvent),
          headers: {
            "event-type": dlqTopic,
            "original-topic": originalTopic,
            "dlq-reason": "max_retries_exceeded",
          },
        },
      ],
    });

    logger.error(`Event sent to DLQ`, {
      originalTopic,
      dlqTopic,
      errorMessage,
    });
  } catch (dlqError: any) {
    logger.error(`Failed to send event to DLQ`, {
      originalTopic,
      dlqError: dlqError.message,
    });
  }
}

/**
 * Disconnect admin client (for graceful shutdown)
 */
export async function disconnectAdmin(): Promise<void> {
  if (admin) {
    await admin.disconnect();
    admin = null;
    logger.info("Kafka admin disconnected");
  }
}

/**
 * Disconnect producer (for graceful shutdown)
 */
export async function disconnectProducer(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
    logger.info("Kafka producer disconnected");
  }
}