/**
 * Tests for schema.json
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from '@jest/globals';

describe('Schema', () => {
  it('schema.json is valid JSON', () => {
    const schemaPath = join(process.cwd(), 'config/schema.json');
    const content = readFileSync(schemaPath, 'utf8');
    expect(() => JSON.parse(content)).not.toThrow();
  });

  it('schema has required top-level properties', () => {
    const schemaPath = join(process.cwd(), 'config/schema.json');
    const content = readFileSync(schemaPath, 'utf8');
    const schema = JSON.parse(content);

    expect(schema.$schema).toBeDefined();
    expect(schema.title).toBe('CIC Config v1');
    expect(schema.properties.services).toBeDefined();
  });
});
