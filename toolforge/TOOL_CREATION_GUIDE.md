# Tool Creation Guide

Step-by-step guide for creating and registering new Toolforge tools.

## Before You Start

- Understand the [GOVERNANCE.md](GOVERNANCE.md) rules
- Identify the tool category (sync-tools, daemons, utilities, etc.)
- Have a clear, single-purpose use case
- Plan versioning (start at 0.1.0-beta)

## Step 1: Choose Category

| If your tool... | Category |
| --- | --- |
| Scans multiple repos, syncs state, detects drift | sync-tools |
| Runs continuously in background, long-lived | daemons |
| Transforms external data, adapter pattern | adapters |
| Implements MCP server | mcp-servers |
| Generates scaffolds, templates | scaffolds |
| One-off setup or helper script | utilities |
| Experimental, proof-of-concept | prototypes |

## Step 2: Create Directory Structure

```powershell
$toolName = "myNewTool"
$category = "sync-tools"  # Change as needed
$toolPath = "C:\dev\toolforge\$category\$toolName"

mkdir $toolPath
```

## Step 3: Add Core Files

### README.md

```markdown
# Tool Name

One-line purpose.

## Usage

\`\`\`powershell
.\run-tool.ps1 -Run toolName -Config config.json
\`\`\`

## Configuration

Describe config file format and required fields.

## Examples

Show common usage patterns.
```

### VERSION.md

```
0.1.0-beta

## Changelog

### 0.1.0 (2026-06-28)
- Initial release
- Features: X, Y, Z
- Dependencies: Node.js 20+, PowerShell 7+
```

### run.ps1 (or runner.cjs / server.ts)

```powershell
param([string]$Config)

Write-Host "🚀 Starting myNewTool..." -ForegroundColor Cyan

# Your implementation here

Write-Host "✓ Done" -ForegroundColor Green
exit 0
```

For Node.js:
```javascript
// runner.cjs or run.js
const config = process.argv[2];
console.log("🚀 Starting myNewTool...");
// Your implementation
console.log("✓ Done");
```

## Step 4: Implement Tool Logic

### Best Practices

1. **Configuration**: Accept config file as first argument
2. **Validation**: Check config and dependencies on startup
3. **Logging**: Log progress with timestamps
4. **Error handling**: Exit with code 1+ on failure, clear error messages
5. **Performance**: Log long operations, consider parallelism
6. **Cleanup**: Close file handles, DB connections, etc.

### PowerShell Example

```powershell
param([string]$ConfigPath = "config.json")

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $PSCommandPath

# 1. Validate config
if (-not (Test-Path $ConfigPath)) {
  Write-Error "Config not found: $ConfigPath"
  exit 1
}

$config = Get-Content $ConfigPath | ConvertFrom-Json
if (-not $config.repos) {
  Write-Error "Config missing 'repos' field"
  exit 1
}

# 2. Log startup
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Write-Host "[$timestamp] Starting sync for $($config.repos.Count) repos..." -ForegroundColor Cyan

# 3. Do work
$errors = @()
$config.repos | ForEach-Object {
  try {
    Write-Host "  → $_" -ForegroundColor Gray
    # Your logic
  } catch {
    $errors += $_
    Write-Host "  ❌ $_" -ForegroundColor Red
  }
}

# 4. Report results
Write-Host ""
if ($errors.Count -gt 0) {
  Write-Error "$($errors.Count) errors found"
  exit 1
}

Write-Host "✓ All repos synced" -ForegroundColor Green
exit 0
```

### Node.js Example

```javascript
const fs = require("fs");
const path = require("path");

const configPath = process.argv[2] || "config.json";

// 1. Validate config
if (!fs.existsSync(configPath)) {
  console.error(`Config not found: ${configPath}`);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
if (!config.repos) {
  console.error("Config missing 'repos' field");
  process.exit(1);
}

// 2. Log startup
const timestamp = new Date().toISOString();
console.log(`[${timestamp}] Starting sync for ${config.repos.length} repos...`);

// 3. Do work
const errors = [];
for (const repo of config.repos) {
  try {
    console.log(`  → ${repo}`);
    // Your logic
  } catch (err) {
    errors.push(err);
    console.error(`  ❌ ${err.message}`);
  }
}

// 4. Report results
if (errors.length > 0) {
  console.error(`\n${errors.length} errors found`);
  process.exit(1);
}

console.log("\n✓ All repos synced");
process.exit(0);
```

## Step 5: Test Locally

```powershell
# Test with sample config
cd C:\dev\toolforge
.\run-tool.ps1 -Run myNewTool -Config ./sample-config.json

# Or direct invocation
& "C:\dev\toolforge\sync-tools\myNewTool\run.ps1" sample-config.json
```

## Step 6: Register Tool

Auto-discovery:
```powershell
.\run-tool.ps1 -Refresh
```

