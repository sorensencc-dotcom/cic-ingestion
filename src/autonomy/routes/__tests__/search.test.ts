import express, { Express } from 'express';
import { Server } from 'http';
import { createSearchRouter } from '../search';
import { TorqueQueryClient } from '../../../services/torquequery/TorqueQueryClient';

jest.mock('../../../services/torquequery/TorqueQueryClient');

describe('Search Router', () => {
  let app: Express;
  let server: Server;
  let baseUrl: string;
  let mockCicQuery: jest.Mock;

  beforeAll((done) => {
    mockCicQuery = jest.fn();
    (TorqueQueryClient as jest.Mock).mockImplementation(() => ({
      cicQuery: mockCicQuery,
    }));

    app = express();
    app.use(express.json());
    app.use(createSearchRouter({ torqueQueryUrl: 'http://localhost:9999', governanceUrl: 'http://localhost:8888' }));

    server = app.listen(0, '127.0.0.1', () => {
      const address = server.address() as { port: number };
      baseUrl = `http://127.0.0.1:${address.port}`;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST /search/cic-query should execute query with defaults and return results', async () => {
    const mockResponse = {
      query: 'test query',
      matches: [],
      counterfactual_analysis: {
        primary_match: null,
      },
    };
    mockCicQuery.mockResolvedValue(mockResponse);

    const response = await fetch(`${baseUrl}/search/cic-query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test query' }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(mockResponse);

    expect(mockCicQuery).toHaveBeenCalledWith({
      query: 'test query',
      phase_ids: undefined,
      confidence_min: 0.7,
      limit: 20,
    });
  });

  it('POST /search/cic-query should attempt governance enrichment when primary match is returned', async () => {
    const mockResponse = {
      query: 'test query',
      counterfactual_analysis: {
        primary_match: 'dec-123',
      },
    };
    mockCicQuery.mockResolvedValue(mockResponse);

    // Mock global fetch for governance call
    const originalFetch = global.fetch;
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ decisionId: 'dec-123', rule: 'rule-A' }),
    });
    global.fetch = fetchMock as any;

    try {
      const response = await originalFetch(`${baseUrl}/search/cic-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'test query' }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as any;
      expect(body.counterfactual_analysis.decision_details).toEqual({
        decisionId: 'dec-123',
        rule: 'rule-A',
      });
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:8888/governance/decisions/dec-123',
        { method: 'GET' }
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('POST /search/cic-query should gracefully handle governance enrichment fetch error', async () => {
    const mockResponse = {
      query: 'test query',
      counterfactual_analysis: {
        primary_match: 'dec-456',
      },
    };
    mockCicQuery.mockResolvedValue(mockResponse);

    const originalFetch = global.fetch;
    const fetchMock = jest.fn().mockRejectedValue(new Error('Network error'));
    global.fetch = fetchMock as any;

    try {
      const response = await originalFetch(`${baseUrl}/search/cic-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'test query' }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as any;
      expect(body.counterfactual_analysis.decision_details).toBeUndefined();
    } finally {
      global.fetch = originalFetch;
    }
  });
});
