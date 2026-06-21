/**
 * Phase 27: Aperture — Validation Utilities
 * Shared security validators for all adapters
 */
export declare class ValidationUtils {
    /**
     * Validate shell command against dangerous operations safelist
     */
    static validateCommand(command: string, allowlist?: string[]): {
        valid: boolean;
        error?: string;
    };
    /**
     * Validate file path is within sandbox (prevent directory traversal)
     */
    static validatePathTraversal(userPath: string, sandboxDir: string): {
        valid: boolean;
        error?: string;
    };
    /**
     * Validate URL against allowed domains
     */
    static validateUrl(url: string, allowedDomains?: string[]): {
        valid: boolean;
        error?: string;
    };
    /**
     * Validate HTTP headers (filter sensitive headers)
     */
    static validateHeaders(headers: Record<string, any>): {
        valid: boolean;
        filtered: Record<string, string>;
        removed?: string[];
    };
    /**
     * Validate HTTP body size
     */
    static validateBodySize(body: string, maxBytes?: number): {
        valid: boolean;
        error?: string;
        size: number;
    };
}
//# sourceMappingURL=ValidationUtils.d.ts.map