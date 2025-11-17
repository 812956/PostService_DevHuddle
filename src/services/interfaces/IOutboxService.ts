export interface IOutboxService {
  createOutboxEvent(data: {
    aggregateType: string;
    aggregateId?: string;
    type: string;
    topic: string;
    key?: string;
    payload: any;
  }): Promise<void>;
}
