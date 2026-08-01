import express from 'express';
import { AutonomyAPIServer, startAutonomyAPIServer } from './AutonomyAPIServer';

describe('AutonomyAPIServer', () => {
  let server: AutonomyAPIServer;
  let baseUrl: string;

  beforeAll(async () => {
    server = new AutonomyAPIServer({
      port: 0,
      host: '127.0.0.1',
    });
    await server.start();
    const assignedPort = (server as any).server.address().port;
    baseUrl = `http://127.0.0.1:${assignedPort}`;
  });

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('Core Server Endpoints', () => {
    it('GET /health returns status ok and uptime', async () => {
      const response = await fetch(`${baseUrl}/health`);
      expect(response.status).toBe(200);

      const body = (await response.json()) as any;
      expect(body.status).toBe('ok');
      expect(body.service).toBe('cic-autonomy-api');
      expect(typeof body.uptime).toBe('number');
      expect(body.timestamp).toBeDefined();
    });

    it('GET /autonomy returns service metadata and endpoints', async () => {
      const response = await fetch(`${baseUrl}/autonomy`);
      expect(response.status).toBe(200);

      const body = (await response.json()) as any;
      expect(body.service).toBe('CIC Autonomy API');
      expect(body.version).toBe('1.0.0');
      expect(body.endpoints.execution).toBeDefined();
      expect(body.endpoints.firedrills).toBeDefined();
    });

    it('GET /metrics returns text/plain prometheus metrics', async () => {
      const response = await fetch(`${baseUrl}/metrics`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/plain');

      const text = await response.text();
      expect(typeof text).toBe('string');
    });

    it('returns 404 for unknown endpoints', async () => {
      const response = await fetch(`${baseUrl}/non-existent-route`);
      expect(response.status).toBe(404);

      const body = (await response.json()) as any;
      expect(body.error).toBe('Not found');
      expect(body.path).toBe('/non-existent-route');
    });
  });

  describe('CORS and Preflight', () => {
    it('OPTIONS request should return 200 with CORS headers', async () => {
      const response = await fetch(`${baseUrl}/health`, {
        method: 'OPTIONS',
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
      expect(response.headers.get('access-control-allow-methods')).toContain('GET');
    });
  });

  describe('Cost Tracking Endpoints', () => {
    it('GET /api/usage-summary returns summary object', async () => {
      const response = await fetch(`${baseUrl}/api/usage-summary`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toBeDefined();
    });

    it('GET /api/agent-burn returns burn report data', async () => {
      const response = await fetch(`${baseUrl}/api/agent-burn`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toBeDefined();
    });

    it('GET /api/local-roi returns ROI data', async () => {
      const response = await fetch(`${baseUrl}/api/local-roi`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toBeDefined();
    });

    it('GET /api/usage-summary-env returns env usage summary', async () => {
      const response = await fetch(`${baseUrl}/api/usage-summary-env`);
      expect(response.status).toBe(200);
      const body = (await response.json()) as any;
      expect(body).toBeDefined();
    });
  });

  describe('Helper Functions & Lifecycle', () => {
    it('getApp() returns the underlying Express instance', () => {
      const app = server.getApp();
      expect(app).toBeDefined();
      expect(typeof app.use).toBe('function');
    });

    it('startAutonomyAPIServer helper starts and returns server instance', async () => {
      const tempServer = await startAutonomyAPIServer({
        port: 0,
        host: '127.0.0.1',
      });

      expect(tempServer).toBeInstanceOf(AutonomyAPIServer);

      const tempPort = (tempServer as any).server.address().port;
      const response = await fetch(`http://127.0.0.1:${tempPort}/health`);
      expect(response.status).toBe(200);

      await tempServer.stop();
    });
  });
});
