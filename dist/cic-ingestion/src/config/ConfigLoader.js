/**
 * Configuration Loader
 * Loads defaults.json + optional override via CIC_CONFIG_PATH env var
 * Returns immutable merged config snapshot
 */
import fs from 'fs';
import path from 'path';
export function loadConfig() {
    // Load defaults from bundled file
    const defaultsPath = path.join(process.cwd(), 'config/defaults.json');
    const defaultsContent = fs.readFileSync(defaultsPath, 'utf8');
    const defaults = JSON.parse(defaultsContent);
    // Load optional override from env var
    let override = {};
    const overridePath = process.env.CIC_CONFIG_PATH;
    if (overridePath && fs.existsSync(overridePath)) {
        const overrideContent = fs.readFileSync(overridePath, 'utf8');
        override = JSON.parse(overrideContent);
    }
    // Deep merge: override wins
    const merged = deepMerge(defaults, override);
    // Return immutable snapshot
    return Object.freeze(merged);
}
function deepMerge(target, source) {
    if (typeof target !== 'object' || target === null) {
        return source;
    }
    if (typeof source !== 'object' || source === null) {
        return target;
    }
    const result = { ...target };
    for (const key of Object.keys(source)) {
        result[key] = deepMerge(target[key], source[key]);
    }
    return result;
}
//# sourceMappingURL=ConfigLoader.js.map
