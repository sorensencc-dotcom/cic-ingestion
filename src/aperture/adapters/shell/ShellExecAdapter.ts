/**
 * Phase 27: Aperture — Shell Exec Adapter
 * Execute shell commands (restricted)
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { BaseAdapter } from '../BaseAdapter';
import { SandboxHandle, ExecutionOptions } from '../../types';
import { JSONSchema7 } from 'json-schema';
import { ValidationUtils } from '../ValidationUtils';

const execAsync = promisify(exec);

export class ShellExecAdapter extends BaseAdapter {
  constructor() {
    const inputSchema: JSONSchema7 = {
      type: 'object',
      properties: {
        command: { type: 'string' },
        args: { type: 'array', items: { type: 'string' } },
        timeout: { type: 'number' }
      },
      required: ['command']
    };

    const outputSchema: JSONSchema7 = {
      type: 'object',
      properties: {
        stdout: { type: 'string' },
        stderr: { type: 'string' },
        exitCode: { type: 'number' }
      }
    };

    super('shell.exec', 'Shell Execute', '1.0.0', inputSchema, outputSchema);
  }

  /**
   * Execute shell command in sandbox
   */
  async execute(
    input: any,
    sandbox: SandboxHandle,
    options?: ExecutionOptions
  ): Promise<any> {
    const { command, args = [], timeout = 30000 } = input;

    if (!command || typeof command !== 'string') {
      throw new Error('Invalid input: command must be a string');
    }

    // Validate command against dangerous operations
    const cmdValidation = ValidationUtils.validateCommand(command);
    if (!cmdValidation.valid) {
      throw new Error(cmdValidation.error);
    }

    // Build command with args
    const fullCommand = args.length > 0
      ? `${command} ${args.map((a: string) => `"${a}"`).join(' ')}`
      : command;

    try {
      const { stdout, stderr } = await execAsync(fullCommand, {
        timeout,
        cwd: sandbox.tmpdir
      });

      return {
        stdout,
        stderr,
        exitCode: 0
      };
    } catch (err: any) {
      return {
        stdout: err.stdout || '',
        stderr: err.stderr || err.message,
        exitCode: err.code || 1
      };
    }
  }
}

export function createShellExecAdapter(): ShellExecAdapter {
  return new ShellExecAdapter();
}
