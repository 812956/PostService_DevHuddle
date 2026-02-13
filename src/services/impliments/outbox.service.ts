import { IOutboxService } from "../interfaces/IOutboxService";
import { IOutboxRepository } from "../../repositories/interface/IOutboxRepository";
import { OutboxAggregateType, OutboxEventType } from "@prisma/client";
import logger from "../../utils/logger.util";

export class OutboxService implements IOutboxService {
  constructor(private _outboxRepository: IOutboxRepository) {}

  async createOutboxEvent(data: {
    aggregateType: string;
    aggregateId?: string;
    type: string;
    topic: string;
    key?: string;
    payload: any;
  }): Promise<void> {
    try {
      // Convert string types to enum types for Prisma
      // If type is not in enum, it will be stored as string (Prisma allows this for flexible schemas)
      const aggregateTypeEnum = data.aggregateType as OutboxAggregateType;
      const typeEnum = data.type as OutboxEventType;
      
      await this._outboxRepository.createOutboxEvent({
        aggregateType: aggregateTypeEnum,
        aggregateId: data.aggregateId,
        type: typeEnum, // Cast to enum - Prisma will handle if it's not in enum
        topic: data.topic,
        key: data.key,
        payload: data.payload,
      });

      logger.info("Outbox event created", {
        aggregateType: data.aggregateType,
        aggregateId: data.aggregateId,
        type: data.type,
        topic: data.topic,
      });
    } catch (error: any) {
      logger.error("Error creating outbox event", {
        error: error.message,
        stack: error.stack,
        data,
      });
      throw error;
    }
  }
}


