/**
 * Memory + Governance Router Tests (Phase 5b)
 * Verify that memory and governance routers are properly wired and callable
 */

import { describe, it, expect } from '@jest/globals';
import { createMemoryRouter } from '../memory.ts';
import { createGovernanceRouter } from '../governance.ts';

describe('Memory Router (Phase 5b)', () => {
  it('should be defined and exported', () => {
    expect(createMemoryRouter).toBeDefined();
  });

  it('should create a router with proper stack', () => {
    const memoryRouter = createMemoryRouter({
      memoryStoreUrl: 'http://localhost:3110',
    });

    expect(memoryRouter).toBeDefined();
    expect(memoryRouter.stack).toBeDefined();
    expect(memoryRouter.stack.length).toBeGreaterThan(0);
  });

  it('should have 6 memory endpoints registered', () => {
    const memoryRouter = createMemoryRouter({
      memoryStoreUrl: 'http://localhost:3110',
    });

    const routes = memoryRouter.stack.filter((layer: any) => layer.route);
    expect(routes.length).toBe(6);
  });

  it('should accept custom memory store URL from config', () => {
    const customUrl = 'http://custom-memory:3110';
    const memoryRouter = createMemoryRouter({
      memoryStoreUrl: customUrl,
    });

    expect(memoryRouter).toBeDefined();
  });

  it('should fallback to environment variable for memory store URL', () => {
    process.env.MEMORY_STORE_URL = 'http://env-memory:3110';
    const memoryRouter = createMemoryRouter();
    expect(memoryRouter).toBeDefined();
    delete process.env.MEMORY_STORE_URL;
  });
});

describe('Governance Router (Phase 5b)', () => {
  it('should be defined and exported', () => {
    expect(createGovernanceRouter).toBeDefined();
  });

  it('should create a router with proper stack', () => {
    const governanceRouter = createGovernanceRouter({
      governanceControlPlaneUrl: 'http://localhost:3113',
    });

    expect(governanceRouter).toBeDefined();
    expect(governanceRouter.stack).toBeDefined();
    expect(governanceRouter.stack.length).toBeGreaterThan(0);
  });

  it('should have 6 governance endpoints registered', () => {
    const governanceRouter = createGovernanceRouter({
      governanceControlPlaneUrl: 'http://localhost:3113',
    });

    const routes = governanceRouter.stack.filter((layer: any) => layer.route);
    expect(routes.length).toBe(6);
  });

  it('should accept custom governance URL from config', () => {
    const customUrl = 'http://custom-governance:3113';
    const governanceRouter = createGovernanceRouter({
      governanceControlPlaneUrl: customUrl,
    });

    expect(governanceRouter).toBeDefined();
  });

  it('should fallback to environment variable for governance URL', () => {
    process.env.GOVERNANCE_URL = 'http://env-governance:3113';
    const governanceRouter = createGovernanceRouter();
    expect(governanceRouter).toBeDefined();
    delete process.env.GOVERNANCE_URL;
  });
});

describe('AutonomyAPIServer Integration (Phase 5b)', () => {
  it('should import memory and governance routers without errors', async () => {
    const memoryRouter = await import('../memory.js');
    const governanceRouter = await import('../governance.js');

    expect(memoryRouter.createMemoryRouter).toBeDefined();
    expect(governanceRouter.createGovernanceRouter).toBeDefined();
  });

  it('both routers should be instantiable', () => {
    const memoryRouter = createMemoryRouter();
    const governanceRouter = createGovernanceRouter();

    expect(memoryRouter).toBeDefined();
    expect(governanceRouter).toBeDefined();
  });
});
