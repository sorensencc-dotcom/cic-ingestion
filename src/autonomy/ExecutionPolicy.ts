/**
 * Execution Mode & Policy Engine
 *
 * Prevents permission prompts in unattended automation by enforcing pre-approved tool sets
 * before harness sees the tool call. Harness permission system is last line of defense only.
 */

import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';

/**
 * Execution context determines how permission checks behave
 */
export enum ExecutionMode {
  /** Default: current behavior, prompts user for unauthorized tools */
  INTERACTIVE = 'INTERACTIVE',

  /** Scheduled/automated: skips prompts, fails fast on unauthorized tools */
  UNATTENDED = 'UNATTENDED',

  /** Multi-step task: single upfront approval covers all calls in batch */
  BATCH = 'BATCH',

  /** Service/daemon: pre-approved trusted pattern set */
  MAINTENANCE = 'MAINTENANCE',
}

/**
 * Mode settings loaded from .claude/settings.json
 */
export interface ModeSettings {
  description?: string;
  preapprovedTools?: string[];
  exitOnUnauthorized?: boolean;
  timeout?: number;
  allowsAgentSpawn?: boolean;
  allowsUserInteraction?: boolean;
}

/**
 * Metadata for a task execution context
 */
export interface ExecutionContext {
  /** Unique task identifier */
  taskId: string;

  /** Execution mode */
  mode: ExecutionMode;

  /** Tools explicitly pre-approved for this task */
  preapprovedTools: string[];

  /** Whether to fail fast on unauthorized tools (vs waiting for prompt) */
  exitOnUnauthorized: boolean;

  /** Task timeout in seconds */
  timeout?: number;

  /** Whether to audit all tool calls */
  auditLog?: boolean;

  /** Creation timestamp */
  createdAt?: Date;
}

/**
 * Policy rules for each execution mode
 */
interface ModePolicy {
  /** Tools allowed in this mode (glob patterns) */
  allowed: string[];

  /** Tools explicitly denied in this mode */
  denied?: string[];

  /** Whether pre-approval is required */
  requirePreapproval?: boolean;

  /** Max calls in batch (for BATCH mode) */
  batchSize?: number;
}

/**
 * Load execution mode settings from .claude/settings.json
 */
function loadModeSettingsFromFile(): Record<ExecutionMode, ModeSettings> | null {
  try {
    // Try to read from Claude project settings
    const claudeDir = path.join(homedir(), '.claude');
    const settingsPath = path.join(claudeDir, 'settings.json');

    if (fs.existsSync(settingsPath)) {
      const content = fs.readFileSync(settingsPath, 'utf-8');
      const settings = JSON.parse(content);
      if (settings.executionModes) {
        return settings.executionModes as Record<ExecutionMode, ModeSettings>;
      }
    }
  } catch (err) {
    // Silently fail, use defaults
  }
  return null;
}

/**
 * Policy engine: decides if a tool call is allowed in current execution context
 */
export class ExecutionPolicyEngine {
  private modeSettings: Record<ExecutionMode, ModeSettings> | null;
  private policies: Map<ExecutionMode, ModePolicy> = new Map([
    [
      ExecutionMode.INTERACTIVE,
      {
        allowed: ['*'], // Allow all tools
        requirePreapproval: false,
      },
    ],
    [
      ExecutionMode.UNATTENDED,
      {
        allowed: [
          'Bash(docker-*)',
          'Bash(docker-compose *)',
          'Bash(npm *)',
          'Bash(npm test)',
          'Bash(npm run *)',
          'Bash(git *)',
          'Bash(git status)',
          'Bash(git log *)',
          'Bash(git diff *)',
          'Bash(git commit *)',
          'Bash(git push *)',
          'PowerShell(docker *)',
          'PowerShell(docker-compose *)',
          'Read',
          'Grep',
          'Glob',
          'Edit',
          'Write',
          'Bash',
        ],
        denied: [
          'Agent(*)', // No spawning agents in unattended mode
          'AskUserQuestion', // No user interaction
          'ScheduleWakeup', // No recursive scheduling
        ],
        requirePreapproval: true,
      },
    ],
    [
      ExecutionMode.BATCH,
      {
        allowed: [
          'Bash(docker-*)',
          'Bash(docker-compose *)',
          'Bash(npm *)',
          'Bash(git *)',
          'PowerShell(docker *)',
          'PowerShell(docker-compose *)',
          'Read',
          'Grep',
          'Glob',
          'Edit',
          'Write',
          'Bash',
        ],
        denied: ['Agent(*)', 'AskUserQuestion', 'ScheduleWakeup'],
        requirePreapproval: false, // Single upfront approval
        batchSize: 50,
      },
    ],
    [
      ExecutionMode.MAINTENANCE,
      {
        allowed: [
          'Bash(docker *)',
          'Bash(npm *)',
          'Bash(git *)',
          'PowerShell(docker *)',
          'Read',
          'Grep',
          'Bash',
        ],
        denied: ['Agent(*)', 'AskUserQuestion'],
        requirePreapproval: true,
      },
    ],
  ]);

