# Phase 2.5: Autonomy API Server + Config System
# Production-ready multi-stage Node.js build

FROM node:20-alpine AS builder

WORKDIR /app

# Install build tools for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++ gcc

# Copy root deps lock files
COPY package*.json ./

# Copy cic-ingestion deps lock files
COPY cic-ingestion/package*.json ./cic-ingestion/

# Install all root deps (including devDeps for build)
RUN npm install

# Install cic-ingestion deps
RUN cd cic-ingestion && npm install

# Copy root source and config
COPY src ./src
COPY tsconfig.json ./

# Copy cic-ingestion source and tsconfig
COPY cic-ingestion/src ./cic-ingestion/src
COPY cic-ingestion/config ./cic-ingestion/config
COPY cic-ingestion/tsconfig.json ./cic-ingestion/

# Build cic-ingestion (with root scope via tsconfig rootDir: ..)
RUN cd cic-ingestion && npm run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

LABEL phase="2.5"
LABEL component="autonomy-api-server"

# Copy package files and pre-built node_modules from builder
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Copy built assets from builder (cic-ingestion build output)
COPY --from=builder /app/cic-ingestion/dist ./dist
COPY cic-ingestion/config ./config

# Health check
HEALTHCHECK --interval=10s --timeout=5s --retries=3 --start-period=10s \
  CMD node -e "require('http').get('http://localhost:3116/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1)).on('error', () => process.exit(1))"

EXPOSE 3116

# Start server
CMD ["node", "dist/src/server.js"]
