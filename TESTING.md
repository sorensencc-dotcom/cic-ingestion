# Testing Guide

## Quick Start

### Docker (Recommended—Full Test Suite)
```bash
docker run --rm -v "${PWD}:/app" -w /app node:20-alpine \
  sh -c "apk add --no-cache python3 make g++ && \
         npm install && \
         npm rebuild better-sqlite3 && \
         npm test"
```

All 13/13 tests pass with Docker.

### Windows Development
```bash
npm install
npm test  # Memory registry tests only (11/11 pass)
```

SQLiteRegistry tests require Windows native binaries. Build via Docker or install Python + build tools on Windows.

## Test Configuration

- **Approval System:** Single batch request at test start (no per-call prompts)
- **Test Setup:** `scripts/test-setup.js` outputs approval signal
- **Memory Registry:** All 11 tests pass on Windows
- **SQLiteRegistry:** Requires native C++ bindings (Alpine Linux vs Windows incompatibility)

## Building SQLiteRegistry on Windows

1. Install Python 3.12+
2. Install Visual Studio Build Tools (C++ workload)
3. Run:
   ```bash
   npm install
   npm rebuild better-sqlite3
   npm test
   ```

## CI/CD

Docker is recommended for CI pipelines. See `.github/workflows/*` for example.