  constructor() {
    this.modeSettings = loadModeSettingsFromFile();
  }

  /**
   * Get mode settings from file or defaults
   */
  getModeSettings(mode: ExecutionMode): ModeSettings {
    if (this.modeSettings && this.modeSettings[mode]) {
      return this.modeSettings[mode];
    }
    // Return empty defaults if not found
    return {};
  }

  /**
   * Merge task context with mode settings defaults
   * Task context takes precedence over settings defaults
   */
  mergeContextWithSettings(context: ExecutionContext): ExecutionContext {
    const modeSettings = this.getModeSettings(context.mode);

    return {
      ...context,
      // Settings defaults fill in missing values
      preapprovedTools: context.preapprovedTools?.length
        ? context.preapprovedTools
        : (modeSettings.preapprovedTools || []),
      exitOnUnauthorized: context.exitOnUnauthorized ?? (modeSettings.exitOnUnauthorized ?? false),
      timeout: context.timeout ?? (modeSettings.timeout ?? 3600),
    };
  }

  /**
   * Check if tool is allowed in given execution context
   */
  isToolAllowed(tool: string, context: ExecutionContext): boolean {
    const policy = this.policies.get(context.mode);
    if (!policy) {
      throw new Error(`Unknown execution mode: ${context.mode}`);
    }

    // Check explicitly denied first
    if (policy.denied && this.matchesPattern(tool, policy.denied)) {
      return false;
    }

    // Check allowed
    if (this.matchesPattern(tool, policy.allowed)) {
      return true;
    }

    // If mode requires pre-approval and tool is pre-approved, allow
    if (policy.requirePreapproval && context.preapprovedTools) {
      if (this.matchesPattern(tool, context.preapprovedTools)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get pre-approved tools for this context (what can run without further checks)
   */
  getPreapprovedTools(context: ExecutionContext): string[] {
    const policy = this.policies.get(context.mode);
    if (!policy) {
      throw new Error(`Unknown execution mode: ${context.mode}`);
    }

    if (context.mode === ExecutionMode.INTERACTIVE) {
      return []; // No pre-approval needed
    }

    return context.preapprovedTools || [];
  }

  /**
   * Simple glob-style pattern matching
   * Supports: exact match, * wildcard, ** greedy match
   */
  private matchesPattern(value: string, patterns: string[]): boolean {
    for (const pattern of patterns) {
      if (pattern === '*') return true;
      if (pattern === value) return true;
      if (pattern.includes('*')) {
        // Escape all regex special chars except * (which becomes .*)
        const escaped = pattern
          .replace(/[.+^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*');
        const regex = new RegExp(`^${escaped}$`);
        if (regex.test(value)) return true;
      }
    }
    return false;
  }

  /**
   * Validate ExecutionContext before task execution
   */
  validateContext(context: ExecutionContext): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!context.taskId) {
      errors.push('taskId is required');
    }

    if (!context.mode) {
      errors.push('mode is required');
    } else if (!Object.values(ExecutionMode).includes(context.mode)) {
      errors.push(`mode must be one of: ${Object.values(ExecutionMode).join(', ')}`);
    }

    const policy = this.policies.get(context.mode);
    if (policy?.requirePreapproval && (!context.preapprovedTools || context.preapprovedTools.length === 0)) {
      errors.push(
        `mode ${context.mode} requires at least one preapprovedTool`
      );
    }

    if (context.timeout && context.timeout < 10) {
      errors.push('timeout must be >= 10 seconds');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Global policy engine instance
 */
let globalEngine: ExecutionPolicyEngine | null = null;

export function getExecutionPolicyEngine(): ExecutionPolicyEngine {
  if (!globalEngine) {
    globalEngine = new ExecutionPolicyEngine();
  }
  return globalEngine;
}
