import * as grpc from "@grpc/grpc-js";
import logger from "./logger.util";

export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  jitter?: boolean;
  retryableErrors?: grpc.status[];
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, "retryableErrors">> & { retryableErrors: grpc.status[] } = {
  maxAttempts: 3,
  baseDelay: 200, // milliseconds
  maxDelay: 2000, // milliseconds
  jitter: true,
  retryableErrors: [
    grpc.status.UNAVAILABLE,
    grpc.status.DEADLINE_EXCEEDED,
    grpc.status.RESOURCE_EXHAUSTED,
    grpc.status.ABORTED,
    grpc.status.INTERNAL,
  ],
};

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(attempt: number, baseDelay: number, maxDelay: number, jitter: boolean): number {
  const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  if (jitter) {
    // Add random jitter: ±25% of the delay
    const jitterAmount = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
    return Math.max(0, exponentialDelay + jitterAmount);
  }
  return exponentialDelay;
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: grpc.ServiceError, retryableErrors: grpc.status[]): boolean {
  return retryableErrors.includes(error.code);
}

/**
 * gRPC call with retry logic, exponential backoff, and jitter
 * Production-ready retry mechanism following microservices best practices
 */
export async function grpcWithRetry<
  Client,
  RequestType,
  ResponseType
>(
  client: Client,
  method: keyof Client,
  requestData: RequestType,
  metadata?: grpc.Metadata,
  options: RetryOptions = {}
): Promise<ResponseType> {
  const config = {
    maxAttempts: options.maxAttempts ?? DEFAULT_OPTIONS.maxAttempts,
    baseDelay: options.baseDelay ?? DEFAULT_OPTIONS.baseDelay,
    maxDelay: options.maxDelay ?? DEFAULT_OPTIONS.maxDelay,
    jitter: options.jitter ?? DEFAULT_OPTIONS.jitter,
    retryableErrors: options.retryableErrors ?? DEFAULT_OPTIONS.retryableErrors,
  };

  let lastError: grpc.ServiceError | null = null;

  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    try {
      return await new Promise<ResponseType>((resolve, reject) => {
        const cb = (err: grpc.ServiceError | null, res: ResponseType) => {
          if (err) {
            return reject(err);
          }
          resolve(res);
        };

        try {
          if (metadata) {
            (client[method] as Function).call(client, requestData, metadata, cb);
          } else {
            (client[method] as Function).call(client, requestData, cb);
          }
        } catch (err) {
          try {
            const md = metadata ?? new grpc.Metadata();
            (client[method] as Function).call(client, requestData, md, cb);
          } catch (finalErr: any) {
            reject(finalErr);
          }
        }
      });
    } catch (error: any) {
      lastError = error;

      // Check if error is retryable
      if (!isRetryableError(error, config.retryableErrors)) {
        logger.warn(`gRPC call to ${String(method)} failed with non-retryable error`, {
          error: error.message,
          code: error.code,
          attempt: attempt + 1,
        });
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === config.maxAttempts - 1) {
        logger.error(`gRPC call to ${String(method)} failed after ${config.maxAttempts} attempts`, {
          error: error.message,
          code: error.code,
          attempts: config.maxAttempts,
        });
        throw error;
      }

      // Calculate delay and wait before retry
      const delay = calculateDelay(attempt, config.baseDelay, config.maxDelay, config.jitter);
      logger.warn(`gRPC call to ${String(method)} failed, retrying...`, {
        error: error.message,
        code: error.code,
        attempt: attempt + 1,
        maxAttempts: config.maxAttempts,
        delayMs: Math.round(delay),
      });

      await sleep(Math.round(delay));
    }
  }

  // This should never be reached, but TypeScript needs it
  if (lastError) {
    throw lastError;
  }

  throw new Error(`gRPC call to ${String(method)} failed unexpectedly`);
}

