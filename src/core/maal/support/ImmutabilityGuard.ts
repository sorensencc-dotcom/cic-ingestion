/**
 * Phase 4: ImmutabilityGuard — enforce Phase 1 & 3 immutability via checksums.
 * CI gate rule 1 & 2.
 */

import * as fs from 'fs';
import * as crypto from 'crypto';

export interface ImmutabilityCheckpoint {
  readonly phase: '1' | '3';
  readonly version: string;
  readonly fileChecksums: Map<string, string>;
  readonly timestamp: number;
}

export class ImmutabilityGuard {
  private checksums: Map<string, ImmutabilityCheckpoint> = new Map();

  registerCheckpoint(phase: '1' | '3', version: string, files: string[]) {
    const sums = new Map<string, string>();
    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf-8');
      sums.set(file, crypto.createHash('sha256').update(content).digest('hex'));
    });

    this.checksums.set(phase, {
      phase,
      version,
      fileChecksums: sums,
      timestamp: Date.now(),
    });
  }

  verifyCheckpoint(phase: '1' | '3'): { valid: boolean; violations: string[] } {
    const checkpoint = this.checksums.get(phase);
    if (!checkpoint) {
      return { valid: false, violations: [`No checkpoint for Phase ${phase}`] };
    }

    const violations: string[] = [];
    checkpoint.fileChecksums.forEach((expectedHash, filePath) => {
      if (!fs.existsSync(filePath)) {
        violations.push(`Phase ${phase} file missing: ${filePath}`);
        return;
      }
      const content = fs.readFileSync(filePath, 'utf-8');
      const actualHash = crypto.createHash('sha256').update(content).digest('hex');
      if (actualHash !== expectedHash) {
        violations.push(`Phase ${phase} file modified: ${filePath}`);
      }
    });

    return {
      valid: violations.length === 0,
      violations,
    };
  }
}
