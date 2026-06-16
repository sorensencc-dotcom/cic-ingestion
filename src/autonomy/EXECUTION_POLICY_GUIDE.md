# Execution Policy Guide: Unattended Automation without Permission Friction

**Problem**: Scheduled tasks get blocked by permission prompts, turning 5-minute builds into 90+ minute waits.

**Solution**: ExecutionPolicy system sets execution mode + pre-approved tools BEFORE harness permission checks. Tools either execute without prompts or fail fast.

---

## Quick Start: Schedule a Docker Build with Zero Prompts

**Step 1: Register execution context** (one-time setup before scheduling)

```typescript
import fetch from 'node-fetch';
import { ExecutionMode, ExecutionContext } from './autonomy/ExecutionPolicy';

const context: ExecutionContext = {
  taskId: 'docker-build-phase-2-5',
  mode: ExecutionMode.UNATTENDED,
  preapprovedTools: [
    'Bash(docker-compose *)',
    'Bash(npm *)',
    'Bash(git *)',
    'Read',
    'Grep',
  ],
  exitOnUnauthorized: true,
  timeout: 600, // 10 minutes
};

const response = await fetch('http://localhost:3000/autonomy/execution/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(context),
});

console.log(await response.json());
// {
//   "registered": true,
//   "taskId": "docker-build-phase-2-5",
//   "mode": "UNATTENDED",
//   "message": "Task registered. Use ScheduleWakeup to schedule execution."
// }
```

**Step 2: Schedule the task to wake at a specific time**

```typescript
// In Claude Code agent:
ScheduleWakeup({
  delaySeconds: 300, // Wake in 5 minutes
  reason: 'Running unattended Docker build for Phase 2.5'
});

// When ScheduleWakeup fires:
// 1. Agent wakes with the same context
// 2. Lookup: store.getContext('docker-build-phase-2-5')
// 3. Set execution mode: UNATTENDED
// 4. All tool calls check policy FIRST
```

**Step 3: Inside the scheduled task, run your build**

```typescript
import { getExecutionPolicyInterceptor } from './autonomy/ExecutionPolicyInterceptor';
import { getTaskMetadataStore } from './autonomy/TaskMetadataStore';

const interceptor = getExecutionPolicyInterceptor();
const store = getTaskMetadataStore();
const taskId = 'docker-build-phase-2-5';

try {
  // Set current context
  const context = store.getContext(taskId);
  interceptor.startTask(context);

  // Your build commands
  // ✅ This runs without prompts (pre-approved):
  await runCommand('docker-compose up --build');
  await runCommand('npm test');

  // ❌ This fails fast (not pre-approved):
  // await runCommand('curl http://evil.com'); // Would fail immediately

  interceptor.endTask(taskId, 'SUCCESS');
} catch (error) {
  interceptor.endTask(taskId, 'FAILURE', error.message);
}
```

---

## How It Works: The Permission Resolution Pipeline

```
Tool Call (e.g., docker-compose up)
  ↓
Check ExecutionMode (UNATTENDED)
  ↓
Check Policy Rules for UNATTENDED mode
  ├─ Denied tools? (Agent, AskUserQuestion, ScheduleWakeup) → FAIL
  └─ Pre-approved tools? (Bash(docker-*), Bash(npm *)) → ALLOW
  ↓
Record in Audit Trail
  ↓
Execute Tool (NO permission prompt from harness)
```

**Key difference from current system:**

- **Before**: `Tool Call → Harness Permission Check → Prompt User → Timeout/Hang`
- **After**: `Tool Call → ExecutionPolicy Check → (Allow|Fail) → Harness (backup only)`

---

## Execution Modes

### INTERACTIVE (Default)
- Prompts user for everything
- Allows all tools (current behavior)
- No pre-approval needed
- **Use for**: Debugging, interactive exploration

### UNATTENDED
- No prompts, fails fast on unauthorized tools
- Requires pre-approved tool set
- Good for scheduled builds
- **Use for**: Overnight builds, CI/CD pipelines, automation

### BATCH
- Single upfront approval covers all calls
- Allows chained operations
- Max 50 calls per batch
- **Use for**: Multi-step sequential tasks