Verify:
```powershell
.\run-tool.ps1 -List
.\run-tool.ps1 -Inspect myNewTool
```

## Step 7: Add to Manifest (Optional)

Edit `manifest.json` to add custom metadata:

```json
{
  "name": "myNewTool",
  "category": "sync-tools",
  "path": "C:/dev/toolforge/sync-tools/myNewTool",
  "description": "Clear one-line purpose.",
  "entrypoint": "run.ps1",
  "status": "active",
  "version": "0.1.0",
  "owner": "soren",
  "tags": ["tag1", "tag2"],
  "dependencies": ["Node.js 20+"],
  "schedule": "Daily 10:00 AM",
  "lastRun": "2026-06-28T10:00:00Z"
}
```

## Step 8: Schedule (If Applicable)

For sync-tools or daemons:

```powershell
# Option A: Use setup-task-scheduler.ps1 (if it supports your tool)
.\utilities\setup-task-scheduler.ps1 -Install

# Option B: Manual Task Scheduler registration
$taskName = "Toolforge-MyNewTool"
$taskAction = New-ScheduledTaskAction `
  -Execute "pwsh" `
  -Argument "-NoProfile -File C:\dev\toolforge\run-tool.ps1 -Run myNewTool -Config C:\dev\toolforge\sync-tools\myNewTool\config.json"
$taskTrigger = New-ScheduledTaskTrigger -Daily -At "10:00 AM"
Register-ScheduledTask -TaskName $taskName -Action $taskAction -Trigger $taskTrigger -RunLevel Highest
```

## Step 9: Add Tests (Recommended)

Create `myNewTool.test.ps1` or `myNewTool.test.js`:

```powershell
# test.ps1
param([string]$ToolPath = ".")

# Test 1: Config validation
$result = & "$ToolPath\run.ps1" invalid-config.json 2>&1
if ($LASTEXITCODE -eq 0) { throw "Should fail on invalid config" }

# Test 2: Success case
$result = & "$ToolPath\run.ps1" valid-config.json 2>&1
if ($LASTEXITCODE -ne 0) { throw "Should succeed on valid config" }

Write-Host "✓ All tests passed"
```

Run tests:
```powershell
.\myNewTool.test.ps1 "C:\dev\toolforge\sync-tools\myNewTool"
```

## Step 10: Document & Contribute

1. Update `README.md` with detailed usage
2. Add examples to `OPERATOR_GUIDE.md` if broadly useful
3. Commit and document in CHANGELOG.md
4. Tag version: `v0.1.0`

## Template Checklist

- [ ] Directory created in correct category
- [ ] README.md written (usage, config, examples)
- [ ] VERSION.md created (0.1.0-beta initial)
- [ ] Entrypoint script working (run.ps1, runner.cjs, etc.)
- [ ] Config validation implemented
- [ ] Error handling working (exit codes, messages)
- [ ] Logging implemented (timestamps, severity)
- [ ] Local testing passed
- [ ] Registered in manifest (`.\run-tool.ps1 -Refresh`)
- [ ] Verification passed (`.\run-tool.ps1 -Inspect`)
- [ ] Tests written (optional but recommended)
- [ ] Task Scheduler registered (if applicable)
- [ ] Documentation complete
- [ ] Committed to git with clear message

## Common Patterns

### Multi-Repo Scanning

```powershell
$registry = Get-Content "repo-registry.json" | ConvertFrom-Json
$registry.repos | ForEach-Object {
  if (-not $_.enabled) { return }
  Write-Host "Scanning: $($_.name)" -ForegroundColor Cyan
  # Your scan logic
}
```

### Async/Parallel Execution

Node.js:
```javascript
const repos = config.repos;
const results = await Promise.all(
  repos.map(async (repo) => scanRepo(repo))
);
```

PowerShell (7+):
```powershell
$repos | ForEach-Object -Parallel {
  scanRepo $_
} -ThrottleLimit 5
```

### Logging to File

PowerShell:
```powershell
$logPath = "C:\dev\logs\$($scriptName)-$(Get-Date -Format 'yyyy-MM-dd').log"
New-Item -Path (Split-Path $logPath) -ItemType Directory -Force | Out-Null
Write-Host "Message" | Tee-Object -FilePath $logPath -Append
```

Node.js:
```javascript
const fs = require("fs");
const logPath = `C:/dev/logs/${toolName}-${new Date().toISOString().split("T")[0]}.log`;
const log = (msg) => console.log(msg) && fs.appendFileSync(logPath, `${msg}\n`);
```

## See Also

- [GOVERNANCE.md](GOVERNANCE.md) — Rules and standards
- [OPERATOR_GUIDE.md](OPERATOR_GUIDE.md) — Running tools
- [sync-tools/README.md](sync-tools/README.md) — Multi-repo examples
- [_TEMPLATE/](\_TEMPLATE/) — Reference files
