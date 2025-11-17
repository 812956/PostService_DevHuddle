import { IdempotencyKey, IdempotencyStatus, Prisma } from ".prisma/client";

export interface IIdempotencyRepository {
  createIdempotencyKey(data: {
    key: string;
    userId: string;
    method: string;
    route: string;
    requestHash?: string;
  }): Promise<IdempotencyKey>;
  findIdempotencyKey(key: string): Promise<IdempotencyKey | null>;
  updateIdempotencyKey(
    key: string,
    data: {
      status: IdempotencyStatus;
      response?: any;
      requestHash?: string;
    }
  ): Promise<IdempotencyKey>;
  deleteIdempotencyKey(key: string): Promise<void>;
}