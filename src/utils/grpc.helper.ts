import * as grpc from "@grpc/grpc-js";
import { CustomError } from "./error.util";
import logger from "./logger.util";
import { HttpStatus } from "../constands/http.status";

/**
 * Maps HTTP status codes to gRPC status codes.
 */
const mapHttpToGrpcStatus = (httpStatus: number): grpc.status => {
  switch (httpStatus) {
    case HttpStatus.BAD_REQUEST:
      return grpc.status.INVALID_ARGUMENT;
    case HttpStatus.UNAUTHORIZED:
      return grpc.status.UNAUTHENTICATED;
    case HttpStatus.FORBIDDEN:
      return grpc.status.PERMISSION_DENIED;
    case HttpStatus.NOT_FOUND:
      return grpc.status.NOT_FOUND;
    case HttpStatus.CONFLICT:
      return grpc.status.ALREADY_EXISTS;
    case HttpStatus.INTERNAL_SERVER_ERROR:
      return grpc.status.INTERNAL;
    default:
      // If it's already a small number, it might be a gRPC code already
      // However, we should be careful. 
      if (httpStatus < 20) return httpStatus as grpc.status;
      return grpc.status.INTERNAL;
  }
};

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

      const code = err instanceof CustomError 
        ? mapHttpToGrpcStatus(err.status) 
        : grpc.status.INTERNAL;

      callback(
        {
          code,
          message: err.message || "Internal server error",
        },
        null
      );
    }
  };
