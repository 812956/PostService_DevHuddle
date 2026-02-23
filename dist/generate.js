"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const protoPath = [];
protoPath.push(path_1.default.resolve(__dirname, "../", "protos", "user.proto"), path_1.default.resolve(__dirname, "../", "protos", "post.proto"));
const outDir = path_1.default.resolve(__dirname, "grpc", "generated");
if (!fs_1.default.existsSync(outDir)) {
    fs_1.default.mkdirSync(outDir, { recursive: true });
}
for (let eachPathProtoFile of protoPath) {
    try {
        const command = [
            "protoc",
            `--plugin=protoc-gen-ts_proto=${path_1.default.resolve("node_modules", ".bin", "protoc-gen-ts_proto")}`,
            `--ts_proto_out=${outDir}`,
            `--ts_proto_opt=outputServices=grpc-js,esModuleInterop=true`,
            `--proto_path=${path_1.default.dirname(eachPathProtoFile)}`,
            eachPathProtoFile
        ].join(" ");
        (0, child_process_1.execSync)(command, { stdio: "inherit" });
        console.log("✅ gRPC code generated using ts-proto (Post Service)");
    }
    catch (error) {
        console.error("❌ Failed to generate gRPC code:", error);
        process.exit(1);
    }
}
