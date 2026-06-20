/**
 * Phase 27: Aperture — HTTP POST Adapter
 * HTTP POST request with JSON payload
 */
import fetch from 'node-fetch';
import { BaseAdapter } from '../BaseAdapter';
import { ValidationUtils } from '../ValidationUtils';
export class HttpPostAdapter extends BaseAdapter {
    constructor() {
        const inputSchema = {
            type: 'object',
            properties: {
                url: { type: 'string' },
                body: { type: ['object', 'string'] },
                headers: { type: 'object' },
                timeout: { type: 'number' }
            },
            required: ['url', 'body']
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
        super('http.post', 'HTTP POST', '1.0.0', inputSchema, outputSchema);
    }
    /**
     * Perform HTTP POST request
     */
    async execute(input, sandbox, options) {
        const { url, body, headers = {}, timeout = 30000 } = input;
        if (!url || typeof url !== 'string') {
            throw new Error('Invalid input: url must be a string');
        }
        if (body === undefined) {
            throw new Error('Invalid input: body is required');
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
        // Serialize body
        let bodyString;
        try {
            bodyString = typeof body === 'string' ? body : JSON.stringify(body);
        }
        catch (err) {
            throw new Error(`Failed to serialize body: ${err.message}`);
        }
        // Validate body size
        const sizeValidation = ValidationUtils.validateBodySize(bodyString);
        if (!sizeValidation.valid) {
            throw new Error(sizeValidation.error);
        }
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...headerValidation.filtered
                },
                body: bodyString,
                timeout
            });
            const responseBody = await response.text();
            const responseHeaders = Object.fromEntries(response.headers);
            return {
                status: response.status,
                headers: responseHeaders,
                body: responseBody,
                size: responseBody.length
            };
        }
        catch (err) {
            throw new Error(`HTTP POST failed for ${url}: ${err.message}`);
        }
    }
}
export function createHttpPostAdapter() {
    return new HttpPostAdapter();
}
//# sourceMappingURL=HttpPostAdapter.js.map