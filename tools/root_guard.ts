import { resolve } from 'node:path';
import { ROOT, emit } from './_runtime.js';
export function assertRoot(cwd = process.cwd()): void { if (resolve(cwd).replaceAll('\\', '/').toLowerCase() !== ROOT.toLowerCase()) emit({ error: 'ROOT_MISMATCH', expected: ROOT, actual: resolve(cwd).replaceAll('\\', '/') }, true); }
if (process.argv[1]?.endsWith('root_guard.ts')) assertRoot();
