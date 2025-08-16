import compression from "compression";
import dotenv from "dotenv";
import express, { Express, NextFunction, Request, Response } from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import logger from "./utils/logger.util";
import { CustomError, sendErrorResponse } from "./utils/error.util";
import { app, startServer } from "./utils/server.start.util";
import path from "path"

dotenv.config();

app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// app.use((req: Request, res: Response, next: NextFunction) => {
//   logger.info(`${req.method} ${req.url}`);
//   next();
// });

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "Post service is running" });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  sendErrorResponse(
    res,
    err instanceof CustomError
      ? err
      : { status: 500, message: "Internal server error" }
  );
});

startServer();
