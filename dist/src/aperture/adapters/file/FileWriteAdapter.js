/**
 * Phase 27: Aperture — File Write Adapter
 * Write file contents to sandbox
 */
import * as fs from 'fs-extra';
import * as path from 'path';
import { BaseAdapter } from '../BaseAdapter';
import { ValidationUtils } from '../ValidationUtils';
export class FileWriteAdapter extends BaseAdapter {
    constructor() {
        const inputSchema = {
            type: 'object',
            properties: {
                path: { type: 'string' },
                content: { type: 'string' },
                encoding: { type: 'string', enum: ['utf8', 'binary'] },
                mode: { type: 'number' }
            },
            required: ['path', 'content']
        };
        const outputSchema = {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                path: { type: 'string' },
                size: { type: 'number' },
                created: { type: 'boolean' }
            }
        };
        super('file.write', 'File Write', '1.0.0', inputSchema, outputSchema);
    }
    /**
     * Write file to sandbox directory
     */
    async execute(input, sandbox, options) {
        const { path: filePath, content, encoding = 'utf8', mode = 0o644 } = input;
        if (!filePath || typeof filePath !== 'string') {
            throw new Error('Invalid input: path must be a string');
        }
        if (content === undefined || typeof content !== 'string') {
            throw new Error('Invalid input: content must be a string');
        }
        // Validate path is within sandbox
        const pathValidation = ValidationUtils.validatePathTraversal(filePath, sandbox.tmpdir);
        if (!pathValidation.valid) {
            throw new Error(pathValidation.error);
        }
        // Validate body size
        const sizeValidation = ValidationUtils.validateBodySize(content);
        if (!sizeValidation.valid) {
            throw new Error(sizeValidation.error);
        }
        const safePath = path.join(sandbox.tmpdir, filePath);
        try {
            // Check if file exists
            const exists = await fs.pathExists(safePath);
            // Ensure parent directory exists
            const dir = path.dirname(safePath);
            await fs.ensureDir(dir);
            // Write file
            await fs.writeFile(safePath, content, encoding);
            // Set mode if specified
            if (mode) {
                await fs.chmod(safePath, mode);
            }
            return {
                success: true,
                path: filePath,
                size: Buffer.byteLength(content),
                created: !exists
            };
        }
        catch (err) {
            throw new Error(`Failed to write file ${filePath}: ${err.message}`);
        }
    }
}
export function createFileWriteAdapter() {
    return new FileWriteAdapter();
}
//# sourceMappingURL=FileWriteAdapter.js.map