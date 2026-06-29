/**
 * Phase 27: Aperture — Base Adapter
 * Abstract base for all adapter implementations
 */

import Ajv from 'ajv';
import { JSONSchema7 } from 'json-schema';
import { Adapter, SandboxHandle, ExecutionOptions } from '../types';

const ajv = new Ajv({ allErrors: true });

export abstract class BaseAdapter implements Adapter {
  protected id: string;
  protected name: string;
  protected version: string;
  protected inputSchema: JSONSchema7;
  protected outputSchema: JSONSchema7;

  constructor(
    id: string,
    name: string,
    version: string,
    inputSchema: JSONSchema7,
    outputSchema: JSONSchema7
  ) {
    this.id = id;
    this.name = name;
    this.version = version;
    this.inputSchema = inputSchema;
    this.outputSchema = outputSchema;
  }

  /**
   * Return metadata
   */
  metadata() {
    return {
      id: this.id,
      name: this.name,
      version: this.version
    };
  }

  /**
   * Validate input against schema
   */
  validate(input: any): { valid: boolean; errors?: string[] } {
    if (!this.inputSchema) {
      return { valid: true };
    }
    const validate = ajv.compile(this.inputSchema);
    const valid = validate(input) as boolean;
    if (!valid) {
      const errors = (validate.errors ?? []).map(
        (e) => `${e.instancePath || '(root)'} ${e.message}`
      );
      return { valid: false, errors };
    }
    return { valid: true };
  }

  /**
   * Execute adapter (must be implemented by subclass)
   */
  abstract execute(
    input: any,
    sandbox: SandboxHandle,
    options?: ExecutionOptions
  ): Promise<any>;

  /**
   * Return schemas
   */
  schema() {
    return {
      input: this.inputSchema,
      output: this.outputSchema
    };
  }

  /**
   * Helper: Validate output against schema
   */
  protected validateOutput(output: any): boolean {
    if (!this.outputSchema) {
      return true;
    }
    const validate = ajv.compile(this.outputSchema);
    const valid = validate(output) as boolean;
    if (!valid) {
      const messages = (validate.errors ?? []).map(
        (e) => `${e.instancePath || '(root)'} ${e.message}`
      );
      console.error('[BaseAdapter] Output schema validation failed:', messages);
    }
    return valid;
  }
}
