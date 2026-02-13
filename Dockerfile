FROM node:20-alpine3.18

# Install protoc for ts-proto
RUN apk add --no-cache protoc protobuf-dev

WORKDIR /app

# Copy package files first (for better layer caching)
COPY prisma ./prisma
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies and clean npm cache in one layer
RUN npm install && \
    npm cache clean --force && \
    rm -rf /tmp/*

# Copy protos (needed for gRPC generation at runtime)
COPY protos ./protos

# Create necessary directories
RUN mkdir -p logs

# Generate Prisma client (this is needed in the image)
RUN npx prisma generate

# Note: src is mounted as volume in docker-compose, so we don't copy it here
# This significantly reduces image size

EXPOSE 3002
EXPOSE 50051
