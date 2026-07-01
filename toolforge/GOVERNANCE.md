# Toolforge Governance

Naming, versioning, and lifecycle rules for all tools.

## Classification

### sync-tools

Multi-repo automation: scanning, drift detection, roadmap sync, status aggregation.

- **Entry point**: `.cjs` (Node.js CommonJS) or `.ps1` (PowerShell)
- **Runtime**: Node.js 20+ or PowerShell 7+
- **Registry**: `repo-registry.json` (list of target repos)
- **Execution**: Manual trigger or Task Scheduler cron
- **Examples**: multiRepoRoadmapSync

### daemons

Long-running background services: manifest sync, docs generation, health checks.

- **Entry point**: `.ps1` script (Windows Task Scheduler compatible)
- **Lifecycle**: Start → Persist → Stop (via task scheduler)
- **Logging**: To file in `C:\dev\logs\` or stdout
- **Examples**: toolforge-manifest-sync, toolforge-docs-sync

### adapters

Transform external data: GitHub→internal, roadmap→metrics, third-party→CIC.

- **Entry point**: `.ts` module with export function
- **Interface**: `(input: T) => Promise<U>`
- **Status**: Reserved for Phase 3+
- **Examples**: (None yet)

### mcp-servers

MCP (Model Context Protocol) server implementations.

- **Entry point**: `server.ts` or `server.js`
- **Port**: Assigned from 3200-3299 range
- **Status**: Reserved for Phase 4+
- **Examples**: (None yet)

### utilities

One-off setup, helper scripts, configuration tools.

- **Entry point**: `.ps1`, `.sh`, or `.cjs`
- **Scope**: Single-purpose (no dependencies on other tools)
- **Lifecycle**: Run once, exit
- **Examples**: setup-task-scheduler, bootstrap scripts

### scaffolds

Template generators for new tools or boilerplate.

- **Entry point**: `.ts` generator function
- **Output**: New directory under appropriate category
- **Status**: Reserved for Phase 3+
- **Examples**: (None yet)

### prototypes

Experimental, early-stage, or research tools.

- **Status**: May be unstable, undocumented, subject to deletion
- **Entry point**: Any
- **Migration**: Move to stable category + v1.0.0 when ready
- **Examples**: (None yet)

## Naming Convention

- **Directory**: kebab-case, matches tool name
- **Files**: camelCase (multiRepoRoadmapSync.cjs) or kebab-case (setup-task-scheduler.ps1)
- **Tool identifier**: match directory name exactly
- **Entrypoint**: `run.ps1` (preferred) or match language convention

Example:

```text
sync-tools/
  multiRepoRoadmapSync/
    run.ps1
    multiRepoRoadmapSync.cjs
    README.md
    config.json
```

## Versioning

- **Semantic versioning**: MAJOR.MINOR.PATCH
- **Initial version**: 0.1.0 (beta/experimental)
- **Production**: 1.0.0 (stable, documented, tested)
- **Deprecation**: Mark as `archived` in manifest, keep 1 major version for transition
- **Version file**: `VERSION.md` in tool root

## Manifest Registration

Every tool must register in `manifest.json`:

```json
{
  "name": "multiRepoRoadmapSync",
  "category": "sync-tools",
  "path": "C:/dev/toolforge/sync-tools/multiRepoRoadmapSync",
  "description": "Unified drift detector + roadmap updater for sorensencc-dotcom repos.",
  "entrypoint": "run.ps1",
  "status": "active",
  "version": "0.1.0",
  "owner": "soren",
  "tags": ["sync", "automation"],
  "dependencies": ["Node.js 20+"]
}
```

**Status values**:
- `active` — In production, supported
- `beta` — Testing, subject to change
- `archived` — Deprecated, do not use
- `maintenance` — Working but no new features

## Auto-Discovery

Toolforge scans directories at startup:

1. List all `.cjs`, `.ts`, `.ps1`, `.sh` files in each category
2. Match against `manifest.json`
3. Validate entrypoints exist
4. Update `INDEX.md` with discovered tools
5. Flag unmapped tools (warning)
6. Flag missing entrypoints (error)

Auto-discovery runs on:
- Manual: `toolforge.ps1 -Refresh`
- Automatic: On script invocation (cached, 5min TTL)

## Lifecycle Stages

### Development (0.x.x)

- Location: `prototypes/` or `_draft/`
- Tests: Optional
- Documentation: Minimal
- Manifest: `beta` status
- Breaking changes: Allowed, no migration needed

### Beta (1.0.0-rc.X)

- Location: Target category
- Tests: Core paths covered
- Documentation: README + usage examples
- Manifest: `beta` status
- Breaking changes: Documented in CHANGELOG

### Production (1.0.0+)

- Location: Target category
- Tests: 80%+ coverage
- Documentation: Full API, examples, troubleshooting
- Manifest: `active` status
- Breaking changes: MAJOR version bump + deprecation cycle

### Maintenance (1.x.x ongoing)

- Bug fixes backported
- Security updates prioritized
- New features: Rare, vetted
- Deprecation: 2+ major version warning period

### Archived (x.y.z, status=archived)

- No new deployments
- Existing instances: "best effort" support
- Replacement: Documented in README
- Cleanup: 6+ months after supersession

## Quality Gates

- **Linting**: PowerShell strict mode, Node ESLint
- **Tests**: Jest for .ts/.js, Pester for .ps1
- **Secrets**: No hardcoded API keys, passwords, tokens
- **Dependencies**: Locked in lock files (npm, PowerShell gallery)
- **Documentation**: README + inline comments for non-obvious logic

## CI/CD Integration

Toolforge tools integrate with:

- **GitHub Actions**: Auto-scan, version bump, publish
- **Task Scheduler**: Windows cron for daemons, sync-tools
- **CIC Governance**: Skill validation, proposal workflows

See `.github/workflows/toolforge-*.yml` for pipeline details.
