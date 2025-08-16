import path from "path";
import { execSync } from "child_process";
import fs from "fs";

// Paths
const PROTO_DIR = path.resolve(__dirname,"../","./protos");
const OUT_DIR = path.resolve(__dirname, "grpc", "generated");
const PROTO_FILE = path.resolve(PROTO_DIR, "post.proto");

// Ensure output directory exists
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

try {
  const command = [
    "protoc",
    `--plugin=protoc-gen-ts_proto=${path.resolve("node_modules", ".bin", "protoc-gen-ts_proto")}`,
    `--ts_proto_out=${OUT_DIR}`,
    `--ts_proto_opt=outputServices=grpc-js,esModuleInterop=true`,
    `--proto_path=${PROTO_DIR}`,
    PROTO_FILE,
  ].join(" ");

  execSync(command, { stdio: "inherit" });
  console.log("✅ gRPC code generated using ts-proto");
} catch (err) {
  console.error("❌ Failed to generate gRPC code:", err);
  process.exit(1);
}
