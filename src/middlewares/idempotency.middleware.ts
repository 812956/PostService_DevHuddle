import { Request, Response, NextFunction } from "express";
import { IIdempotencyRepository } from "../repositories/interface/IIdempotencyRepository";
import { IdempotencyStatus, HttpMethod } from "@prisma/client";
import { CustomError } from "../utils/error.util";
import logger from "../utils/logger.util";
import crypto from "crypto";

export const idempotencyMiddleware = (
  idempotencyRepository: IIdempotencyRepository
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    // Only apply to POST, PUT, PATCH, DELETE methods
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      return next();
    }

    const idempotencyKey = req.headers["idempotency-key"] as string;
    const userId = (req as any).user?.userId || (req as any).user?.id;

    if (!idempotencyKey) {
      return next(); // Optional - can skip if no key provided
    }

    if (!userId) {
      throw new CustomError(401, "Unauthorized");
    }

    try {
      // Generate request hash for content validation
      const requestBody = JSON.stringify(req.body || {});
      const requestHash = crypto
        .createHash("sha256")
        .update(requestBody)
        .digest("hex");

      // Check if key exists
      const existingKey = await idempotencyRepository.findIdempotencyKey(idempotencyKey);

      if (existingKey) {
        // Key exists - check status
        if (existingKey.status === IdempotencyStatus.COMPLETED) {
          // Return cached response
          if (existingKey.response) {
            logger.info("Returning cached response for idempotency key", {
              key: idempotencyKey,
            });
            return res.status(200).json(existingKey.response);
          }
        }

        if (existingKey.status === IdempotencyStatus.IN_PROGRESS) {
          // Request is in progress - return conflict
          throw new CustomError(
            409,
            "Request is already being processed"
          );
        }

        if (existingKey.status === IdempotencyStatus.FAILED) {
          // Previous request failed - allow retry
          await idempotencyRepository.updateIdempotencyKey(idempotencyKey, {
            status: IdempotencyStatus.IN_PROGRESS,
            requestHash,
          });
          return next();
        }

        // Validate request hash matches
        if (existingKey.requestHash && existingKey.requestHash !== requestHash) {
          throw new CustomError(
            422,
            "Idempotency key already used with different request body"
          );
        }
      } else {
        // Create new idempotency key
        await idempotencyRepository.createIdempotencyKey({
          key: idempotencyKey,
          userId,
          method: req.method as HttpMethod,
          route: req.path,
          requestHash,
        });
      }

      // Store original res.json to intercept response
      const originalJson = res.json.bind(res);
      res.json = function (body: any) {
        // Update idempotency key with response
        idempotencyRepository
          .updateIdempotencyKey(idempotencyKey, {
            status: IdempotencyStatus.COMPLETED,
            response: body,
          })
          .catch((err) => {
            logger.error("Error updating idempotency key", {
              error: err.message,
              key: idempotencyKey,
            });
          });

        return originalJson(body);
      };

      next();
    } catch (error: any) {
      if (error instanceof CustomError) {
        return next(error);
      }

      logger.error("Error in idempotency middleware", {
        error: error.message,
        idempotencyKey,
      });

      // On error, mark as failed
      if (idempotencyKey) {
        idempotencyRepository
          .updateIdempotencyKey(idempotencyKey, {
            status: IdempotencyStatus.FAILED,
          })
          .catch((err) => {
            logger.error("Error marking idempotency key as failed", {
              error: err.message,
            });
          });
      }

      next(error);
    }
  };
};