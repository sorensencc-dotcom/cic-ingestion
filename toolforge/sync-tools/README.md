# Sync-Tools Category

Multi-repository scanning, drift detection, automation, and synchronization tools.

## Overview

Sync-tools scan multiple repositories (tracked in `repo-registry.json`) and perform actions like:

- **Drift detection**: Compare expected vs. actual state across repos
- **Roadmap sync**: Update ROADMAP.md files with current project status
- **Status aggregation**: Collect metrics, versions, health signals
- **Automation**: Batch updates, housekeeping, synchronization

## Included Tools

### multiRepoRoadmapSync (v0.1.0)

Unified drift detector and roadmap updater for sorensencc-dotcom repos.

**Purpose**: Detect when roadmap.json in registry repos diverge from their ROADMAP.md, report drift, optionally auto-sync.

**Usage**:
```powershell
.\run-tool.ps1 -Run multiRepoRoadmapSync -Config repo-registry.json
```

**Configuration**: See `repo-registry.json` (list of repos to scan)

**Output**:
- Console: Summary of drift findings
- File: `C:\dev\logs\roadmap-sync-YYYY-MM-DD.log` (if configured)

**Schedule**: Daily 09:00 UTC via Task Scheduler (see ROADMAP-SYNC-SETUP.md)

**Status**: Active (0.1.0-beta)

## Registry Format

`repo-registry.json` tracks target repositories:

```json
{
  "version": "1.0.0",
  "scanInterval": "daily",
  "repos": [
    {
      "name": "repo-name",
      "url": "https://github.com/sorensencc/repo-name",
      "paths": {
        "roadmap": "ROADMAP.md",
        "manifest": "package.json"
      },
      "enabled": true
    }
  ]
}
```

**Fields**:
- `name`: Repository identifier
- `url`: GitHub HTTPS URL
- `paths`: Key file locations (roadmap, manifest, etc.)
- `enabled`: Skip if false

## Setup & Scheduling

### One-time Setup

1. Configure `repo-registry.json` with target repos
2. Test manually:
   ```powershell
   .\run-tool.ps1 -Run multiRepoRoadmapSync -Config repo-registry.json
   ```
3. Register with Task Scheduler:
   ```powershell
   .\setup-task-scheduler.ps1 -Install
   ```

### Manual Execution

```powershell
cd C:\dev\toolforge
.\run-tool.ps1 -Run multiRepoRoadmapSync -Config sync-tools\repo-registry.json
```

### Scheduled Execution

Via Task Scheduler (Windows):

```powershell
Get-ScheduledTask -TaskName "*roadmap*" | Select-Object TaskName, State
```

Check logs:
```powershell
Get-ScheduledTaskInfo -TaskName "Toolforge-Daily-09UTC"
```

## Adding a New Sync-Tool

1. Create subdirectory:
   ```powershell
   mkdir C:\dev\toolforge\sync-tools\myNewSyncTool
   ```

2. Add entrypoint (run.ps1 or runner.cjs):
   ```powershell
   # Example: run.ps1
   param([string]$Config)
   # Your sync logic here
   ```

3. Add metadata:
   ```powershell
   # README.md (describe purpose + usage)
   # VERSION.md (e.g., "0.1.0-beta")
   ```

4. Register in manifest:
   ```powershell
   .\run-tool.ps1 -Refresh
   ```

5. Add to `repo-registry.json` if needed (for multi-repo targeting)

6. Test:
   ```powershell
   .\run-tool.ps1 -Run myNewSyncTool -Config config.json
   ```

## Best Practices

### Configuration

- Use external `*.json` or `*.yaml` files (not hardcoded)
- Pass config path as first argument
- Validate config on startup

### Logging

- Log to console (stdout/stderr)
- Optional: Log to `C:\dev\logs\toolname-YYYY-MM-DD.log`
- Include timestamps, severity (INFO/WARN/ERROR)

### Error Handling

- Exit 0 on success
- Exit 1+ on failure (allow Task Scheduler to log)
- Report errors clearly (no silent failures)

### Dependencies

- Declare in `VERSION.md` or manifest
- Use locked versions (package-lock.json for npm, etc.)
- Avoid breaking changes across minor versions

### Performance

- Log progress for long-running scans
- Consider repo-level parallelism (but respect rate limits)
- Estimate runtime and schedule accordingly

## Examples

### Scan all repos for outdated ROADMAP.md

```powershell
.\run-tool.ps1 -Run multiRepoRoadmapSync -Config repo-registry.json 2>&1 | Select-String "drift|error"
```

### Log output to file

```powershell
$log = "C:\dev\logs\sync-$(Get-Date -Format yyyy-MM-dd-HHmmss).log"
.\run-tool.ps1 -Run multiRepoRoadmapSync -Config repo-registry.json | Tee-Object $log
```

### Schedule custom sync-tool

```powershell
# Create myCustomSync\run.ps1
# Register in Task Scheduler using setup-task-scheduler.ps1
# Or manually:
$taskName = "Toolforge-MyCustomSync"
$taskAction = New-ScheduledTaskAction -Execute "pwsh" -Argument "-NoProfile -File C:\dev\toolforge\run-tool.ps1 -Run myCustomSync"
$taskTrigger = New-ScheduledTaskTrigger -Daily -At "10:00 AM"
Register-ScheduledTask -TaskName $taskName -Action $taskAction -Trigger $taskTrigger
```

## Troubleshooting

### Tool not found

```powershell
# Refresh discovery
.\run-tool.ps1 -Refresh

# Verify registration
.\run-tool.ps1 -Inspect multiRepoRoadmapSync
```

### Config file not found

```powershell
# Check path
Test-Path C:\dev\toolforge\sync-tools\repo-registry.json

# Absolute paths work best
.\run-tool.ps1 -Run multiRepoRoadmapSync -Config "C:\dev\toolforge\sync-tools\repo-registry.json"
```

### Task Scheduler failures

```powershell
# View task details
Get-ScheduledTask -TaskName "Toolforge*" | Get-ScheduledTaskInfo

# View task event log
Get-EventLog -LogName System -Source TaskScheduler | tail -20

# Run manually for debugging
Start-ScheduledTask -TaskName "Toolforge-Daily-09UTC"
```

### Repository access issues

```powershell
# Test GitHub access
git ls-remote https://github.com/sorensencc/repo-name HEAD

# Check registry config
Select-String "url" repo-registry.json
```

## File Structure

```
C:\dev\toolforge\sync-tools\
├── README.md (this file)
├── repo-registry.json (registry of target repos)
├── ROADMAP-SYNC-SETUP.md (detailed setup guide)
├── multiRepoRoadmapSync.cjs (legacy CommonJS version)
├── multiRepoRoadmapSync-REVIEW.md (code review notes)
└── (future: add subdirectories for each new sync-tool)
```

## See Also

- [OPERATOR_GUIDE.md](../OPERATOR_GUIDE.md) — How to run tools
- [GOVERNANCE.md](../GOVERNANCE.md) — Rules and standards
- [ROADMAP-SYNC-SETUP.md](./ROADMAP-SYNC-SETUP.md) — multiRepoRoadmapSync setup
