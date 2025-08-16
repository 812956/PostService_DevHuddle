import logger from "./logger.util";
import express,{ Express } from "express";
import { connectRedis } from "./redis.util";
import { grpcServer } from "../grpc-server";


export const app: Express = express();

export const startServer = async () => {
  try {
    logger.info("Prisma connection established");

    await connectRedis();
    logger.info("Redis connection established");
    const PORT = process.env.PORT || 3002;
    app.listen(PORT, () => {
      logger.info(`Auth Service running on port ${PORT}`);
    });
    grpcServer;
    
  } catch (err: any) {
    logger.error("Failed to start server", {
      error: err.message,
      stack: err.stack,
    });
    process.exit(1);
  }
};