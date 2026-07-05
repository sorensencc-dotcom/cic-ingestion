export const validateFinalUrl = (url) => !!url && url !== 'about:blank';
export const validatePng = (base64) => {
    try {
        const buf = Buffer.from(base64, 'base64');
        return (buf.length >= 4 &&
            buf[0] === 0x89 &&
            buf[1] === 0x50 &&
            buf[2] === 0x4e &&
            buf[3] === 0x47);
    }
    catch {
        return false;
    }
};
export const validateScreenshotSize = (base64) => {
    try {
        return Buffer.byteLength(base64, 'base64') < 5_000_000;
    }
    catch {
        return false;
    }
};
export const sanitizeText = (t) => t
    .replace(/\x00/g, '') // null bytes
    .replace(/\[[0-9;]*m/g, '') // ANSI escape codes
    .trim();
export const validateTextLength = (t) => t.length > 0 && t.length < 10_000;
export const validateJsonCompleteness = (t) => {
    try {
        JSON.parse(t);
        return true;
    }
    catch {
        return false;
    }
};
export const detectCrashInLogs = (logs) => logs.some((l) => l.includes('Target closed') ||
    l.includes('Protocol error') ||
    l.includes('browser disconnected'));
//# sourceMappingURL=guards.js.map