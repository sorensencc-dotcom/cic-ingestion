/**
 * Binary download and cache management for cloakbrowser.
 * Downloads the patched Chromium binary on first use, caches it locally.
 * Mirrors Python cloakbrowser/download.py.
 */
import type { BinaryInfo } from "./types.js";
/**
 * Ensure the stealth Chromium binary is available. Download if needed.
 * Returns the path to the chrome executable.
 */
export declare function ensureBinary(): Promise<string>;
/** Remove all cached binaries. Forces re-download on next launch. */
export declare function clearCache(): void;
/** Return info about the current binary installation. */
export declare function binaryInfo(): BinaryInfo;
/** Manually check for a newer Chromium version. Returns new version or null. */
export declare function checkForUpdate(): Promise<string | null>;
/** @internal Exported for testing only. */
export declare function fetchChecksums(version?: string): Promise<Map<string, string> | null>;
/** @internal Exported for testing only. */
export declare function parseChecksums(text: string): Map<string, string>;
/** @internal Exported for testing only. */
export declare function getLatestChromiumVersion(): Promise<string | null>;
/** @internal Exported for testing only. */
export declare function resetWrapperUpdateChecked(): void;
/** @internal Exported for testing only. */
export declare function checkWrapperUpdate(): Promise<void>;
//# sourceMappingURL=download.d.ts.map