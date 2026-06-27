/**
 * Tests for WaylandSecurityPolicy
 */

import {
  WaylandSecurityPolicy,
  PolicyRule,
  ExecutionContext,
  createDefaultSecurityPolicy,
  createRestrictiveSecurityPolicy,
} from '../wayland-security-policy';

describe.skip('WaylandSecurityPolicy', () => {
  let policy: WaylandSecurityPolicy;

  beforeEach(() => {
    policy = new WaylandSecurityPolicy('allow', 10);
  });

  describe('initialization', () => {
    it('creates policy with default rules', () => {
      const rules = policy.getRules();
      expect(rules.length).toBeGreaterThan(0);
    });

    it('initializes with correct default action', () => {
      const testPolicy = new WaylandSecurityPolicy('deny', 5);
      expect(testPolicy).toBeDefined();
    });
  });

  describe('addRule', () => {
    it('adds a new rule', () => {
      const rule: PolicyRule = {
        id: 'test-rule-1',
        name: 'Test Rule',
        pattern: 'test_tool',
        action: 'allow',
        priority: 20,
      };

      policy.addRule(rule);
      const rules = policy.getRules();
      const added = rules.find((r) => r.id === 'test-rule-1');
      expect(added).toBeDefined();
    });

    it('rules are sorted by priority descending', () => {
      policy.addRule({
        id: 'low-priority',
        name: 'Low',
        pattern: 'low',
        action: 'allow',
        priority: 1,
      });

      policy.addRule({
        id: 'high-priority',
        name: 'High',
        pattern: 'high',
        action: 'allow',
        priority: 100,
      });

      const rules = policy.getRules();
      expect(rules[0].priority).toBeGreaterThanOrEqual(rules[1].priority);
    });
  });

  describe('removeRule', () => {
    it('removes an existing rule', () => {
      const rule: PolicyRule = {
        id: 'remove-me',
        name: 'Temp Rule',
        pattern: 'temp',
        action: 'allow',
        priority: 10,
      };

      policy.addRule(rule);
      const removed = policy.removeRule('remove-me');
      expect(removed).toBe(true);
    });

    it('returns false when removing non-existent rule', () => {
      const removed = policy.removeRule('non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('evaluate', () => {
    it('allows read operations by default', () => {
      const context: ExecutionContext = {
        toolName: 'readFile',
        userId: 'user1',
        cascadeDepth: 0,
      };

      const decision = policy.evaluate(context);
      expect(decision.allowed).toBe(true);
    });

    it('rejects shell execution', () => {
      const context: ExecutionContext = {
        toolName: 'bash',
        userId: 'user1',
        cascadeDepth: 0,
      };

      const decision = policy.evaluate(context);
      expect(decision.allowed).toBe(false);
      expect(decision.requiresApproval).toBe(true);
    });

    it('respects cascade depth limits', () => {
      const context: ExecutionContext = {
        toolName: 'readFile',
        userId: 'user1',
        cascadeDepth: 15, // Exceeds default limit of 10
      };

      const decision = policy.evaluate(context);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('depth');
    });

    it('denies write operations at excessive depth', () => {
      const context: ExecutionContext = {
        toolName: 'writeFile',
        userId: 'user1',
        cascadeDepth: 6, // Exceeds write depth limit of 5
      };

      const decision = policy.evaluate(context);
      expect(decision.allowed).toBe(false);
    });

    it('allows write operations at acceptable depth', () => {
      const context: ExecutionContext = {
        toolName: 'writeFile',
        userId: 'user1',
        cascadeDepth: 3, // Within write depth limit
      };

      const decision = policy.evaluate(context);
      expect(decision.allowed).toBe(true);
    });

    it('checks token limits', () => {
      policy.addRule({
        id: 'token-limit',
        name: 'Token Limit',
        pattern: 'expensive_tool',
        action: 'allow',
        priority: 50,
        conditions: {
          maxTokens: 1000,
        },
      });

      const context: ExecutionContext = {
        toolName: 'expensive_tool',
        userId: 'user1',
        cascadeDepth: 0,
        estimatedTokens: 2000,
      };

      const decision = policy.evaluate(context);
      expect(decision.allowed).toBe(false);
    });

    it('enforces role-based access control', () => {
      policy.addRule({
        id: 'admin-only',
        name: 'Admin Only',
        pattern: 'admin_tool',
        action: 'allow',
        priority: 60,
        conditions: {
          allowedRoles: ['admin'],
        },
      });

      const userContext: ExecutionContext = {
        toolName: 'admin_tool',
        userId: 'user1',
        cascadeDepth: 0,
        userRole: 'user',
      };

      const userDecision = policy.evaluate(userContext);
      expect(userDecision.allowed).toBe(false);

      const adminContext: ExecutionContext = {
        toolName: 'admin_tool',
        userId: 'admin1',
        cascadeDepth: 0,
        userRole: 'admin',
      };

      const adminDecision = policy.evaluate(adminContext);
      expect(adminDecision.allowed).toBe(true);
    });

    it('returns matched rule id in decision', () => {
      const context: ExecutionContext = {
        toolName: 'readFile',
        userId: 'user1',
        cascadeDepth: 0,
      };

      const decision = policy.evaluate(context);
      expect(decision.matchedRule).toBeDefined();
    });
  });

  describe('cascade depth limits', () => {
    it('enforces custom cascade depth limit', () => {
      policy.setCascadeDepthLimit(3);

      const context: ExecutionContext = {
        toolName: 'readFile',
        userId: 'user1',
        cascadeDepth: 4,
      };

      const decision = policy.evaluate(context);
      expect(decision.allowed).toBe(false);
    });
  });

  describe('default action', () => {
    it('allows by default when set to allow', () => {
      const context: ExecutionContext = {
        toolName: 'unknownTool',
        userId: 'user1',
        cascadeDepth: 0,
      };

      const decision = policy.evaluate(context);
      expect(decision.allowed).toBe(true);
    });

    it('denies by default when set to deny', () => {
      policy.setDefaultAction('deny');

      const context: ExecutionContext = {
        toolName: 'unknownTool',
        userId: 'user1',
        cascadeDepth: 0,
      };

      const decision = policy.evaluate(context);
      expect(decision.allowed).toBe(false);
    });
  });

  describe('isToolAllowed', () => {
    it('checks if tool is allowed', () => {
      expect(policy.isToolAllowed('readFile')).toBe(true);
      expect(policy.isToolAllowed('bash')).toBe(false);
    });
  });

  describe('validateExecution', () => {
    it('validates execution context', () => {
      const context: ExecutionContext = {
        toolName: 'queryDatabase',
        userId: 'user1',
        cascadeDepth: 2,
      };

      const decision = policy.validateExecution(context);
      expect(decision).toHaveProperty('allowed');
      expect(decision).toHaveProperty('reason');
    });
  });

  describe('factory functions', () => {
    it('creates default security policy', () => {
      const defaultPolicy = createDefaultSecurityPolicy();
      expect(defaultPolicy).toBeDefined();
      expect(defaultPolicy.isToolAllowed('readFile')).toBe(true);
    });

    it('creates restrictive security policy', () => {
      const restrictivePolicy = createRestrictiveSecurityPolicy();
      expect(restrictivePolicy).toBeDefined();
      expect(restrictivePolicy.isToolAllowed('unknownTool')).toBe(false);
    });
  });

  describe('regex patterns', () => {
    it('supports regex patterns in rules', () => {
      policy.addRule({
        id: 'regex-rule',
        name: 'Regex Rule',
        pattern: /^(create|delete|modify)_.*/i,
        action: 'deny',
        priority: 70,
      });

      expect(policy.isToolAllowed('CREATE_TABLE')).toBe(false);
      expect(policy.isToolAllowed('modify_user')).toBe(false);
      expect(policy.isToolAllowed('readFile')).toBe(true);
    });
  });

  describe('multiple rules matching', () => {
    it('uses highest priority rule when multiple match', () => {
      policy.addRule({
        id: 'low-priority-allow',
        name: 'Low Priority Allow',
        pattern: 'test_tool',
        action: 'allow',
        priority: 5,
      });

      policy.addRule({
        id: 'high-priority-deny',
        name: 'High Priority Deny',
        pattern: 'test_tool',
        action: 'deny',
        priority: 99,
      });

      const context: ExecutionContext = {
        toolName: 'test_tool',
        userId: 'user1',
        cascadeDepth: 0,
      };

      const decision = policy.evaluate(context);
      expect(decision.allowed).toBe(false); // Highest priority wins
      expect(decision.matchedRule).toBe('high-priority-deny');
    });
  });
});
