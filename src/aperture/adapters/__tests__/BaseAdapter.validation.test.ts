/**
 * Phase 27: Aperture — BaseAdapter JSON Schema Validation Tests
 */

import { JSONSchema7 } from 'json-schema';
import { BaseAdapter } from '../BaseAdapter.js';
import { SandboxHandle, ExecutionOptions } from '../../types/index.js';

// Concrete subclass to exercise BaseAdapter directly
class TestAdapter extends BaseAdapter {
  constructor(inputSchema: JSONSchema7, outputSchema: JSONSchema7) {
    super('test.adapter', 'Test Adapter', '1.0.0', inputSchema, outputSchema);
  }

  async execute(_input: any, _sandbox: SandboxHandle, _options?: ExecutionOptions): Promise<any> {
    return {};
  }

  // Expose protected method for testing
  public testValidateOutput(output: any): boolean {
    return this.validateOutput(output);
  }
}

const inputSchema: JSONSchema7 = {
  type: 'object',
  properties: {
    url: { type: 'string' },
    count: { type: 'number' }
  },
  required: ['url']
};

const outputSchema: JSONSchema7 = {
  type: 'object',
  properties: {
    status: { type: 'number' },
    body: { type: 'string' }
  },
  required: ['status']
};

describe('BaseAdapter.validate()', () => {
  let adapter: TestAdapter;

  beforeEach(() => {
    adapter = new TestAdapter(inputSchema, outputSchema);
  });

  test('Test 1: accepts valid input → {valid: true}', () => {
    const result = adapter.validate({ url: 'https://example.com', count: 5 });
    expect(result).toEqual({ valid: true });
  });

  test('Test 2: rejects invalid input → {valid: false, errors: [...]}', () => {
    // Missing required 'url'
    const result = adapter.validate({ count: 5 });
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  test('Test 3: handles null schema → {valid: true}', () => {
    const nullAdapter = new TestAdapter(null as any, outputSchema);
    const result = nullAdapter.validate({ anything: true });
    expect(result).toEqual({ valid: true });
  });

  test('Test 6: multiple schema violations produce multiple errors', () => {
    const strictSchema: JSONSchema7 = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number', minimum: 0 },
        active: { type: 'boolean' }
      },
      required: ['name', 'age', 'active']
    };
    const multiAdapter = new TestAdapter(strictSchema, outputSchema);

    // Missing all three required fields
    const result = multiAdapter.validate({});
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThanOrEqual(3);
  });
});

describe('BaseAdapter.validateOutput()', () => {
  let adapter: TestAdapter;

  beforeEach(() => {
    adapter = new TestAdapter(inputSchema, outputSchema);
  });

  test('Test 4: accepts valid output → true', () => {
    const result = adapter.testValidateOutput({ status: 200, body: 'ok' });
    expect(result).toBe(true);
  });

  test('Test 5: rejects invalid output → false', () => {
    // Missing required 'status'
    const result = adapter.testValidateOutput({ body: 'no status here' });
    expect(result).toBe(false);
  });
});
