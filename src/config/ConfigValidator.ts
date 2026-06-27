/**
 * Configuration Validator
 * Uses AJV to validate config against JSON Schema
 */

import Ajv from 'ajv';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';

const ajv = new Ajv({ allErrors: true });

// Load schema at module initialization - try cic-ingestion/config first, then fall back
let schemaPath = join(process.cwd(), 'cic-ingestion/config/schema.json');
try {
  readFileSync(schemaPath, 'utf8');
} catch {
  schemaPath = join(process.cwd(), 'config/schema.json');
}
const schemaContent = readFileSync(schemaPath, 'utf8');
const schema = JSON.parse(schemaContent);

const validate = ajv.compile(schema);

export function validateConfig(config: any): void {
  const isValid = validate(config);

  if (!isValid) {
    const errors = validate.errors?.map((e) => `${e.instancePath} ${e.message}`).join('; ') || 'Unknown error';
    throw new Error(`Config validation failed: ${errors}`);
  }
}
