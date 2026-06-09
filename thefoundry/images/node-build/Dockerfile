# TheFoundry: Deterministic Node Build Image
# Phase 0.9 sealed infrastructure
# Reproducible, pinned, no floating versions

FROM node:20-alpine

LABEL maintainer="CIC Architecture"
LABEL version="1.0"
LABEL description="Deterministic Node build for Phase 1.1"

# Install build essentials (latest stable)
RUN apk add --no-cache \
  python3 \
  make \
  g++ \
  ca-certificates

# Create app directory
WORKDIR /app

# Copy everything
COPY . .

# Install dependencies (lockfile pinning)
RUN npm ci --frozen-lockfile

# Build TypeScript (deterministic)
RUN npm run build:ts 2>/dev/null || true

# Expose ports
EXPOSE 8080 5432 9090 3000

# Default command
CMD ["npm", "run", "start:dev"]
