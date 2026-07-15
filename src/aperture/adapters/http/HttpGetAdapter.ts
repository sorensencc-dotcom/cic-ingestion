/**
 * Phase 27: Aperture — HTTP GET Adapter
 * HTTP GET request
 */

import { BaseAdapter } from '../BaseAdapter';
import { SandboxHandle, ExecutionOptions } from '../../types';
import { JSONSchema7 } from 'json-schema';
import { ValidationUtils } from '../ValidationUtils';

export class HttpGetAdapter extends BaseAdapter {
  constructor() {
    const inputSchema: JSONSchema7 = {
      type: 'object',
      properties: {
        url: { type: 'string' },
        headers: { type: 'object' },
        timeout: { type: 'number' }
      },
      required: ['url']
    };

    const outputSchema: JSONSchema7 = {
      type: 'object',
      properties: {
        status: { type: 'number' },
        headers: { type: 'object' },
        body: { type: 'string' },
        size: { type: 'number' }
      }
    };

    super('http.get', 'HTTP GET', '1.0.0', inputSchema, outputSchema);
  }

  /**
   * Perform HTTP GET request
   */
  async execute(
    input: any,
    sandbox: SandboxHandle,
    options?: ExecutionOptions
  ): Promise<any> {
    const { url, headers = {}, timeout = 30000 } = input;

    if (!url || typeof url !== 'string') {
      throw new Error('Invalid input: url must be a string');
    }

    // Validate URL against allowed domains
    const urlValidation = ValidationUtils.validateUrl(url);
    if (!urlValidation.valid) {
      throw new Error(urlValidation.error);
    }

    // Validate headers (filter sensitive)
    const headerValidation = ValidationUtils.validateHeaders(headers);
    if (!headerValidation.valid) {
      console.warn('Removed sensitive headers:', headerValidation.removed);
    }

    try {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), timeout);

      let response;
      try {
        response = await fetch(url, {
          method: 'GET',
          headers: headerValidation.filtered,
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeoutHandle);
      }

      const body = await response.text();
      const responseHeaders = Object.fromEntries(response.headers);

      return {
        status: response.status,
        headers: responseHeaders,
        body,
        size: body.length
      };
    } catch (err: any) {
      throw new Error(`HTTP GET failed for ${url}: ${err.message}`);
    }
  }
}

export function createHttpGetAdapter(): HttpGetAdapter {
  return new HttpGetAdapter();
}
