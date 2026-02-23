import { Request } from "express";
import { CustomError } from "./error.util";
import { HttpStatus } from "../constands/http.status";
import { Messages } from "../constands/reqresMessages";
import logger from "./logger.util";

/**
 * Extracts the user ID from the 'x-user-data' header.
 * This header is expected to be set by an upstream service (e.g., API Gateway)
 * after JWT validation.
 *
 * @param req - The Express Request object.
 * @returns The user ID string.
 * @throws {CustomError} if the header is missing or malformed, or if the ID is not present.
 */
export const getUserIdFromRequest = (req: Request): string => {
  const userDataHeader = req.headers["x-user-data"];

  if (!userDataHeader || typeof userDataHeader !== "string") {
    logger.warn("Attempted access without x-user-data header", {
      url: req.originalUrl,
      method: req.method,
    });
    throw new CustomError(HttpStatus.UNAUTHORIZED, Messages.NO_ACCESS);
  }

  try {
    const userData = JSON.parse(userDataHeader);
    if (!userData || !userData.id) {
       throw new Error("User ID missing in user data");
    }
    return userData.id;
  } catch (error) {
    logger.error("Failed to parse x-user-data header", {
      error: (error as Error).message,
      header: userDataHeader,
    });
    throw new CustomError(HttpStatus.UNAUTHORIZED, "Invalid user data provided");
  }
};