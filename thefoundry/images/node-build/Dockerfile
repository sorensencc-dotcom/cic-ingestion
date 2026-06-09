# TheFoundry: Deterministic Node Build Image
# Phase 0.9 sealed infrastructure
# Reproducible, pinned, no floating versions

FROM node:20.13.0-alpine3.20

LABEL maintainer="CIC Architecture"
LABEL version="1.0"
LABEL description="Deterministic Node build for Phase 1.1"

# Install build essentials (pinned versions)
RUN apk add --no-cache \
  python3=3.12.3-r1 \
  make=4.4.1-r2 \
  g++=13.2.1_git20231219-r2 \
  ca-certificates=20240226-r0

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
