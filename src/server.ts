/**
 * CIC Autonomy API Server — Docker Entry Point
 * Starts Phase 2.5 config system + autonomy endpoints
 */

import { startAutonomyAPIServer, AutonomyAPIServerConfig } from './autonomy/AutonomyAPIServer.js';

const port = parseInt(process.env.PORT || '3000', 10);
const memoryStoreUrl = process.env.MEMORY_STORE_URL || 'http://localhost:3110';
const vaultUrl = process.env.VAULT_URL || 'http://localhost:3111';

const config: AutonomyAPIServerConfig = {
  port,
  host: '0.0.0.0',
  memoryQueryApiUrl: memoryStoreUrl,
  roadmapContext: {
    currentPhases: [],
    criticalPathPhases: [],
    estimatedCompletionDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  },
};

async function main() {
  try {
    console.log(`[${new Date().toISOString()}] Starting CIC Autonomy API Server...`);
    console.log(`[${new Date().toISOString()}] Config: port=${port}, memoryStore=${memoryStoreUrl}`);

    const server = await startAutonomyAPIServer(config);

    console.log(`[${new Date().toISOString()}] ✓ Server running successfully`);
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[${new Date().toISOString()}] ⚠ Server startup warning (dev mode):`, (err as Error).message);
    } else {
      console.error(`[${new Date().toISOString()}] ✗ Server startup failed:`, err);
      process.exit(1);
    }
  }
}

main();


