import { Request, Response, NextFunction } from "express";
import { CustomError } from "../utils/error.util";
import logger from "../utils/logger.util";

/**
 * Middleware to check if user is superAdmin
 * Extracts user data from x-user-data header set by API Gateway
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const userDataHeader = req.headers["x-user-data"];

    if (!userDataHeader || typeof userDataHeader !== "string") {
      logger.warn("Admin route accessed without x-user-data header");
      throw new CustomError(401, "Unauthorized");
    }

    const userData = JSON.parse(userDataHeader);

    if (!userData.id) {
      throw new CustomError(401, "User ID not found");
    }

    if (userData.role !== "superAdmin") {
      logger.warn(`Access denied: User ${userData.id} with role ${userData.role} attempted admin access`);
      throw new CustomError(403, "Access denied: Admin privileges required");
    }

    // Attach user to request for use in controllers
    (req as any).user = userData;

    next();
  } catch (error: any) {
    if (error instanceof CustomError) {
      return next(error);
    }
    logger.error("Error in requireAdmin middleware", { error: error.message });
    next(new CustomError(500, "Authentication error"));
  }
};

