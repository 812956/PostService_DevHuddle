import { Kafka, Producer } from "kafkajs";
import { KAFKA_CONFIG, KAFKA_TOPICS } from "../config/kafka.config";
import logger from "./logger.util";
import { v4 as uuidv4 } from "uuid";

let producer: Producer | null = null;

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
    const eventWithMetadata = {
      ...event,
      dedupeId: dedupeId || uuidv4(),
      timestamp: new Date().toISOString(),
      source: "post-service",
      version: "1.0",
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
 * Disconnect producer (for graceful shutdown)
 */
export async function disconnectProducer(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
    logger.info("Kafka producer disconnected");
  }
}