# FROM node:20-alpine3.18

# # Install protoc for ts-proto
# # RUN apk add --no-cache protoc
# RUN apk add --no-cache protoc protobuf-dev

# WORKDIR /app

# COPY package*.json ./
# COPY prisma ./prisma
# COPY tsconfig.json ./

# RUN npm install

# # Copy source files
# COPY generate.ts ./
# COPY protos/ ./protos/
# COPY src ./src
# COPY logs ./logs

# # Generate Prisma client
# RUN npx prisma generate --no-engine

# # RUN npx ts-node generate.ts
# # Build the app
# # RUN npm run build

# # Expose port
# EXPOSE 3002

# # start app
# # CMD ["sh", "-c","npm run dev"]

FROM node:20-alpine3.18

# # Install protoc for ts-proto
RUN apk add --no-cache protoc protobuf-dev

WORKDIR /app

COPY prisma ./prisma
COPY package*.json ./
COPY tsconfig.json ./

RUN npm install

# Copy other files
COPY protos ./protos
COPY logs ./logs

# Generate Prisma client
RUN npx prisma generate

EXPOSE 3002
EXPOSE 50051
