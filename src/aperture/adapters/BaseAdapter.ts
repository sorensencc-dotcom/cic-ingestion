/**
 * Phase 27: Aperture — Base Adapter
 * Abstract base for all adapter implementations
 */

import { JSONSchema7 } from 'json-schema';
import { Adapter, SandboxHandle, ExecutionOptions } from '../types';

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
    // TODO: Implement JSON Schema validation
    // For now, return valid
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
    // TODO: Implement JSON Schema validation
    return true;
  }
}
