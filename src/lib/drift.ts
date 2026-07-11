/**
 * Phase 3: Drift Detection
 * Detects changes in value, type, or structure between before/after states
 * Handles null, undefined, nested objects, and arrays
 */

export interface FieldDrift {
  field: string;
  changed: boolean;
  oldValue: any;
  newValue: any;
}

export interface SchemaDrift {
  valid: boolean;
  drift: {
    field: string;
    issue: string;
    expected?: string;
    actual?: string;
  }[];
}

export interface Schema {
  [key: string]: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'any';
}

/**
 * Detects if any drift exists between two values
 * Compares by value and structure, not reference
 */
export function detectDrift(before: any, after: any): boolean {
  return !deepEquals(before, after);
}

/**
 * Detects drift for a specific field within two objects
 */
export function detectFieldDrift(
  field: string,
  before: any,
  after: any
): FieldDrift {
  const beforeValue = before?.[field];
  const afterValue = after?.[field];
  const changed = !deepEquals(beforeValue, afterValue);

  return {
    field,
    changed,
    oldValue: beforeValue,
    newValue: afterValue,
  };
}

/**
 * Detects if a record violates a schema and identifies drift
 */
export function detectSchemaDrift(record: any, schema: Schema): SchemaDrift {
  const drift: SchemaDrift['drift'] = [];

  // Check if record is null or not an object (unless schema is empty)
  if (record == null || typeof record !== 'object' || Array.isArray(record)) {
    if (Object.keys(schema).length > 0) {
      drift.push({
        field: '<root>',
        issue: 'Record is not a valid object',
        expected: 'object',
        actual: getType(record),
      });
      return {
        valid: false,
        drift,
      };
    }
  }

  // Check all schema fields
  for (const [field, expectedType] of Object.entries(schema)) {
    const value = record?.[field];
    const actualType = getType(value);

    if (!isTypeValid(value, expectedType, actualType)) {
      drift.push({
        field,
        issue: `Type mismatch`,
        expected: expectedType,
        actual: actualType,
      });
    }
  }

  // Check for extra fields in record not in schema
  if (record && typeof record === 'object' && !Array.isArray(record)) {
    for (const field of Object.keys(record)) {
      if (!(field in schema)) {
        drift.push({
          field,
          issue: `Unexpected field`,
          expected: 'none',
          actual: getType(record[field]),
        });
      }
    }
  }

  return {
    valid: drift.length === 0,
    drift,
  };
}

/**
 * DriftAnalyzer class - unified interface for drift detection operations
 */
export class DriftAnalyzer {
  /**
   * Detect overall drift between two objects
   */
  detectDrift(before: any, after: any): boolean {
    return detectDrift(before, after);
  }

  /**
   * Detect drift for specific fields
   */
  detectFieldDrift(field: string, before: any, after: any): FieldDrift {
    return detectFieldDrift(field, before, after);
  }

  /**
   * Detect multiple field drifts at once
   */
  detectMultipleFieldDrifts(
    fields: string[],
    before: any,
    after: any
  ): FieldDrift[] {
    return fields.map((field) => detectFieldDrift(field, before, after));
  }

  /**
   * Detect schema violations and drift
   */
  detectSchemaDrift(record: any, schema: Schema): SchemaDrift {
    return detectSchemaDrift(record, schema);
  }

  /**
   * Validate a record against a schema
   */
  isValidAgainstSchema(record: any, schema: Schema): boolean {
    return this.detectSchemaDrift(record, schema).valid;
  }

  /**
   * Get detailed drift report between two objects
   */
  getDetailedDriftReport(before: any, after: any): {
    hasDrift: boolean;
    fieldDrifts: FieldDrift[];
    summary: string;
  } {
    const hasDrift = this.detectDrift(before, after);
    const beforeKeys =
      before && typeof before === 'object' ? Object.keys(before) : [];
    const afterKeys = after && typeof after === 'object' ? Object.keys(after) : [];
    const allKeys = Array.from(new Set([...beforeKeys, ...afterKeys]));

    const fieldDrifts = allKeys.map((field) =>
      this.detectFieldDrift(field, before, after)
    );
    const changedFields = fieldDrifts.filter((d) => d.changed);

    return {
      hasDrift,
      fieldDrifts,
      summary:
        changedFields.length > 0
          ? `${changedFields.length} field(s) changed: ${changedFields.map((d) => d.field).join(', ')}`
          : 'No drift detected',
    };
  }
}

// Helper functions

/**
 * Deep equality check that handles nested structures
 */
function deepEquals(a: any, b: any): boolean {
  // Handle primitives and null/undefined
  if (a === b) return true;
  if (a == null || b == null) return a === b;

  // Handle different types
  if (typeof a !== typeof b) return false;

  // Check if one is array and other is not
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEquals(a[i], b[i])) return false;
    }
    return true;
  }

  // Handle objects
  if (typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();

    if (aKeys.length !== bKeys.length) return false;
    if (!deepEquals(aKeys, bKeys)) return false;

    for (const key of aKeys) {
      if (!deepEquals(a[key], b[key])) return false;
    }
    return true;
  }

  return false;
}

/**
 * Get the type of a value
 */
function getType(value: any): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Check if a value matches the expected type
 */
function isTypeValid(value: any, expectedType: string, actualType: string): boolean {
  // 'any' accepts any type
  if (expectedType === 'any') return true;

  // Check for null/undefined - reject for typed fields
  if (value == null) {
    return false; // null/undefined not allowed for any typed field
  }

  // Direct type match
  if (expectedType === actualType) return true;

  // Special cases (same as direct match but explicit)
  if (expectedType === 'number' && actualType === 'number') return true;
  if (expectedType === 'string' && actualType === 'string') return true;
  if (expectedType === 'boolean' && actualType === 'boolean') return true;
  if (expectedType === 'array' && actualType === 'array') return true;
  if (expectedType === 'object' && actualType === 'object') return true;

  return false;
}
