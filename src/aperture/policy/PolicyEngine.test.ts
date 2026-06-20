/**
 * Phase 27: Aperture — Policy Engine Tests
 */

import { PolicyEngine, createDefaultPolicyEngine } from './PolicyEngine';
import { PolicyDefinition } from '../types';

describe('PolicyEngine', () => {
  let engine: PolicyEngine;

  beforeEach(() => {
    engine = new PolicyEngine();
  });

  describe('load()', () => {
    it('should load valid policy', () => {
      const policy: PolicyDefinition = {
        name: 'test-policy',
        agent: 'test-agent',
        version: '1.0.0',
        allow: ['http.get'],
        limits: {
          max_calls: 50,
          max_bytes: 5242880,
          max_concurrent: 3,
          max_depth: 4,
          rate_limit_qps: 10
        }
      };

      expect(() => engine.load(policy)).not.toThrow();
      expect(engine.getPolicyForAgent('test-agent')).toBeDefined();
    });

    it('should reject policy without agent', () => {
      const policy = {
        name: 'bad',
        agent: '',
        version: '1.0.0',
        allow: ['http.get'],
        limits: {
          max_calls: 50,
          max_bytes: 5242880,
          max_concurrent: 3,
          max_depth: 4,
          rate_limit_qps: 10
        }
      } as any;

      expect(() => engine.load(policy)).toThrow();
    });

    it('should reject policy without allow list', () => {
      const policy = {
        name: 'bad',
        agent: 'test',
        version: '1.0.0',
        allow: [],
        limits: {
          max_calls: 50,
          max_bytes: 5242880,
          max_concurrent: 3,
          max_depth: 4,
          rate_limit_qps: 10
        }
      } as any;

      expect(() => engine.load(policy)).toThrow();
    });

    it('should reject policy without limits', () => {
      const policy = {
        name: 'bad',
        agent: 'test',
        version: '1.0.0',
        allow: ['http.get']
      } as any;

      expect(() => engine.load(policy)).toThrow();
    });

    it('should allow updating existing policy', () => {
      const policy1: PolicyDefinition = {
        name: 'policy',
        agent: 'test',
        version: '1.0.0',
        allow: ['http.get'],
        limits: {
          max_calls: 50,
          max_bytes: 5242880,
          max_concurrent: 3,
          max_depth: 4,
          rate_limit_qps: 10
        }
      };

      const policy2 = {
        ...policy1,
        version: '2.0.0',
        allow: ['http.get', 'http.post']
      };

      engine.load(policy1);
      engine.load(policy2);

      const retrieved = engine.getPolicyForAgent('test');
      expect(retrieved?.allow).toContain('http.post');
    });
  });

  describe('authorize()', () => {
    beforeEach(() => {
      engine.load({
        name: 'test-policy',
        agent: 'harvester',
        version: '1.0.0',
        allow: ['http.get', 'file.write'],
        deny: ['shell.exec'],
        limits: {
          max_calls: 50,
          max_bytes: 5242880,
          max_concurrent: 3,
          max_depth: 4,
          rate_limit_qps: 10
        }
      });
    });

    it('should authorize allowed adapter', () => {
      const result = engine.authorize('harvester', 'http.get');
      expect(result.allowed).toBe(true);
      expect(result.cost).toBeDefined();
    });

    it('should deny adapter not in allow list', () => {
      const result = engine.authorize('harvester', 'browser.navigate');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not in allow list');
    });

    it('should deny adapter in deny list', () => {
      const result = engine.authorize('harvester', 'shell.exec');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('deny list');
    });

    it('should deny for unknown agent', () => {
      const result = engine.authorize('unknown-agent', 'http.get');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('No policy found');
    });
  });

  describe('preApproval()', () => {
    it('should require approval for specified adapters', () => {
      engine.load({
        name: 'policy',
        agent: 'harvester',
        version: '1.0.0',
        allow: ['http.get', 'model.generate'],
        limits: {
          max_calls: 50,
          max_bytes: 5242880,
          max_concurrent: 3,
          max_depth: 4,
          rate_limit_qps: 10
        },
        safety: {
          require_approval_for: ['model.generate']
        }
      });

      expect(engine.preApproval('harvester', 'model.generate')).toBe(true);
      expect(engine.preApproval('harvester', 'http.get')).toBe(false);
    });

    it('should not require approval if not specified', () => {
      engine.load({
        name: 'policy',
        agent: 'explorer',
        version: '1.0.0',
        allow: ['http.get'],
        limits: {
          max_calls: 100,
          max_bytes: 10485760,
          max_concurrent: 5,
          max_depth: 6,
          rate_limit_qps: 20
        }
      });

      expect(engine.preApproval('explorer', 'http.get')).toBe(false);
    });
  });

  describe('checkLimits()', () => {
    beforeEach(() => {
      engine.load({
        name: 'policy',
        agent: 'harvester',
        version: '1.0.0',
        allow: ['http.get'],
        limits: {
          max_calls: 50,
          max_bytes: 5242880,
          max_concurrent: 3,
          max_depth: 4,
          rate_limit_qps: 10
        }
      });
    });

    it('should pass limit check when under limit', () => {
      const result = engine.checkLimits('harvester', 'calls');
      expect(result.ok).toBe(true);
      expect(result.current).toBe(0);
      expect(result.limit).toBe(50);
    });

    it('should fail limit check when at limit', () => {
      for (let i = 0; i < 50; i++) {
        engine.incrementLimit('harvester', 'calls');
      }

      const result = engine.checkLimits('harvester', 'calls');
      expect(result.ok).toBe(false);
      expect(result.current).toBe(50);
    });

    it('should check bytes limit', () => {
      engine.incrementLimit('harvester', 'bytes', 5242880);
      const result = engine.checkLimits('harvester', 'bytes');
      expect(result.ok).toBe(false);
    });

    it('should check depth limit', () => {
      for (let i = 0; i < 4; i++) {
        engine.incrementLimit('harvester', 'depth');
      }
      expect(engine.checkLimits('harvester', 'depth').ok).toBe(false);
    });

    it('should check QPS limit', () => {
      for (let i = 0; i < 10; i++) {
        engine.incrementLimit('harvester', 'qps');
      }
      expect(engine.checkLimits('harvester', 'qps').ok).toBe(false);
    });

    it('should return zeros for unknown agent', () => {
      const result = engine.checkLimits('unknown', 'calls');
      expect(result.ok).toBe(false);
      expect(result.current).toBe(0);
      expect(result.limit).toBe(0);
    });
  });

  describe('incrementLimit()', () => {
    beforeEach(() => {
      engine.load({
        name: 'policy',
        agent: 'test',
        version: '1.0.0',
        allow: ['http.get'],
        limits: {
          max_calls: 50,
          max_bytes: 5242880,
          max_concurrent: 3,
          max_depth: 4,
          rate_limit_qps: 10
        }
      });
    });

    it('should increment counter', () => {
      engine.incrementLimit('test', 'calls');
      const result = engine.checkLimits('test', 'calls');
      expect(result.current).toBe(1);
    });

    it('should increment by custom amount', () => {
      engine.incrementLimit('test', 'bytes', 1000);
      const result = engine.checkLimits('test', 'bytes');
      expect(result.current).toBe(1000);
    });

    it('should accumulate increments', () => {
      engine.incrementLimit('test', 'calls');
      engine.incrementLimit('test', 'calls');
      engine.incrementLimit('test', 'calls');
      const result = engine.checkLimits('test', 'calls');
      expect(result.current).toBe(3);
    });
  });

  describe('resetLimits()', () => {
    it('should reset all counters for agent', () => {
      engine.load({
        name: 'policy',
        agent: 'test',
        version: '1.0.0',
        allow: ['http.get'],
        limits: {
          max_calls: 50,
          max_bytes: 5242880,
          max_concurrent: 3,
          max_depth: 4,
          rate_limit_qps: 10
        }
      });

      engine.incrementLimit('test', 'calls', 25);
      engine.incrementLimit('test', 'bytes', 1000);

      engine.resetLimits('test');

      expect(engine.checkLimits('test', 'calls').current).toBe(0);
      expect(engine.checkLimits('test', 'bytes').current).toBe(0);
    });
  });

  describe('getApprovalThreshold()', () => {
    it('should return custom threshold', () => {
      engine.load({
        name: 'policy',
        agent: 'test',
        version: '1.0.0',
        allow: ['http.get'],
        limits: {
          max_calls: 50,
          max_bytes: 5242880,
          max_concurrent: 3,
          max_depth: 4,
          rate_limit_qps: 10
        },
        safety: {
          min_approval_confidence: 0.95
        }
      });

      expect(engine.getApprovalThreshold('test')).toBe(0.95);
    });

    it('should return default threshold', () => {
      engine.load({
        name: 'policy',
        agent: 'test',
        version: '1.0.0',
        allow: ['http.get'],
        limits: {
          max_calls: 50,
          max_bytes: 5242880,
          max_concurrent: 3,
          max_depth: 4,
          rate_limit_qps: 10
        }
      });

      expect(engine.getApprovalThreshold('test')).toBe(0.8);
    });
  });

  describe('getRedactFields()', () => {
    it('should return custom redact fields', () => {
      engine.load({
        name: 'policy',
        agent: 'test',
        version: '1.0.0',
        allow: ['http.get'],
        limits: {
          max_calls: 50,
          max_bytes: 5242880,
          max_concurrent: 3,
          max_depth: 4,
          rate_limit_qps: 10
        },
        audit: {
          redact_fields: ['password', 'token']
        }
      });

      expect(engine.getRedactFields('test')).toEqual(['password', 'token']);
    });

    it('should return default redact fields', () => {
      engine.load({
        name: 'policy',
        agent: 'test',
        version: '1.0.0',
        allow: ['http.get'],
        limits: {
          max_calls: 50,
          max_bytes: 5242880,
          max_concurrent: 3,
          max_depth: 4,
          rate_limit_qps: 10
        }
      });

      const fields = engine.getRedactFields('test');
      expect(fields).toContain('Authorization');
      expect(fields).toContain('api_key');
    });
  });

  describe('shouldLogAll()', () => {
    it('should return true when log_all enabled', () => {
      engine.load({
        name: 'policy',
        agent: 'test',
        version: '1.0.0',
        allow: ['http.get'],
        limits: {
          max_calls: 50,
          max_bytes: 5242880,
          max_concurrent: 3,
          max_depth: 4,
          rate_limit_qps: 10
        },
        audit: {
          log_all: true
        }
      });

      expect(engine.shouldLogAll('test')).toBe(true);
    });

    it('should return true by default', () => {
      engine.load({
        name: 'policy',
        agent: 'test',
        version: '1.0.0',
        allow: ['http.get'],
        limits: {
          max_calls: 50,
          max_bytes: 5242880,
          max_concurrent: 3,
          max_depth: 4,
          rate_limit_qps: 10
        }
      });

      expect(engine.shouldLogAll('test')).toBe(true);
    });
  });

  describe('allowDestructive()', () => {
    it('should disallow destructive when no_destructive=true', () => {
      engine.load({
        name: 'policy',
        agent: 'test',
        version: '1.0.0',
        allow: ['shell.exec'],
        limits: {
          max_calls: 50,
          max_bytes: 5242880,
          max_concurrent: 3,
          max_depth: 4,
          rate_limit_qps: 10
        },
        safety: {
          no_destructive: true
        }
      });

      expect(engine.allowDestructive('test')).toBe(false);
    });

    it('should allow destructive by default', () => {
      engine.load({
        name: 'policy',
        agent: 'test',
        version: '1.0.0',
        allow: ['shell.exec'],
        limits: {
          max_calls: 50,
          max_bytes: 5242880,
          max_concurrent: 3,
          max_depth: 4,
          rate_limit_qps: 10
        }
      });

      expect(engine.allowDestructive('test')).toBe(true);
    });
  });

  describe('getAllowedDomains()', () => {
    it('should return allowed domains', () => {
      engine.load({
        name: 'policy',
        agent: 'test',
        version: '1.0.0',
        allow: ['http.get'],
        limits: {
          max_calls: 50,
          max_bytes: 5242880,
          max_concurrent: 3,
          max_depth: 4,
          rate_limit_qps: 10
        },
        credentials: {
          allowed_domains: ['api.example.com', 'cdn.example.com']
        }
      });

      expect(engine.getAllowedDomains('test')).toEqual(['api.example.com', 'cdn.example.com']);
    });

    it('should return null when unrestricted', () => {
      engine.load({
        name: 'policy',
        agent: 'test',
        version: '1.0.0',
        allow: ['http.get'],
        limits: {
          max_calls: 50,
          max_bytes: 5242880,
          max_concurrent: 3,
          max_depth: 4,
          rate_limit_qps: 10
        }
      });

      expect(engine.getAllowedDomains('test')).toBeNull();
    });
  });

  describe('getAllowedHeaders()', () => {
    it('should return allowed headers', () => {
      engine.load({
        name: 'policy',
        agent: 'test',
        version: '1.0.0',
        allow: ['http.get'],
        limits: {
          max_calls: 50,
          max_bytes: 5242880,
          max_concurrent: 3,
          max_depth: 4,
          rate_limit_qps: 10
        },
        credentials: {
          http_headers: ['Authorization', 'User-Agent']
        }
      });

      expect(engine.getAllowedHeaders('test')).toEqual(['Authorization', 'User-Agent']);
    });

    it('should return empty array by default', () => {
      engine.load({
        name: 'policy',
        agent: 'test',
        version: '1.0.0',
        allow: ['http.get'],
        limits: {
          max_calls: 50,
          max_bytes: 5242880,
          max_concurrent: 3,
          max_depth: 4,
          rate_limit_qps: 10
        }
      });

      expect(engine.getAllowedHeaders('test')).toEqual([]);
    });
  });

  describe('listAll()', () => {
    it('should list all loaded policies', () => {
      engine.load({
        name: 'policy1',
        agent: 'agent1',
        version: '1.0.0',
        allow: ['http.get'],
        limits: {
          max_calls: 50,
          max_bytes: 5242880,
          max_concurrent: 3,
          max_depth: 4,
          rate_limit_qps: 10
        }
      });

      engine.load({
        name: 'policy2',
        agent: 'agent2',
        version: '1.0.0',
        allow: ['file.read'],
        limits: {
          max_calls: 100,
          max_bytes: 10485760,
          max_concurrent: 5,
          max_depth: 6,
          rate_limit_qps: 20
        }
      });

      const all = engine.listAll();
      expect(all.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('checkDomain()', () => {
    beforeEach(() => {
      engine.load({
        name: 'policy',
        agent: 'test',
        version: '1.0.0',
        allow: ['http.get'],
        limits: {
          max_calls: 50,
          max_bytes: 5242880,
          max_concurrent: 3,
          max_depth: 4,
          rate_limit_qps: 10
        },
        credentials: {
          allowed_domains: ['api.example.com', 'cdn.example.com']
        }
      });
    });

    it('should allow domain in whitelist', () => {
      expect(engine.checkDomain('test', 'api.example.com')).toBe(true);
    });

    it('should deny domain not in whitelist', () => {
      expect(engine.checkDomain('test', 'evil.com')).toBe(false);
    });

    it('should allow any domain if unrestricted', () => {
      engine.load({
        name: 'open-policy',
        agent: 'open-agent',
        version: '1.0.0',
        allow: ['http.get'],
        limits: {
          max_calls: 50,
          max_bytes: 5242880,
          max_concurrent: 3,
          max_depth: 4,
          rate_limit_qps: 10
        }
      });

      expect(engine.checkDomain('open-agent', 'anything.com')).toBe(true);
    });
  });

  describe('getLimits()', () => {
    it('should return policy limits', () => {
      engine.load({
        name: 'policy',
        agent: 'test',
        version: '1.0.0',
        allow: ['http.get'],
        limits: {
          max_calls: 50,
          max_bytes: 5242880,
          max_concurrent: 3,
          max_depth: 4,
          rate_limit_qps: 10
        }
      });

      const limits = engine.getLimits('test');
      expect(limits?.max_calls).toBe(50);
      expect(limits?.max_bytes).toBe(5242880);
    });

    it('should return null for unknown agent', () => {
      expect(engine.getLimits('unknown')).toBeNull();
    });
  });
});

describe('createDefaultPolicyEngine()', () => {
  it('should create engine with harvester policy', () => {
    const engine = createDefaultPolicyEngine();
    const policy = engine.getPolicyForAgent('harvester');

    expect(policy).toBeDefined();
    expect(policy?.name).toBe('harvester-default');
  });

  it('should have harvester allow http.get', () => {
    const engine = createDefaultPolicyEngine();
    const result = engine.authorize('harvester', 'http.get');
    expect(result.allowed).toBe(true);
  });

  it('should deny shell.exec for harvester', () => {
    const engine = createDefaultPolicyEngine();
    const result = engine.authorize('harvester', 'shell.exec');
    expect(result.allowed).toBe(false);
  });

  it('should create explorer policy', () => {
    const engine = createDefaultPolicyEngine();
    const policy = engine.getPolicyForAgent('explorer');

    expect(policy).toBeDefined();
    expect(policy?.name).toBe('explorer-default');
  });

  it('explorer should be read-only', () => {
    const engine = createDefaultPolicyEngine();

    expect(engine.authorize('explorer', 'http.get').allowed).toBe(true);
    expect(engine.authorize('explorer', 'file.read').allowed).toBe(true);
    expect(engine.authorize('explorer', 'file.write').allowed).toBe(false);
    expect(engine.authorize('explorer', 'shell.exec').allowed).toBe(false);
  });
});
