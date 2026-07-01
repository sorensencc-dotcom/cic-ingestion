# Toolforge Index

Generated: 2026-06-28 16:35:00

## Sync-Tools (Multi-Repo Automation)

### multiRepoRoadmapSync [0.1.0] — active

Unified drift detector + roadmap updater for sorensencc-dotcom repos.

- **Entrypoint**: `run.ps1`
- **Path**: `C:/dev/toolforge/sync-tools/multiRepoRoadmapSync`
- **Owner**: soren
- **Tags**: sync, automation, multi-repo
- **Schedule**: Daily 09:00 UTC
- **Last Run**: 2026-06-28 09:15:00
- **Dependencies**: Node.js 20+, PowerShell 7+

**Quick start**:

```powershell
.\run-tool.ps1 -Run multiRepoRoadmapSync -Config repo-registry.json
```

**Documentation**: See `sync-tools/README.md`

---

## Daemons (Background Services)

### toolforgeManifestSync [0.1.0] — active

Background daemon that syncs toolforge manifest index.

- **Entrypoint**: `toolforge-manifest-sync.ps1`
- **Path**: `C:/dev/toolforge/daemons/toolforge-manifest-sync`
- **Owner**: soren
- **Tags**: daemon, metadata
- **Schedule**: Every 15 minutes
- **Dependencies**: PowerShell 7+

**Status**: Registered with Task Scheduler

---

### toolforgeDocsSync [0.1.0] — active

Background daemon that regenerates tool documentation.

- **Entrypoint**: `toolforge-docs-sync.ps1`
- **Path**: `C:/dev/toolforge/daemons/toolforge-docs-sync`
- **Owner**: soren
- **Tags**: daemon, documentation
- **Dependencies**: PowerShell 7+

---

### toolforgeIndexSync [0.1.0] — active

Background daemon that updates tool index (INDEX.md).

- **Entrypoint**: `toolforge-index-sync.ps1`
- **Path**: `C:/dev/toolforge/daemons/toolforge-index-sync`
- **Owner**: soren
- **Tags**: daemon, metadata
- **Dependencies**: PowerShell 7+

---

## Utilities (Setup & Helpers)

### setupTaskScheduler [1.0.0] — active

Windows Task Scheduler registration for toolforge daemons and sync-tools.

- **Entrypoint**: `setup-task-scheduler.ps1`
- **Path**: `C:/dev/toolforge/utilities/setup-task-scheduler`
- **Owner**: soren
- **Tags**: setup, scheduling, windows
- **Dependencies**: PowerShell 7+, Administrator privileges

**Quick start**:

```powershell
.\utilities\setup-task-scheduler.ps1 -Install
```

---

## Reserved Categories

The following categories are reserved for future use:

- **adapters/**: Data transformers (Phase 3)
- **mcp-servers/**: MCP server implementations (Phase 4)
- **scaffolds/**: Template generators (Phase 3)
- **prototypes/**: Experimental tools (On-demand)

---

## Discovery & Management

**Discover tools**:

```powershell
.\run-tool.ps1 -List
```

**Inspect tool**:

```powershell
.\run-tool.ps1 -Inspect toolName
```

**Refresh discovery**:

```powershell
.\run-tool.ps1 -Refresh
```

**Auto-generated**: Tools are discovered by scanning category directories. This index is updated by `toolforgeIndexSync` daemon.

---

## Total Tools

- **Sync-Tools**: 1
- **Daemons**: 3
- **Utilities**: 1
- **Adapters**: 0
- **MCP Servers**: 0
- **Scaffolds**: 0
- **Prototypes**: 0

**Total**: 5 active tools

---

## See Also

- [README.md](README.md) — Overview and quick start
- [OPERATOR_GUIDE.md](OPERATOR_GUIDE.md) — How to run and schedule tools
- [TOOL_CREATION_GUIDE.md](TOOL_CREATION_GUIDE.md) — Creating new tools
- [GOVERNANCE.md](GOVERNANCE.md) — Rules and standards
- [manifest.json](manifest.json) — Tool metadata (machine-readable)
