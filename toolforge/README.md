# Toolforge

Local-first platform for tools, daemons, scaffolds, and adapters used across Rewrite Labs and CIC. Unified discovery, execution, and lifecycle management.

## Directory Structure

| Category | Purpose | Entry Point | Examples |
| --- | --- | --- | --- |
| **sync-tools/** | Multi-repo sync, drift detection, automation | `.cjs` or `.ps1` | multiRepoRoadmapSync |
| **daemons/** | Long-running services, background tasks | `.ps1` script | toolforge-manifest-sync |
| **adapters/** | External data transformers | `.ts` or `.js` | (reserved for future) |
| **mcp-servers/** | MCP protocol implementations | `server.ts` or similar | (reserved for future) |
| **utilities/** | Helper scripts, setup, configuration | `.ps1` or `.sh` | setup-task-scheduler |
| **scaffolds/** | Template generators, boilerplate | `.ts` generator | (reserved for future) |
| **prototypes/** | Experimental, early-stage tools | Any language | (reserved for future) |
| **_TEMPLATE/** | Base template for new tools | README.md, VERSION.md | Reference only |

## Quick Start

### Discover tools

```powershell
toolforge.ps1 -List
```

### Run a tool

```powershell
toolforge.ps1 -Run multiRepoRoadmapSync -Config config.json
```

### View tool details

```powershell
toolforge.ps1 -Inspect multiRepoRoadmapSync
```

## Tool Metadata

Each tool registers in `manifest.json` with:

- **name**: unique identifier
- **category**: sync-tools, daemons, adapters, etc.
- **description**: one-line purpose
- **entrypoint**: run.ps1, runner.cjs, server.ts, etc.
- **status**: active, beta, archived
- **version**: semantic version

## Documentation

- **ROADMAP.md** — Evolution phases (Foundation complete, Operationalization in progress)
- **GOVERNANCE.md** — Naming, versioning, lifecycle rules
- **INDEX.md** — Auto-generated tool index
- **CLAUDE_WORKSPACE.json** — VSCode multi-folder workspace config

See subdirectories for tool-specific README files.
