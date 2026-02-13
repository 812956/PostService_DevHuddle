import { IOutboxRepository } from "../interface/IOutboxRepository";
import { BaseRepository } from "./base.repository";
import { prisma } from "../../config/prisma.config";
import {
  OutboxEvent,
  Prisma,
  OutboxStatus,
  OutboxAggregateType,
  OutboxEventType,
} from ".prisma/client";
import logger from "../../utils/logger.util";
import { v4 as uuidv4 } from "uuid";

export class OutboxRepository
  extends BaseRepository<
    typeof prisma.outboxEvent,
    OutboxEvent,
    Prisma.OutboxEventCreateInput,
    Prisma.OutboxEventUpdateInput,
    Prisma.OutboxEventWhereUniqueInput
  >
  implements IOutboxRepository
{
  constructor() {
    super(prisma.outboxEvent);
  }

  async createOutboxEvent(data: {
    aggregateType: OutboxAggregateType;
    aggregateId?: string;
    type: OutboxEventType;
    topic: string;
    key?: string;
    payload: any;
  }): Promise<OutboxEvent> {
    try {
      // Generate unique ID for the outbox event
      const eventId = uuidv4();
      
      return await super.create({
        ...data,
        id: eventId,
      });
    } catch (error: any) {
      logger.error("Error creating outbox event", { 
        error: error.message,
        stack: error.stack,
      });
      throw new Error("Failed to create outbox event");
    }
  }

  async getPendingEvents(limit?: number): Promise<OutboxEvent[]> {
    try {
      return await this.model.findMany({
        where: { status: OutboxStatus.PENDING },
        orderBy: { createdAt: "asc" },
        take: limit ?? 100,
      });
    } catch (error: any) {
      logger.error("Error getting pending events", { error: error.message });
      throw new Error("Failed to get pending events");
    }
  }

  async updateEventStatus(
    id: string,
    status: OutboxStatus,
    attempts?: number,
    publishedAt?: Date
  ): Promise<OutboxEvent> {
    try {
      return await super.update(id, {
        status,
        attempts,
        publishedAt,
        lastAttemptedAt: new Date(),
      });
    } catch (error: any) {
      logger.error("Error updating event status", { error: error.message });
      throw new Error("Failed to update event status");
    }
  }

  async markEventAsSent(id: string): Promise<OutboxEvent> {
    try {
        return await prisma.outboxEvent.update({
          where: { id },
          data: {
            status: "SENT",
            publishedAt: new Date(),
            lastAttemptedAt: new Date(),
          },
        });
      } catch (error: any) {
        logger.error("Error marking event as sent", { error: error.message });
        throw new Error("Database error");
      }
  }

  async markEventAsFailed(id: string, attempts: number): Promise<OutboxEvent> {
    try {
      return await prisma.outboxEvent.update({
        where: { id },
        data: {
          status: attempts >= 3 ? OutboxStatus.FAILED : OutboxStatus.PENDING,
          attempts,
          lastAttemptedAt: new Date(),
        },
      });
    } catch (error: any) {
      logger.error("Error marking event as failed", { error: error.message });
      throw new Error("Failed to mark event as failed");
    }
  }

}
