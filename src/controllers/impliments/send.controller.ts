import { Request, Response, NextFunction } from "express";
import { ISendService } from "../../services/interfaces/ISendService";
import { CustomError } from "../../utils/error.util";
import { HttpStatus } from "../../constands/http.status";
import { getUserIdFromRequest } from "../../utils/request.util";
import logger from "../../utils/logger.util";

export class SendController {
  constructor(private _sendService: ISendService) {}

  /**
   * Get user connections (people the user follows)
   * Used for Send Post modal
   * Proxies to auth-service to get the user's following list
   */
  async getConnections(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = getUserIdFromRequest(req);
      const userDataHeader = req.headers["x-user-data"];
      const authToken = req.headers.authorization;

      if (!userId) {
        throw new CustomError(HttpStatus.UNAUTHORIZED, "Unauthorized");
      }

      // Call auth-service to get current user's following list
      // Use the new /me/following endpoint which uses the current user from JWT
      // Note: Auth-service routes are mounted at /users (without /api/v1 prefix)
      // because API Gateway removes /api/v1 before forwarding
      const authServiceUrl = process.env.AUTH_SERVICE_URL || "http://auth-service:3001";
      const followingUrl = `${authServiceUrl}/users/me/following`;

      try {
        const headers: Record<string, string> = {};
        if (authToken) headers["Authorization"] = authToken as string;
        if (userDataHeader) headers["x-user-data"] = userDataHeader as string;

        logger.info("Fetching connections from auth-service", {
          url: followingUrl,
          userId,
        });

        const response = await fetch(followingUrl, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(10000), // Increased timeout
        });

        if (!response.ok) {
          const errorText = await response.text();
          logger.error("Auth service error response", {
            status: response.status,
            statusText: response.statusText,
            body: errorText,
          });
          throw new Error(`Auth service returned ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        
        logger.info("Received connections from auth-service", {
          count: Array.isArray(data) ? data.length : 0,
        });

        // Transform the response to match Connection interface
        // Auth service returns array of user objects directly
        const users = Array.isArray(data) ? data : [];
        
        const connections = users.map((user: any) => {
          // Build headline from jobTitle and company
          let headline: string | null = null;
          if (user.jobTitle || user.company) {
            const parts = [];
            if (user.jobTitle) parts.push(user.jobTitle);
            if (user.company) parts.push(`at ${user.company}`);
            headline = parts.join(" ");
          }

          return {
            id: user.id,
            name: user.name || "Unknown User",
            username: user.username || "",
            profilePicture: user.profilePicture || null,
            jobTitle: user.jobTitle || null,
            company: user.company || null,
            headline: headline,
          };
        });

        res.status(HttpStatus.OK).json({
          success: true,
          data: connections,
        });
      } catch (error: any) {
        logger.error("Failed to fetch connections from auth-service", {
          error: error.message,
          url: followingUrl,
        });
        // Return empty array on error (graceful degradation)
        res.status(HttpStatus.OK).json({
          success: true,
          data: [],
        });
      }
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Send a post to selected connections
   */
  async sendPost(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { postId } = req.params;
      const userId = getUserIdFromRequest(req);
      const { recipientIds, message } = req.body;

      if (!userId) {
        throw new CustomError(HttpStatus.UNAUTHORIZED, "Unauthorized");
      }

      if (!postId) {
        throw new CustomError(HttpStatus.BAD_REQUEST, "Post ID is required");
      }

      // Validation handled by DTO

      const result = await this._sendService.sendPost(
        postId as string,
        userId,
        recipientIds,
        message
      );

      res.status(HttpStatus.OK).json({
        success: true,
        message: `Post sent to ${result.sentTo.length} ${result.sentTo.length === 1 ? "connection" : "connections"}`,
        data: result,
      });
    } catch (error: any) {
      next(error);
    }
  }
}

