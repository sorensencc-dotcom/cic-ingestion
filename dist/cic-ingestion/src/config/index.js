/**
 * CIC Config Module
 * Loads, validates, and exports configuration
 */
import { loadConfig } from './ConfigLoader.js';
import { validateConfig } from './ConfigValidator.js';
const config = loadConfig();
validateConfig(config);
export default config;
//# sourceMappingURL=index.js.map
