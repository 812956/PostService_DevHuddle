import logger from "./logger.util";
import express, { Express } from "express";
import { grpcServer } from "../grpc-server";
import { connectRedis } from "../config/redis.config";
import { disconnectAdmin, disconnectProducer, initializeKafkaTopics } from "./kafka.util";

export const app: Express = express();

export const startServer = async () => {
  try {
    logger.info("Prisma connection established");

    await connectRedis();
    logger.info("Redis connection established");

    await initializeKafkaTopics();
    logger.info("Kafka topics initialized");

    const PORT = process.env.PORT || 3002;
    app.listen(PORT, () => {
      logger.info(`Post Service running on port ${PORT}`);
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

// Graceful shutdown
const gracefulShutdown = async () => {
  logger.info("Shutting down gracefully...");
  
  // Disconnect Kafka clients
  await disconnectProducer();
  await disconnectAdmin();
  logger.info("Kafka clients disconnected");

};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);