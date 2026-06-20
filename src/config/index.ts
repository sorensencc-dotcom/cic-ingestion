/**
 * CIC Config Module
 * Loads, validates, and exports configuration
 */

import { loadConfig } from './ConfigLoader.js';
import { validateConfig } from './ConfigValidator.js';

const config = loadConfig();
validateConfig(config);

export type { CICConfig } from './ConfigLoader.js';
export default config;


