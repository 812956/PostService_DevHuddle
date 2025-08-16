"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
// Paths
const PROTO_DIR = path_1.default.resolve(__dirname, "../", "./protos");
const OUT_DIR = path_1.default.resolve(__dirname, "grpc", "generated");
const PROTO_FILE = path_1.default.resolve(PROTO_DIR, "post.proto");
// Ensure output directory exists
if (!fs_1.default.existsSync(OUT_DIR)) {
    fs_1.default.mkdirSync(OUT_DIR, { recursive: true });
}
try {
    const command = [
        "protoc",
        `--plugin=protoc-gen-ts_proto=${path_1.default.resolve("node_modules", ".bin", "protoc-gen-ts_proto")}`,
        `--ts_proto_out=${OUT_DIR}`,
        `--ts_proto_opt=outputServices=grpc-js,esModuleInterop=true`,
        `--proto_path=${PROTO_DIR}`,
        PROTO_FILE,
    ].join(" ");
    (0, child_process_1.execSync)(command, { stdio: "inherit" });
    console.log("✅ gRPC code generated using ts-proto");
}
catch (err) {
    console.error("❌ Failed to generate gRPC code:", err);
    process.exit(1);
}
