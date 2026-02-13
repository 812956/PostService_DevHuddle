import * as grpc from "@grpc/grpc-js";
import logger from "../utils/logger.util";
import { createCircuitBreaker } from "./circuit.breaker.util";
import CircuitBreaker from "opossum";

// Cache to store circuit breakers for each method (ClientName.methodName -> breaker)
const breakerCache = new Map<string, CircuitBreaker<any, any>>();

/**
 * Generic promise wrapper for callback-style gRPC client methods with Circuit Breaker support.
 * Supports optional metadata parameter or (req, cb) signatures.
 */
export const grpcs = async <
  Client,
  RequestType,
  ResponseType
>(
  client: Client,
  method: keyof Client,
  requestData: RequestType,
  metadata?: grpc.Metadata
): Promise<ResponseType> => {
  // 1. Generate unique key for this method (e.g., "UserServiceClient.getUser")
  const clientName = (client as any).constructor?.name || "UnknownClient";
  const methodName = String(method);
  const breakerKey = `${clientName}.${methodName}`;

  // 2. Get or create circuit breaker
  let breaker = breakerCache.get(breakerKey);
  if (!breaker) {
    // Define the async action to be wrapped
    const action = async (req: RequestType, meta?: grpc.Metadata): Promise<ResponseType> => {
      return new Promise((resolve, reject) => {
        const cb = (err: grpc.ServiceError | null, res: ResponseType) => {
          if (err) {
            // Logger in circuit breaker (./circuit.breaker.util.ts) will handle logging
            return reject(err);
          }
          resolve(res);
        };

        try {
          if (meta) {
            (client[method] as Function).call(client, req, meta, cb);
          } else {
            // try the simple (req, cb) signature first
            (client[method] as Function).call(client, req, cb);
          }
        } catch (err) {
          // fallback: try with metadata param if not tried yet
          try {
            const md = meta ?? new grpc.Metadata();
            (client[method] as Function).call(client, req, md, cb);
          } catch (finalErr: any) {
            reject(finalErr);
          }
        }
      });
    };

    breaker = createCircuitBreaker(action, breakerKey, {
      timeout: 5000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000
    });
    
    breakerCache.set(breakerKey, breaker);
  }

  // 3. Fire the request through the breaker
  try {
    return await breaker.fire(requestData, metadata);
  } catch (err) {
    // Re-throw so the caller (service) can handle it (e.g. return fallback data)
    throw err;
  }
};