import { IOutboxService } from "../interfaces/IOutboxService";
import { IOutboxRepository } from "../../repositories/interface/IOutboxRepository";
import { OutboxAggregateType, OutboxEventType } from "@prisma/client";
import logger from "../../utils/logger.util";

export class OutboxService implements IOutboxService {
  constructor(private outboxRepository: IOutboxRepository) {}

  async createOutboxEvent(data: {
    aggregateType: OutboxAggregateType;
    aggregateId?: string;
    type: OutboxEventType;
    topic: string;
    key?: string;
    payload: any;
  }): Promise<void> {
    try {
      await this.outboxRepository.createOutboxEvent({
        aggregateType: data.aggregateType,
        aggregateId: data.aggregateId,
        type: data.type ,
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
        data,
      });
      throw error;
    }
  }
}


