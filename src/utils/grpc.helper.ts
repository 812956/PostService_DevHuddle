import * as grpc from "@grpc/grpc-js";
import { CustomError } from "./error.util";
import logger from "./logger.util";

/**
 * A higher-order function to wrap gRPC service methods.
 * It handles the common try-catch block for error handling and sending responses.
 * @param handler The controller method to be executed.
 * @returns A gRPC unary call handler.
 */
export const grpcHandler =
  <TRequest, TResponse>(
    handler: (request: TRequest) => Promise<TResponse>
  ): grpc.handleUnaryCall<TRequest, TResponse> =>
  async (
    call: grpc.ServerUnaryCall<TRequest, TResponse>,
    callback: grpc.sendUnaryData<TResponse>
  ) => {
    try {
      const response = await handler(call.request);
      callback(null, response);
    } catch (err: any) {
      logger.error("gRPC handler error", {
        error: err.message,
        request: call.request,
      });
      callback(
        {
          code: err instanceof CustomError ? err.status : grpc.status.INTERNAL,
          message: err.message || "Internal server error",
        },
        null
      );
    }
  };