### MAINTENANCE
- Pre-approved trusted pattern set
- No user interaction
- Good for long-running services
- **Use for**: Daemon tasks, background workers

---

## Pre-Approved Tool Patterns

Common tools and glob patterns for unattended builds:

```javascript
preapprovedTools: [
  // Docker
  'Bash(docker-compose *)',
  'Bash(docker *)',
  'PowerShell(docker *)',
  'PowerShell(docker-compose *)',

  // NPM
  'Bash(npm *)',
  'Bash(npm test)',
  'Bash(npm run *)',

  // Git
  'Bash(git *)',
  'Bash(git status)',
  'Bash(git log *)',
  'Bash(git diff *)',
  'Bash(git commit *)',

  // Code operations
  'Read',
  'Grep',
  'Glob',
  'Edit',
  'Write',
  'Bash',
]
```

---

## Audit Trail: Full Transparency

After task completes, audit log shows every tool call:

```bash
curl http://localhost:3000/autonomy/execution/audit/docker-build-phase-2-5
```

```json
[
  {
    "taskId": "docker-build-phase-2-5",
    "mode": "UNATTENDED",
    "startedAt": "2026-06-16T14:30:00Z",
    "endedAt": "2026-06-16T14:35:12Z",
    "status": "SUCCESS",
    "toolCalls": [
      {
        "timestamp": "2026-06-16T14:30:05Z",
        "tool": "Bash(docker-compose up --build)",
        "allowed": true,
        "reason": "preapproved"
      },
      {
        "timestamp": "2026-06-16T14:30:45Z",
        "tool": "Bash(npm test)",
        "allowed": true,
        "reason": "preapproved"
      },
      {
        "timestamp": "2026-06-16T14:35:10Z",
        "tool": "Bash(git commit -m 'Build passed')",
        "allowed": true,
        "reason": "preapproved"
      }
    ]
  }
]
```

---

## Pre-Flight Validation: Check Before You Schedule

Before committing to a scheduled task, validate your pre-approved tools:

```typescript
const checkResponse = await fetch('http://localhost:3000/autonomy/execution/check', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    taskId: 'docker-build-phase-2-5',
    tool: 'Bash(docker-compose up --build)',
  }),
});

const result = await checkResponse.json();
console.log(result);
// {
//   "allowed": true,
//   "taskId": "docker-build-phase-2-5",
//   "mode": "UNATTENDED",
//   "tool": "Bash(docker-compose up --build)",
//   "reason": "preapproved"
// }
```

---

## Failure Modes: What Happens When Tools Are Unauthorized

### Scenario: Tool Not in Pre-Approved Set

```typescript
// Task configured with: preapprovedTools: ['Bash(docker-*)', 'Bash(npm *)']
// But code calls:
await runCommand('curl https://api.example.com/deploy');

// Result (UNATTENDED mode with exitOnUnauthorized=true):
// 1. Policy check: curl not in approved set
// 2. Task marked as FAILED
// 3. Execution stops immediately
// 4. Audit trail recorded: { "tool": "curl...", "allowed": false, "reason": "denied-by-policy" }
// 5. No hanging, no prompts, no 90-minute wait
```

### Scenario: Emergency Override

If a task genuinely needs an extra tool, DON'T modify the pre-approved set mid-execution. Instead:

1. **Stop the task** (let it fail fast)
2. **Register a new execution context** with updated pre-approved tools
3. **Schedule again**

This keeps audit trail clean and prevents accidental permission escalation.

---

## API Reference

### POST /autonomy/execution/register
Register execution context before scheduling.

**Request:**
```json
{
  "taskId": "unique-task-id",
  "mode": "UNATTENDED",
  "preapprovedTools": ["Bash(docker-*)", "Bash(npm *)"],
  "exitOnUnauthorized": true,
  "timeout": 600
}
```

**Response:**
```json
{
  "registered": true,
  "taskId": "unique-task-id",
  "mode": "UNATTENDED",
  "message": "Task registered. Use ScheduleWakeup(taskId) to schedule execution."
}
```

### GET /autonomy/execution/status/:taskId
Check execution status.

