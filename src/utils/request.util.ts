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
    logger.warn("Attempted access without x-user-data header");
    throw new CustomError(HttpStatus.UNAUTHORIZED, Messages.NO_ACCESS);
  }

  return JSON.parse(userDataHeader).id;
};