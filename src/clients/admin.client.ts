import * as grpc from "@grpc/grpc-js";
import { AdminServiceClient as AdminClient } from "../grpc/generated/admin";
import { grpcs } from "../utils/grpc.client.call.util";
import logger from "../utils/logger.util";

class AdminServiceClient {
  private _client: AdminClient;

  constructor() {
    const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_GRPC_URL || "localhost:50051";
    this._client = new AdminClient(
      AUTH_SERVICE_URL,
      grpc.credentials.createInsecure()
    );
    logger.info("AdminServiceClient initialized", { url: AUTH_SERVICE_URL });
  }

  async submitReport(req: {
    reporterId: string;
    targetId: string;
    targetType: string;
    reason: string;
    description: string;
    metadata: string;
  }) {
    try {
      // grpcs util already uses circuit breaker internally
      return await grpcs(this._client, "submitReport", req);
    } catch (err: any) {
      logger.error("AdminServiceClient.submitReport error", { error: err.message });
      throw err;
    }
  }

  async getUserStatus(userId: string) {
    try {
      return await grpcs(this._client, "getUserStatus", { userId });
    } catch (err: any) {
      logger.error("AdminServiceClient.getUserStatus error", { error: err.message });
      throw err;
    }
  }
}

export const adminServiceClient = new AdminServiceClient();