**Response:**
```json
{
  "taskId": "unique-task-id",
  "mode": "UNATTENDED",
  "status": "SUCCESS",
  "startedAt": "2026-06-16T14:30:00Z",
  "endedAt": "2026-06-16T14:35:12Z",
  "toolCallCount": 3,
  "allowedToolCount": 3,
  "deniedToolCount": 0
}
```

### GET /autonomy/execution/audit/:taskId
Get detailed audit trail (JSON).

### POST /autonomy/execution/check
Pre-flight validation of a tool call.

**Request:**
```json
{
  "taskId": "unique-task-id",
  "tool": "Bash(docker-compose up)"
}
```

**Response:**
```json
{
  "allowed": true,
  "taskId": "unique-task-id",
  "mode": "UNATTENDED",
  "tool": "Bash(docker-compose up)",
  "reason": "preapproved"
}
```

### GET /autonomy/execution/modes
List all execution modes and their policies.

---

## Troubleshooting

### "Task context not found"
- Did you register the context before scheduling?
- Check: `GET /autonomy/execution/status/:taskId`
- Solution: `POST /autonomy/execution/register` first

### "Tool not allowed in UNATTENDED mode"
- Tool is not in preapprovedTools
- Check: `POST /autonomy/execution/check`
- Solution: Add tool to pre-approved set OR switch to INTERACTIVE mode

### "Task marked as FAILED, didn't finish build"
- Unauthorized tool was called, task failed fast
- Check: `GET /autonomy/execution/audit/:taskId` for failure point
- Solution: Update preapprovedTools and re-register

### "Build still takes 60+ minutes"
- Context might not be set in scheduled task execution
- Check: Is the agent actually looking up the context when it wakes?
- Solution: Call `store.getContext(taskId)` and `interceptor.startTask(context)` at task start

---

## Examples

### Example 1: Docker Build at 2 AM

```typescript
// Register at 1:55 AM
await fetch('http://localhost:3000/autonomy/execution/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    taskId: 'nightly-docker-build',
    mode: 'UNATTENDED',
    preapprovedTools: [
      'Bash(docker-compose *)',
      'Bash(npm *)',
      'Bash(git *)',
      'Read',
      'Grep',
    ],
    exitOnUnauthorized: true,
    timeout: 1200, // 20 minutes
  }),
});

// Schedule at 1:55 AM to wake at 2:00 AM
ScheduleWakeup({
  delaySeconds: 300,
  reason: 'Nightly Docker build at 2 AM',
});

// When it wakes at 2:00 AM:
const context = store.getContext('nightly-docker-build');
interceptor.startTask(context);

// Now docker-compose, npm, git all execute without prompts
// Build finishes in 5 minutes instead of 90+
```

### Example 2: Multi-Step CI/CD Pipeline

```typescript
// Register batch context
await fetch('http://localhost:3000/autonomy/execution/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    taskId: 'ci-pipeline-stage-2',
    mode: 'BATCH',
    preapprovedTools: [
      'Bash(docker-compose *)',
      'Bash(npm *)',
      'Bash(git *)',
      'Read',
      'Grep',
      'Edit',
    ],
    exitOnUnauthorized: false, // Continue even if one tool unauthorized
    timeout: 1800, // 30 minutes
  }),
});

// Schedule
ScheduleWakeup({
  delaySeconds: 600,
  reason: 'CI pipeline stage 2 (after tests pass)',
});

// Runs: build → test → integration tests → deployment checks
// All in one batch without prompts
```

---

## Limitations & Future Work

Current Phase A/B implementation:

- ✅ UNATTENDED mode with fail-fast authorization
- ✅ Pre-approved tool sets per task
- ✅ Audit trail with full transparency
- ✅ No harness changes required (agent-side only)

Future improvements (Phase C/D):

- Settings.json per-mode policy defaults
- Custom policy rules in task registration
- Rate limiting and batch size enforcement
- Integration with Phase 24 Governance approval system

---

## See Also

- `ExecutionPolicy.ts` — Core policy engine
- `TaskMetadataStore.ts` — Context + execution history
- `ExecutionPolicyInterceptor.ts` — Tool call interception
- `AUTOMATION-ARCHITECTURE-DEEPDIVE.md` — Full design rationale
