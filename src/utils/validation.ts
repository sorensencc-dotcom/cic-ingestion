export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class ValidationError extends Error {
  constructor(
    public errors: string[],
    public data?: any
  ) {
    super(`Validation failed: ${errors.join(", ")}`);
    this.name = "ValidationError";
  }
}

export function validateString(value: unknown, fieldName: string, minLength = 0, maxLength = Infinity): string {
  if (typeof value !== "string") {
    throw new ValidationError([`${fieldName} must be a string`], value);
  }

  if (value.length < minLength) {
    throw new ValidationError(
      [`${fieldName} must be at least ${minLength} characters`],
      value
    );
  }

  if (value.length > maxLength) {
    throw new ValidationError(
      [`${fieldName} must not exceed ${maxLength} characters`],
      value
    );
  }

  return value;
}

export function validateNumber(value: unknown, fieldName: string, min = -Infinity, max = Infinity): number {
  if (typeof value !== "number" || isNaN(value)) {
    throw new ValidationError([`${fieldName} must be a number`], value);
  }

  if (value < min) {
    throw new ValidationError([`${fieldName} must be at least ${min}`], value);
  }

  if (value > max) {
    throw new ValidationError([`${fieldName} must not exceed ${max}`], value);
  }

  return value;
}

export function validateArray(value: unknown, fieldName: string, minLength = 0, maxLength = Infinity): unknown[] {
  if (!Array.isArray(value)) {
    throw new ValidationError([`${fieldName} must be an array`], value);
  }

  if (value.length < minLength) {
    throw new ValidationError(
      [`${fieldName} must have at least ${minLength} items`],
      value
    );
  }

  if (value.length > maxLength) {
    throw new ValidationError(
      [`${fieldName} must not exceed ${maxLength} items`],
      value
    );
  }

  return value;
}

export function validateObject(value: unknown, fieldName: string): Record<string, any> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ValidationError([`${fieldName} must be an object`], value);
  }

  return value as Record<string, any>;
}

export function validateEnum(
  value: unknown,
  fieldName: string,
  allowedValues: readonly any[]
): any {
  if (!allowedValues.includes(value)) {
    throw new ValidationError(
      [`${fieldName} must be one of: ${allowedValues.join(", ")}`],
      value
    );
  }

  return value;
}

export function validateRequired(value: unknown, fieldName: string): unknown {
  if (value === null || value === undefined || value === "") {
    throw new ValidationError([`${fieldName} is required`], value);
  }

  return value;
}

export function validateJsonSchema(value: any, schema: any): ValidationResult {
  const errors: string[] = [];

  if (schema.type === "string" && typeof value !== "string") {
    errors.push(`Expected string, got ${typeof value}`);
  }

  if (schema.type === "number" && typeof value !== "number") {
    errors.push(`Expected number, got ${typeof value}`);
  }

  if (schema.type === "object" && typeof value !== "object") {
    errors.push(`Expected object, got ${typeof value}`);
  }

  if (schema.type === "array" && !Array.isArray(value)) {
    errors.push(`Expected array, got ${typeof value}`);
  }

  if (schema.required && Array.isArray(schema.required)) {
    for (const field of schema.required) {
      if (!(field in value)) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }

  if (schema.properties && typeof value === "object") {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (key in value) {
        const propResult = validateJsonSchema(value[key], propSchema as any);
        if (!propResult.valid) {
          errors.push(`${key}: ${propResult.errors.join(", ")}`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
