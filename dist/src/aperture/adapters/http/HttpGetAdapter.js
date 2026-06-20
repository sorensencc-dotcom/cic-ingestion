/**
 * Phase 27: Aperture — HTTP GET Adapter
 * HTTP GET request
 */
import fetch from 'node-fetch';
import { BaseAdapter } from '../BaseAdapter';
import { ValidationUtils } from '../ValidationUtils';
export class HttpGetAdapter extends BaseAdapter {
    constructor() {
        const inputSchema = {
            type: 'object',
            properties: {
                url: { type: 'string' },
                headers: { type: 'object' },
                timeout: { type: 'number' }
            },
            required: ['url']
        };
        const outputSchema = {
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
    async execute(input, sandbox, options) {
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
            const response = await fetch(url, {
                method: 'GET',
                headers: headerValidation.filtered,
                timeout
            });
            const body = await response.text();
            const responseHeaders = Object.fromEntries(response.headers);
            return {
                status: response.status,
                headers: responseHeaders,
                body,
                size: body.length
            };
        }
        catch (err) {
            throw new Error(`HTTP GET failed for ${url}: ${err.message}`);
        }
    }
}
export function createHttpGetAdapter() {
    return new HttpGetAdapter();
}
//# sourceMappingURL=HttpGetAdapter.js.map