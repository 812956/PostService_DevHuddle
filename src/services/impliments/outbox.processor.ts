import { IOutboxRepository } from "../../repositories/interface/IOutboxRepository";
import { OutboxStatus, OutboxEvent } from "@prisma/client";
import { publishEvent } from "../../utils/kafka.util";
import logger from "../../utils/logger.util";
import { KAFKA_TOPICS } from "../../config/kafka.config";

export class OutboxProcessor {
  private isRunning: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 50;
  private readonly POLL_INTERVAL_MS = 5000; // 5 seconds

  constructor(private outboxRepository: IOutboxRepository) {}

  /**
   * Start the outbox processor
   */
  start(): void {
    if (this.isRunning) {
      logger.warn("Outbox processor is already running");
      return;
    }

    this.isRunning = true;
    logger.info("Starting outbox processor");

    // Process immediately on start
    this.processPendingEvents();

    // Then process at intervals
    this.processingInterval = setInterval(() => {
      this.processPendingEvents();
    }, this.POLL_INTERVAL_MS);
  }

  /**
   * Stop the outbox processor
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    logger.info("Outbox processor stopped");
  }

  /**
   * Process pending outbox events
   */
  private async processPendingEvents(): Promise<void> {
    try {
      const pendingEvents = await this.outboxRepository.getPendingEvents(this.BATCH_SIZE);

      if (pendingEvents.length === 0) {
        return;
      }

      logger.info(`Processing ${pendingEvents.length} pending outbox events`);

      // Process events in parallel (with concurrency limit)
      const concurrency = 10;
      for (let i = 0; i < pendingEvents.length; i += concurrency) {
        const batch = pendingEvents.slice(i, i + concurrency);
        await Promise.allSettled(
          batch.map((event) => this.processEvent(event))
        );
      }
    } catch (error: any) {
      logger.error("Error processing pending events", {
        error: error.message,
        stack: error.stack,
      });
    }
  }

  /**
   * Process a single outbox event
   */
  private async processEvent(event: OutboxEvent): Promise<void> {
    try {
      // Mark as SENDING
      await this.outboxRepository.updateEventStatus(
        event.id,
        OutboxStatus.SENDING,
        (event.attempts || 0) + 1
      );

      // Publish to Kafka
      await publishEvent(
        event.topic,
        event.payload,
        event.key || undefined,
        event.id // Use event ID as dedupe ID
      );

      // Mark as SENT
      await this.outboxRepository.markEventAsSent(event.id);

      logger.info(`Outbox event processed successfully`, {
        eventId: event.id,
        topic: event.topic,
        aggregateType: event.aggregateType,
      });
    } catch (error: any) {
      logger.error(`Error processing outbox event`, {
        eventId: event.id,
        topic: event.topic,
        error: error.message,
      });

      // Mark as FAILED after max attempts
      const attempts = (event.attempts || 0) + 1;
      if (attempts >= 3) {
        await this.outboxRepository.markEventAsFailed(event.id, attempts);
        logger.error(`Outbox event marked as failed after ${attempts} attempts`, {
          eventId: event.id,
          topic: event.topic,
        });
      } else {
        // Reset to PENDING for retry
        await this.outboxRepository.updateEventStatus(
          event.id,
          OutboxStatus.PENDING,
          attempts
        );
      }
    }
  }

  /**
   * Manually trigger processing (useful for testing or immediate processing)
   */
  async triggerProcessing(): Promise<void> {
    await this.processPendingEvents();
  }
}