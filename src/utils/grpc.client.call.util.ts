import * as grpc from "@grpc/grpc-js";
import logger from "../utils/logger.util";

/**
 * Generic promise wrapper for callback-style gRPC client methods.
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
  return new Promise((resolve, reject) => {
    const cb = (err: grpc.ServiceError | null, res: ResponseType) => {
      if (err) {
        logger.error(`gRPC call to ${String(method)} failed`, { error: err.message, stack: err.stack });
        return reject(err);
      }
      resolve(res);
    };

    try {
      if (metadata) {
        (client[method] as Function).call(client, requestData, metadata, cb);
      } else {
        // try the simple (req, cb) signature first
        (client[method] as Function).call(client, requestData, cb);
      }
    } catch (err) {
      // fallback: try with metadata param if not tried yet
      try {
        const md = metadata ?? new grpc.Metadata();
        (client[method] as Function).call(client, requestData, md, cb);
      } catch (finalErr: any) {
        logger.error(`gRPC call to ${String(method)} threw`, { error: finalErr?.message });
        reject(finalErr);
      }
    }
  });
};