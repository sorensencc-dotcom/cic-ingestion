/**
 * Phase 27: Aperture — Validation Utilities
 * Shared security validators for all adapters
 */
const DANGEROUS_COMMANDS = [
    'rm', 'rm -rf', 'dd', 'mkfs', 'format', 'shred', 'wipe',
    'mv', 'cp', 'chmod', 'chown', 'deluser', 'userdel',
    'shutdown', 'reboot', 'halt', 'poweroff'
];
const ALLOWED_DOMAINS_DEFAULT = [
    'github.com',
    'api.github.com',
    'raw.githubusercontent.com',
    'jsonplaceholder.typicode.com'
];
const FORBIDDEN_HEADERS = [
    'authorization',
    'x-api-key',
    'x-secret',
    'cookie'
];
export class ValidationUtils {
    /**
     * Validate shell command against dangerous operations safelist
     */
    static validateCommand(command, allowlist) {
        const list = allowlist || DANGEROUS_COMMANDS;
        const normalized = command.toLowerCase().trim();
        for (const dangerous of list) {
            if (normalized.startsWith(dangerous)) {
                return {
                    valid: false,
                    error: `Command '${command}' is not allowed (dangerous operation)`
                };
            }
        }
        return { valid: true };
    }
    /**
     * Validate file path is within sandbox (prevent directory traversal)
     */
    static validatePathTraversal(userPath, sandboxDir) {
        const path = require('path');
        // Resolve paths to absolute
        const safePath = path.resolve(sandboxDir, userPath);
        const sandboxAbs = path.resolve(sandboxDir);
        // Check if resolved path is within sandbox
        if (!safePath.startsWith(sandboxAbs)) {
            return {
                valid: false,
                error: `Path traversal detected: ${userPath} escapes sandbox`
            };
        }
        // Prevent symlink escape
        if (userPath.includes('..')) {
            return {
                valid: false,
                error: `Path contains '..': ${userPath}`
            };
        }
        return { valid: true };
    }
    /**
     * Validate URL against allowed domains
     */
    static validateUrl(url, allowedDomains) {
        try {
            const urlObj = new URL(url);
            // Only allow http/https
            if (!['http:', 'https:'].includes(urlObj.protocol)) {
                return {
                    valid: false,
                    error: `Only http/https allowed, got: ${urlObj.protocol}`
                };
            }
            const domains = allowedDomains || ALLOWED_DOMAINS_DEFAULT;
            const hostname = urlObj.hostname.toLowerCase();
            // Check if domain is in allowlist
            const allowed = domains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
            if (!allowed) {
                return {
                    valid: false,
                    error: `Domain '${hostname}' not in allowlist`
                };
            }
            return { valid: true };
        }
        catch (err) {
            return {
                valid: false,
                error: `Invalid URL: ${err.message}`
            };
        }
    }
    /**
     * Validate HTTP headers (filter sensitive headers)
     */
    static validateHeaders(headers) {
        const filtered = {};
        const removed = [];
        for (const [key, value] of Object.entries(headers)) {
            const lowerKey = key.toLowerCase();
            // Block sensitive headers
            if (FORBIDDEN_HEADERS.includes(lowerKey)) {
                removed.push(key);
                continue;
            }
            // Only allow string/number headers
            if (typeof value === 'string' || typeof value === 'number') {
                filtered[key] = String(value);
            }
        }
        return {
            valid: removed.length === 0,
            filtered,
            removed: removed.length > 0 ? removed : undefined
        };
    }
    /**
     * Validate HTTP body size
     */
    static validateBodySize(body, maxBytes = 10 * 1024 * 1024) {
        const size = Buffer.byteLength(body);
        if (size > maxBytes) {
            return {
                valid: false,
                error: `Body too large: ${size} bytes (max ${maxBytes})`,
                size
            };
        }
        return { valid: true, size };
    }
}
//# sourceMappingURL=ValidationUtils.js.map