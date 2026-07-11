/**
 * CIC Config Module
 * Loads, validates, and exports configuration
 */

import { loadConfig } from './ConfigLoader.ts';
import { validateConfig } from './ConfigValidator.ts';

const config = loadConfig();
validateConfig(config);

export type { CICConfig } from './ConfigLoader.ts';
export default config;


