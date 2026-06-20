# Phase 2.5: Autonomy API Server + Config System
# Production-ready multi-stage Node.js build

FROM node:20-alpine AS builder

WORKDIR /app

# Install build tools for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++ gcc

# Copy deps lock files
COPY package*.json ./
COPY tsconfig.json ./

# Install all deps (including devDeps for build)
RUN npm install

# Copy source
COPY src ./src
COPY config ./config

# Build TypeScript
RUN npm run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

LABEL phase="2.5"
LABEL component="autonomy-api-server"

# Copy package files and pre-built node_modules from builder
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Copy built assets from builder
COPY --from=builder /app/dist ./dist
COPY config ./config

# Copy data files needed at runtime
RUN mkdir -p src/vector
COPY src/vector/goldenQueries.json ./src/vector/

# Health check
HEALTHCHECK --interval=10s --timeout=5s --retries=3 --start-period=10s \
  CMD node -e "require('http').get('http://localhost:3116/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1)).on('error', () => process.exit(1))"

EXPOSE 3116

# Start server with config validation
CMD ["node", "dist/src/server.js"]
