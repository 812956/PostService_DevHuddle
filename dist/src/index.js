"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const compression_1 = __importDefault(require("compression"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const error_util_1 = require("./utils/error.util");
const server_start_util_1 = require("./utils/server.start.util");
dotenv_1.default.config();
server_start_util_1.app.use((0, helmet_1.default)());
server_start_util_1.app.use((0, compression_1.default)());
server_start_util_1.app.use(express_1.default.json());
server_start_util_1.app.use(express_1.default.urlencoded({ extended: true }));
server_start_util_1.app.use((0, cookie_parser_1.default)());
// app.use((req: Request, res: Response, next: NextFunction) => {
//   logger.info(`${req.method} ${req.url}`);
//   next();
// });
server_start_util_1.app.get("/health", (req, res) => {
    res.status(200).json({ status: "Post service is running" });
});
server_start_util_1.app.use((err, req, res, next) => {
    (0, error_util_1.sendErrorResponse)(res, err instanceof error_util_1.CustomError
        ? err
        : { status: 500, message: "Internal server error" });
});
(0, server_start_util_1.startServer)();
