#!/usr/bin/env node

/**
 * Shared utilities for pre-commit scripts
 * Avoids duplication between code-review.js and generate-docs.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Get all staged files matching pattern
 * @param {string[]} extensions - File extensions to include (e.g., ['.ts', '.js'])
 * @param {string[]} excludePatterns - Patterns to exclude (e.g., ['__tests__', '.spec.'])
 * @returns {string[]} Array of staged file paths
 */
function getStagedFiles(extensions = ['.ts'], excludePatterns = ['__tests__', '.spec.', '.test.']) {
  try {
    const output = execSync('git diff --cached --name-only', { encoding: 'utf-8' });
    return output
      .split('\n')
      .filter(f => {
        if (!f) return false;
        const hasExtension = extensions.some(ext => f.endsWith(ext));
        const isExcluded = excludePatterns.some(pattern => f.includes(pattern));
        return hasExtension && !isExcluded;
      });
  } catch (e) {
    return [];
  }
}

/**
 * Find the service root for a given file path
 * @param {string} filePath - The file path to find service root for
 * @returns {string|null} Service root directory or null if not found
 */
function findServiceRoot(filePath) {
  const parts = filePath.split('/');
  const servicesIdx = parts.indexOf('services');

  if (servicesIdx !== -1 && servicesIdx + 1 < parts.length) {
    return parts.slice(0, servicesIdx + 2).join('/');
  }

  return null;
}

/**
 * Find tsconfig.json by walking up directory tree
 * @param {string} dir - Directory to start from
 * @returns {string|null} Path to tsconfig.json or null
 */
function findTsConfig(dir) {
  let current = dir;
  while (current !== '/') {
    const tsconfigPath = path.join(current, 'tsconfig.json');
    if (fs.existsSync(tsconfigPath)) {
      return tsconfigPath;
    }
    current = path.dirname(current);
  }
  return null;
}

module.exports = {
  getStagedFiles,
  findServiceRoot,
  findTsConfig,
};
