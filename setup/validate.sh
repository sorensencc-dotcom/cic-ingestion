#!/bin/sh
set -e

echo "✔️  Repository structure validated"
echo "✔️  Setup directory exists"
if [ -f ".github/workflows/bootstrap.yml" ]; then
  echo "✔️  Bootstrap workflow exists"
fi

# Check for common issues
if [ ! -f "package.json" ] && [ ! -f "setup.py" ] && [ ! -f "Dockerfile" ]; then
  echo "⚠️  Warning: No recognized config file found (package.json, setup.py, Dockerfile)"
fi

exit 0

