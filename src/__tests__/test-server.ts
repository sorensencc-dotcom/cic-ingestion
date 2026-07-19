/**
 * Minimal test server for Phase 3 E2E tests
 * Starts only imageAnalysis service, skips full autonomy stack
 */

import express from 'express';
import { createImageAnalysisRouter, loadConfig } from '../services/imageAnalysis/index.ts';

const port = parseInt(process.env.CIC_INGESTION_PORT || '3000', 10);

async function startTestServer() {
  const app = express();

  app.use(express.json({ limit: '10mb' }));

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'cic-imageanalysis-test',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // Image analysis endpoint
  const config = loadConfig();
  const router = createImageAnalysisRouter(config);
  app.use('/api', router);

  // 404
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found', path: req.path });
  });

  return new Promise<void>((resolve, reject) => {
    try {
      const server = app.listen(port, '0.0.0.0', () => {
        console.log(`[${new Date().toISOString()}] Test server started on http://0.0.0.0:${port}`);
        resolve();
      });

      server.on('error', reject);

      // Graceful shutdown
      process.on('SIGINT', () => {
        server.close(() => {
          console.log(`[${new Date().toISOString()}] Test server stopped`);
          process.exit(0);
        });
      });
    } catch (err) {
      reject(err);
    }
  });
}

startTestServer().catch(err => {
  console.error('Test server startup failed:', err);
  process.exit(1);
});
