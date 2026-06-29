/**
 * Phase 26: TorqueQuery Integration Test
 * Tests Python RAG + TypeScript indexer working together
 */

import fetch from 'node-fetch';

describe.skip('Phase 26: TorqueQuery Integration (Python ↔ TypeScript)', () => {
  const PYTHON_URL = process.env.TORQUEQUERY_PYTHON_URL || 'http://localhost:8000';
  const TYPESCRIPT_URL = process.env.TORQUEQUERY_TS_URL || 'http://localhost:3110';

  /**
   * Test: Push event from Python → TypeScript indexer
   */
  it('ingests event via TypeScript endpoint', async () => {
    const event = {
      type: 'TEST_INTEGRATION',
      agentId: 'integration-agent',
      timestamp: new Date().toISOString(),
      payload: { integration: true },
    };

    const response = await fetch(`${TYPESCRIPT_URL}/torquequery/memory/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });

    expect(response.status).toBe(201);
    const result = await response.json();
    expect(result.status).toBe('indexed');
  });

  /**
   * Test: Query event back from TypeScript
   */
  it('queries ingested event by type', async () => {
    const event = {
      type: 'QUERY_TEST',
      agentId: 'query-agent',
      payload: { queryable: true },
    };

    // Ingest
    await fetch(`${TYPESCRIPT_URL}/torquequery/memory/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });

    // Query back
    const response = await fetch(
      `${TYPESCRIPT_URL}/torquequery/memory/by-type/QUERY_TEST`
    );

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.count).toBeGreaterThan(0);
    expect(result.events.some((e: any) => e.agentId === 'query-agent')).toBe(true);
  });

  /**
   * Test: Batch ingest via TypeScript
   */
  it('handles batch ingest from TypeScript', async () => {
    const batch = [
      {
        type: 'BATCH_TEST',
        agentId: 'batch-agent-1',
        payload: { batch: 1 },
      },
      {
        type: 'BATCH_TEST',
        agentId: 'batch-agent-2',
        payload: { batch: 2 },
      },
    ];

    const response = await fetch(`${TYPESCRIPT_URL}/torquequery/memory/ingest-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    });

    expect(response.status).toBe(201);
    const result = await response.json();
    expect(result.indexed).toBe(2);
  });

  /**
   * Test: Python validation blocks bad requests
   */
  it('rejects invalid query from Python', async () => {
    const response = await fetch(`${PYTHON_URL}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: '' }),
    });

    expect(response.status).toBe(400);
  });

  /**
   * Test: Python validates fs read limits
   */
  it('enforces read limit validation', async () => {
    const user = { userId: 'test', groups: [], tenantId: 'default' };
    const response = await fetch(`${PYTHON_URL}/api/fs/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user,
        path: '/docs/test.md',
        limit: 10000001, // exceeds 1MB
      }),
    });

    expect(response.status).toBe(400);
  });

  /**
   * Test: TypeScript event schema validation
   */
  it('rejects event without required fields', async () => {
    const badEvent = {
      type: 'MISSING_AGENT', // missing agentId
      payload: {},
    };

    const response = await fetch(`${TYPESCRIPT_URL}/torquequery/memory/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(badEvent),
    });

    expect(response.status).toBe(400);
    const result = await response.json();
    expect(result.error).toContain('agentId');
  });

  /**
   * Test: Event with signals flows through both systems
   */
  it('preserves signals through ingestion', async () => {
    const eventWithSignals = {
      type: 'SIGNAL_TEST',
      agentId: 'signal-agent',
      payload: {},
      signals: [
        { type: 'confidence', value: 0.95 },
        { type: 'drift', value: 0.05 },
      ],
    };

    const response = await fetch(`${TYPESCRIPT_URL}/torquequery/memory/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventWithSignals),
    });

    expect(response.status).toBe(201);

    // Query signals back
    const signalResponse = await fetch(
      `${TYPESCRIPT_URL}/torquequery/memory/by-signal/confidence`
    );

    expect(signalResponse.status).toBe(200);
    const result = await signalResponse.json();
    expect(result.count).toBeGreaterThan(0);
  });

  /**
   * Test: Health checks on both services
   */
  it('reports health from TypeScript endpoint', async () => {
    const response = await fetch(`${TYPESCRIPT_URL}/health`);
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.status).toBe('ok');
  });

  it('reports health from Python endpoint', async () => {
    const response = await fetch(`${PYTHON_URL}/health`);
    expect(response.status).toBe(200);
    const result = await response.json();
    // Status might be 'initializing' if models are still loading
    expect(['healthy', 'initializing']).toContain(result.status);
  });
});
