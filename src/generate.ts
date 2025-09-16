

import path from "path";
import { execSync } from "child_process";
import fs from "fs";

const protoPath = [];
protoPath.push(
  path.resolve(__dirname, "../", "protos", "user.proto"),
  path.resolve(__dirname,"../", "protos", "post.proto")
)
const outDir = path.resolve(__dirname, "grpc", "generated");

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

for(let eachPathProtoFile of protoPath) {
  try {
  const command = [
    "protoc",
    `--plugin=protoc-gen-ts_proto=${path.resolve("node_modules", ".bin", "protoc-gen-ts_proto")}`,
    `--ts_proto_out=${outDir}`,
    `--ts_proto_opt=outputServices=grpc-js,esModuleInterop=true`,
    `--proto_path=${path.dirname(eachPathProtoFile)}`,
    eachPathProtoFile
  ].join(" ");

  execSync(command, { stdio: "inherit" });
  console.log("✅ gRPC code generated using ts-proto (Post Service)");
} catch (error) {
  console.error("❌ Failed to generate gRPC code:", error);
  process.exit(1);
}

}