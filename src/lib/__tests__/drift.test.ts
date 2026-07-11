import {
  detectDrift,
  detectFieldDrift,
  detectSchemaDrift,
  DriftAnalyzer,
  FieldDrift,
  SchemaDrift,
  Schema,
} from '../drift';

describe('Drift Detection - Phase 3', () => {
  describe('detectDrift()', () => {
    it('should detect no drift when objects are identical', () => {
      const before = { name: 'John', age: 30 };
      const after = { name: 'John', age: 30 };
      expect(detectDrift(before, after)).toBe(false);
    });

    it('should detect drift when primitive values change', () => {
      const before = 'value1';
      const after = 'value2';
      expect(detectDrift(before, after)).toBe(true);
    });

    it('should detect drift when object properties change', () => {
      const before = { name: 'John', age: 30 };
      const after = { name: 'John', age: 31 };
      expect(detectDrift(before, after)).toBe(true);
    });

    it('should detect drift when new properties are added', () => {
      const before = { name: 'John' };
      const after = { name: 'John', age: 30 };
      expect(detectDrift(before, after)).toBe(true);
    });

    it('should detect drift when properties are removed', () => {
      const before = { name: 'John', age: 30 };
      const after = { name: 'John' };
      expect(detectDrift(before, after)).toBe(true);
    });

    it('should handle null and undefined correctly', () => {
      expect(detectDrift(null, null)).toBe(false);
      expect(detectDrift(undefined, undefined)).toBe(false);
      expect(detectDrift(null, undefined)).toBe(true);
      expect(detectDrift(null, 'value')).toBe(true);
    });

    it('should handle type changes', () => {
      expect(detectDrift('123', 123)).toBe(true);
      expect(detectDrift(true, 1)).toBe(true);
      expect(detectDrift([], {})).toBe(true);
    });

    it('should detect drift in nested objects', () => {
      const before = { user: { name: 'John', address: { city: 'NYC' } } };
      const after = { user: { name: 'John', address: { city: 'LA' } } };
      expect(detectDrift(before, after)).toBe(true);
    });

    it('should handle deeply nested changes', () => {
      const before = { a: { b: { c: { d: { e: 1 } } } } };
      const after = { a: { b: { c: { d: { e: 2 } } } } };
      expect(detectDrift(before, after)).toBe(true);
    });

    it('should detect no drift in deeply nested identical objects', () => {
      const obj = { a: { b: { c: { d: { e: 1 } } } } };
      expect(detectDrift(obj, JSON.parse(JSON.stringify(obj)))).toBe(false);
    });
  });

  describe('detectFieldDrift()', () => {
    it('should detect no drift for unchanged field', () => {
      const before = { name: 'John', age: 30 };
      const after = { name: 'John', age: 30 };
      const result = detectFieldDrift('name', before, after);

      expect(result.field).toBe('name');
      expect(result.changed).toBe(false);
      expect(result.oldValue).toBe('John');
      expect(result.newValue).toBe('John');
    });

    it('should detect drift for changed field', () => {
      const before = { name: 'John', age: 30 };
      const after = { name: 'Jane', age: 30 };
      const result = detectFieldDrift('name', before, after);

      expect(result.field).toBe('name');
      expect(result.changed).toBe(true);
      expect(result.oldValue).toBe('John');
      expect(result.newValue).toBe('Jane');
    });

    it('should handle field that does not exist in before', () => {
      const before = { age: 30 };
      const after = { name: 'John', age: 30 };
      const result = detectFieldDrift('name', before, after);

      expect(result.changed).toBe(true);
      expect(result.oldValue).toBeUndefined();
      expect(result.newValue).toBe('John');
    });

    it('should handle field that does not exist in after', () => {
      const before = { name: 'John', age: 30 };
      const after = { age: 30 };
      const result = detectFieldDrift('name', before, after);

      expect(result.changed).toBe(true);
      expect(result.oldValue).toBe('John');
      expect(result.newValue).toBeUndefined();
    });

    it('should handle nested object field drift', () => {
      const before = { user: { name: 'John' } };
      const after = { user: { name: 'Jane' } };
      const result = detectFieldDrift('user', before, after);

      expect(result.changed).toBe(true);
      expect(result.oldValue).toEqual({ name: 'John' });
      expect(result.newValue).toEqual({ name: 'Jane' });
    });

    it('should handle array field drift', () => {
      const before = { tags: ['a', 'b'] };
      const after = { tags: ['a', 'b', 'c'] };
      const result = detectFieldDrift('tags', before, after);

      expect(result.changed).toBe(true);
      expect(result.oldValue).toEqual(['a', 'b']);
      expect(result.newValue).toEqual(['a', 'b', 'c']);
    });

    it('should handle null/undefined field values', () => {
      const before = { name: null };
      const after = { name: 'John' };
      const result = detectFieldDrift('name', before, after);

      expect(result.changed).toBe(true);
      expect(result.oldValue).toBeNull();
      expect(result.newValue).toBe('John');
    });

    it('should detect no drift for undefined before and after', () => {
      const result = detectFieldDrift('field', undefined, undefined);

      expect(result.changed).toBe(false);
      expect(result.oldValue).toBeUndefined();
      expect(result.newValue).toBeUndefined();
    });
  });

  describe('Array drift detection', () => {
    it('should detect drift in arrays with different lengths', () => {
      const before = ['a', 'b', 'c'];
      const after = ['a', 'b'];
      expect(detectDrift(before, after)).toBe(true);
    });

    it('should detect drift in arrays with different elements', () => {
      const before = ['a', 'b', 'c'];
      const after = ['a', 'b', 'd'];
      expect(detectDrift(before, after)).toBe(true);
    });

    it('should detect no drift in identical arrays', () => {
      const before = ['a', 'b', 'c'];
      const after = ['a', 'b', 'c'];
      expect(detectDrift(before, after)).toBe(false);
    });

    it('should handle nested arrays', () => {
      const before = [[1, 2], [3, 4]];
      const after = [[1, 2], [3, 5]];
      expect(detectDrift(before, after)).toBe(true);
    });

    it('should handle arrays of objects', () => {
      const before = [{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }];
      const after = [{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }];
      expect(detectDrift(before, after)).toBe(false);
    });

    it('should detect drift in array of objects', () => {
      const before = [{ id: 1, name: 'John' }];
      const after = [{ id: 1, name: 'Jane' }];
      expect(detectDrift(before, after)).toBe(true);
    });
  });

  describe('detectSchemaDrift()', () => {
    it('should validate record against schema', () => {
      const schema: Schema = {
        name: 'string',
        age: 'number',
        active: 'boolean',
      };
      const record = { name: 'John', age: 30, active: true };
      const result = detectSchemaDrift(record, schema);

      expect(result.valid).toBe(true);
      expect(result.drift).toHaveLength(0);
    });

    it('should detect type mismatch in schema', () => {
      const schema: Schema = { name: 'string', age: 'number' };
      const record = { name: 'John', age: 'thirty' };
      const result = detectSchemaDrift(record, schema);

      expect(result.valid).toBe(false);
      expect(result.drift).toHaveLength(1);
      expect(result.drift[0].field).toBe('age');
      expect(result.drift[0].issue).toContain('Type mismatch');
    });

    it('should detect missing required field', () => {
      const schema: Schema = { name: 'string', age: 'number' };
      const record = { name: 'John' };
      const result = detectSchemaDrift(record, schema);

      expect(result.valid).toBe(false);
      expect(result.drift.length).toBeGreaterThan(0);
      const ageDrift = result.drift.find((d) => d.field === 'age');
      expect(ageDrift).toBeDefined();
    });

    it('should detect unexpected fields in record', () => {
      const schema: Schema = { name: 'string' };
      const record = { name: 'John', age: 30, email: 'john@example.com' };
      const result = detectSchemaDrift(record, schema);

      expect(result.valid).toBe(false);
      const unexpectedDrifts = result.drift.filter((d) =>
        d.issue.includes('Unexpected')
      );
      expect(unexpectedDrifts.length).toBe(2);
    });

    it('should handle null values in schema validation', () => {
      const schema: Schema = { name: 'string', middle: 'string' };
      const record = { name: 'John', middle: null };
      const result = detectSchemaDrift(record, schema);

      expect(result.valid).toBe(false);
      const middleDrift = result.drift.find((d) => d.field === 'middle');
      expect(middleDrift).toBeDefined();
    });

    it('should handle complex schema with arrays and objects', () => {
      const schema: Schema = {
        name: 'string',
        tags: 'array',
        metadata: 'object',
      };
      const record = {
        name: 'John',
        tags: ['tag1', 'tag2'],
        metadata: { key: 'value' },
      };
      const result = detectSchemaDrift(record, schema);

      expect(result.valid).toBe(true);
      expect(result.drift).toHaveLength(0);
    });

    it('should support "any" type in schema', () => {
      const schema: Schema = { value: 'any' };
      const record1 = { value: 'string' };
      const record2 = { value: 123 };
      const record3 = { value: { nested: true } };

      expect(detectSchemaDrift(record1, schema).valid).toBe(true);
      expect(detectSchemaDrift(record2, schema).valid).toBe(true);
      expect(detectSchemaDrift(record3, schema).valid).toBe(true);
    });

    it('should validate empty record against empty schema', () => {
      const schema: Schema = {};
      const record = {};
      const result = detectSchemaDrift(record, schema);

      expect(result.valid).toBe(true);
      expect(result.drift).toHaveLength(0);
    });

    it('should handle null record gracefully', () => {
      const schema: Schema = { name: 'string' };
      const result = detectSchemaDrift(null, schema);

      expect(result.valid).toBe(false);
      expect(result.drift.length).toBeGreaterThan(0);
    });

    it('should detect multiple schema violations', () => {
      const schema: Schema = { name: 'string', age: 'number', active: 'boolean' };
      const record = { name: 123, age: 'thirty', active: 'yes' };
      const result = detectSchemaDrift(record, schema);

      expect(result.valid).toBe(false);
      expect(result.drift.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('DriftAnalyzer class', () => {
    let analyzer: DriftAnalyzer;

    beforeEach(() => {
      analyzer = new DriftAnalyzer();
    });

    it('should instantiate and have all required methods', () => {
      expect(analyzer).toBeDefined();
      expect(analyzer.detectDrift).toBeDefined();
      expect(analyzer.detectFieldDrift).toBeDefined();
      expect(analyzer.detectMultipleFieldDrifts).toBeDefined();
      expect(analyzer.detectSchemaDrift).toBeDefined();
      expect(analyzer.isValidAgainstSchema).toBeDefined();
      expect(analyzer.getDetailedDriftReport).toBeDefined();
    });

    it('detectDrift() method should work', () => {
      const before = { name: 'John' };
      const after = { name: 'Jane' };
      expect(analyzer.detectDrift(before, after)).toBe(true);
    });

    it('detectFieldDrift() method should work', () => {
      const before = { name: 'John', age: 30 };
      const after = { name: 'Jane', age: 30 };
      const result = analyzer.detectFieldDrift('name', before, after);
      expect(result.changed).toBe(true);
      expect(result.field).toBe('name');
    });

    it('detectMultipleFieldDrifts() should detect drift in multiple fields', () => {
      const before = { name: 'John', age: 30, city: 'NYC' };
      const after = { name: 'Jane', age: 31, city: 'NYC' };
      const results = analyzer.detectMultipleFieldDrifts(
        ['name', 'age', 'city'],
        before,
        after
      );

      expect(results).toHaveLength(3);
      expect(results[0].changed).toBe(true); // name
      expect(results[1].changed).toBe(true); // age
      expect(results[2].changed).toBe(false); // city
    });

    it('detectSchemaDrift() method should work', () => {
      const schema: Schema = { name: 'string', age: 'number' };
      const record = { name: 'John', age: 30 };
      const result = analyzer.detectSchemaDrift(record, schema);
      expect(result.valid).toBe(true);
    });

    it('isValidAgainstSchema() should validate records', () => {
      const schema: Schema = { name: 'string', age: 'number' };
      expect(analyzer.isValidAgainstSchema({ name: 'John', age: 30 }, schema)).toBe(true);
      expect(analyzer.isValidAgainstSchema({ name: 'John', age: 'thirty' }, schema)).toBe(
        false
      );
    });

    it('getDetailedDriftReport() should provide comprehensive analysis', () => {
      const before = { name: 'John', age: 30, city: 'NYC' };
      const after = { name: 'Jane', age: 31, city: 'NYC', country: 'USA' };
      const report = analyzer.getDetailedDriftReport(before, after);

      expect(report.hasDrift).toBe(true);
      expect(report.fieldDrifts).toBeDefined();
      expect(report.fieldDrifts.length).toBeGreaterThan(0);
      expect(report.summary).toContain('field(s) changed');
    });

    it('getDetailedDriftReport() should report no drift when identical', () => {
      const obj = { name: 'John', age: 30 };
      const report = analyzer.getDetailedDriftReport(obj, JSON.parse(JSON.stringify(obj)));

      expect(report.hasDrift).toBe(false);
      expect(report.summary).toContain('No drift detected');
    });
  });

  describe('Edge cases and complex scenarios', () => {
    it('should handle circular-free deep structures', () => {
      const before = {
        level1: {
          level2: {
            level3: {
              data: 'test',
            },
          },
        },
      };
      const after = {
        level1: {
          level2: {
            level3: {
              data: 'test',
            },
          },
        },
      };
      expect(detectDrift(before, after)).toBe(false);
    });

    it('should handle mixed type arrays', () => {
      const before = [1, 'two', true, null, { key: 'value' }];
      const after = [1, 'two', true, null, { key: 'value' }];
      expect(detectDrift(before, after)).toBe(false);
    });

    it('should handle empty collections', () => {
      expect(detectDrift([], [])).toBe(false);
      expect(detectDrift({}, {})).toBe(false);
      expect(detectDrift('', '')).toBe(false);
      expect(detectDrift(0, 0)).toBe(false);
    });

    it('should detect drift with special numeric values', () => {
      expect(detectDrift(0, -0)).toBe(false); // 0 and -0 are equal in JS
      expect(detectDrift(NaN, NaN)).toBe(true); // NaN !== NaN
      expect(detectDrift(Infinity, Infinity)).toBe(false);
    });

    it('should handle records with nested arrays of objects', () => {
      const before = {
        users: [
          { id: 1, name: 'John', tags: ['admin', 'user'] },
          { id: 2, name: 'Jane', tags: ['user'] },
        ],
      };
      const after = {
        users: [
          { id: 1, name: 'John', tags: ['admin', 'user'] },
          { id: 2, name: 'Jane', tags: ['user', 'moderator'] },
        ],
      };
      expect(detectDrift(before, after)).toBe(true);
    });

    it('should validate complex schema with various types', () => {
      const schema: Schema = {
        id: 'number',
        name: 'string',
        active: 'boolean',
        tags: 'array',
        config: 'object',
        notes: 'any',
      };
      const record = {
        id: 123,
        name: 'Test',
        active: true,
        tags: ['a', 'b'],
        config: { key: 'value' },
        notes: 'anything here',
      };
      const result = detectSchemaDrift(record, schema);
      expect(result.valid).toBe(true);
    });
  });
});
