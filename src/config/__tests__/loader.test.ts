/**
 * Tests for ConfigLoader
 */

import { loadConfig } from '../ConfigLoader.ts';
import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const tempDir = path.join(process.cwd(), '.test-config');

describe('ConfigLoader', () => {
  beforeEach(() => {
    delete process.env.CIC_CONFIG_PATH;
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterEach(() => {
    delete process.env.CIC_CONFIG_PATH;
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  it('loads defaults.json without override', () => {
    const config = loadConfig();
    expect(config.services.kg.sqlitePath).toBe('./data/kg.db');
    expect(config.services.kg.ingestBatchSize).toBe(50);
  });

  it('merges override file via CIC_CONFIG_PATH', () => {
    const overridePath = path.join(tempDir, 'override.json');
    fs.writeFileSync(
      overridePath,
      JSON.stringify({
        services: {
          kg: {
            ingestBatchSize: 100,
          },
        },
      })
    );

    process.env.CIC_CONFIG_PATH = overridePath;
    const config = loadConfig();
    expect(config.services.kg.ingestBatchSize).toBe(100);
    expect(config.services.kg.sqlitePath).toBe('./data/kg.db'); // defaults still applied
  });

  it('config object is frozen at top level', () => {
    const config = loadConfig();
    expect(() => {
      (config as any).newProp = 'should not work';
    }).toThrow();
  });
});
