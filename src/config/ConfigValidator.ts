/**
 * Configuration Validator
 * Uses AJV to validate config against JSON Schema
 */

import Ajv from 'ajv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ajv = new Ajv({ allErrors: true });

// Load schema at module initialization
const schemaPath = join(__dirname, '../../config/schema.json');
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
