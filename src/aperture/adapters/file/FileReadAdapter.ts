/**
 * Phase 27: Aperture — File Read Adapter
 * Read file contents
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { BaseAdapter } from '../BaseAdapter';
import { SandboxHandle, ExecutionOptions } from '../../types';
import { JSONSchema7 } from 'json-schema';
import { ValidationUtils } from '../ValidationUtils';

export class FileReadAdapter extends BaseAdapter {
  constructor() {
    const inputSchema: JSONSchema7 = {
      type: 'object',
      properties: {
        path: { type: 'string' },
        encoding: { type: 'string', enum: ['utf8', 'binary'] }
      },
      required: ['path']
    };

    const outputSchema: JSONSchema7 = {
      type: 'object',
      properties: {
        data: { type: 'string' },
        size: { type: 'number' },
        mtime: { type: 'string' }
      }
    };

    super('file.read', 'File Read', '1.0.0', inputSchema, outputSchema);
  }

  /**
   * Read file from sandbox directory
   */
  async execute(
    input: any,
    sandbox: SandboxHandle,
    options?: ExecutionOptions
  ): Promise<any> {
    const { path: filePath, encoding = 'utf8' } = input;

    if (!filePath || typeof filePath !== 'string') {
      throw new Error('Invalid input: path must be a string');
    }

    // Validate path is within sandbox (prevent directory traversal)
    const pathValidation = ValidationUtils.validatePathTraversal(filePath, sandbox.tmpdir);
    if (!pathValidation.valid) {
      throw new Error(pathValidation.error);
    }

    const safePath = path.join(sandbox.tmpdir, filePath);

    try {
      const data = await fs.readFile(safePath, encoding as BufferEncoding);
      const stats = await fs.stat(safePath);

      return {
        data,
        size: stats.size,
        mtime: stats.mtime.toISOString()
      };
    } catch (err: any) {
      throw new Error(`Failed to read file ${filePath}: ${err.message}`);
    }
  }
}

export function createFileReadAdapter(): FileReadAdapter {
  return new FileReadAdapter();
}
