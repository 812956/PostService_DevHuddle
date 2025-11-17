import { Request, Response, NextFunction } from "express";
import { CustomError } from "../utils/error.util";
import logger from "../utils/logger.util";
import redisClient from "../config/redis.config";

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyGenerator?: (req: Request) => string; // Custom key generator
  skipSuccessfulRequests?: boolean; // Don't count successful requests
}

export const rateLimitMiddleware = (options: RateLimitOptions) => {
  const {
    windowMs,
    maxRequests,
    keyGenerator = (req: Request) => {
      const userId = (req as any).user?.userId || (req as any).user?.id;
      const ip = req.ip || req.socket.remoteAddress || "unknown";
      return userId ? `rate-limit:user:${userId}` : `rate-limit:ip:${ip}`;
    },
    skipSuccessfulRequests = false,
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = keyGenerator(req);
      const now = Date.now();
      const windowStart = now - windowMs;

      // Get current count
      const count = await redisClient.get(key);
      const currentCount = count ? parseInt(count, 10) : 0;

      if (currentCount >= maxRequests) {
        const ttl = await redisClient.ttl(key);
        throw new CustomError(
          429,
          `Too many requests. Please try again in ${Math.ceil(ttl / 1000)} seconds.`
        );
      }

      // Increment counter
      const multi = redisClient.multi();
      multi.incr(key);
      multi.expire(key, Math.ceil(windowMs / 1000));
      await multi.exec();

      // Store original res.json to track success
      if (skipSuccessfulRequests) {
        const originalJson = res.json.bind(res);
        res.json = function (body: any) {
          if (res.statusCode < 400) {
            // Decrement on success
            redisClient.decr(key).catch((err) => {
              logger.error("Error decrementing rate limit counter", {
                error: err.message,
              });
            });
          }
          return originalJson(body);
        };
      }

      next();
    } catch (error: any) {
      if (error instanceof CustomError) {
        return next(error);
      }

      logger.error("Error in rate limit middleware", {
        error: error.message,
      });

      // On error, allow request to proceed (fail open)
      next();
    }
  };
};

// Pre-configured rate limiters
export const createRateLimiters = () => {
  return {
    // Strict rate limiter for write operations
    strict: rateLimitMiddleware({
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10, // 10 requests per minute
    }),

    // Moderate rate limiter for read operations
    moderate: rateLimitMiddleware({
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 60, // 60 requests per minute
    }),

    // Lenient rate limiter for general endpoints
    lenient: rateLimitMiddleware({
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100, // 100 requests per minute
    }),
  };
};