/**
 * Phase 4: ValidationResult — structured validation response.
 */

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: ValidationError[];
  readonly warnings: ValidationWarning[];
}

export interface ValidationError {
  readonly code: string;
  readonly message: string;
  readonly field?: string;
  readonly value?: unknown;
}

export interface ValidationWarning {
  readonly code: string;
  readonly message: string;
  readonly field?: string;
}

export class ValidationResultBuilder {
  private errors: ValidationError[] = [];
  private warnings: ValidationWarning[] = [];

  addError(code: string, message: string, field?: string, value?: unknown) {
    this.errors.push({ code, message, field, value });
    return this;
  }

  addWarning(code: string, message: string, field?: string) {
    this.warnings.push({ code, message, field });
    return this;
  }

  build(): ValidationResult {
    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
    };
  }
}
