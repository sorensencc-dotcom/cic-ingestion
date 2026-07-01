# Toolforge Roadmap

High-level evolution of the Toolforge platform from foundation to marketplace.

## Phase 1 — Foundation (✅ Complete)

Core infrastructure and tool execution.

- ✅ Directory architecture (7 categories)
- ✅ Bootstrap + installer scripts
- ✅ Universal tool runner (`run-tool.ps1`)
- ✅ Manifest + metadata system
- ✅ 3 background daemons (manifest, docs, index sync)
- ✅ Windows Task Scheduler integration
- ✅ Governance framework (GOVERNANCE.md)

**Status**: All core systems operational. 5 tools active.

---

---

## Phase 2 — Operationalization (🟡 In Progress)

Tooling, documentation, and operator experience.

**Current**:

- ✅ Directory structure locked
- ✅ Tool discovery and auto-registration
- ✅ Manifest with extended metadata
- ✅ OPERATOR_GUIDE.md (full reference)
- ✅ TOOL_CREATION_GUIDE.md (onboarding)
- ✅ Governance rules documented

**Remaining**:

- Dashboard v2 (tool status, execution history)
- Docs pipeline v2 (auto-generate per-tool docs)
- Release pipeline (version bump automation)
- Status badges (tool health)
- Error tracking and alerts

---

## Phase 3 — Integration (🔄 Next)

Connect Toolforge to CIC governance and production workflows.

**Planned**:

- **Adapters**: Data transformers (GitHub → internal, roadmap → metrics)
- **Multi-repo drift detectors**: Extend multiRepoRoadmapSync
- **Roadmap sync automation**: CIC-aware updates
- **Skill integration**: `/run-skill-generator` and other Claude Code skills
- **Observability**: Prometheus metrics for tool execution
- **Approval workflows**: Gate production tool runs through CIC governance

---

## Phase 4 — Platformization (📅 Future)

Scale to multi-user, cloud-ready platform.

**Planned**:

- **Desktop app**: Electron-based GUI for tool management
- **API v3**: RESTful + GraphQL for remote execution
- **Marketplace**: Share tools across teams/orgs
- **Cloud backend**: SaaS-hosted tool execution
- **Plugin system**: Third-party tool contributions
- **Multi-tenancy**: Isolated tool namespaces per org

---

## Milestones

| Phase | Target | Status |
| --- | --- | --- |
| 1 — Foundation | 2026-06-28 | ✅ Complete |
| 2a — Docs & Guides | 2026-07-15 | 🟡 In progress |
| 2b — Dashboard v2 | 2026-08-01 | 📅 Planned |
| 3a — Adapters | 2026-09-01 | 📅 Planned |
| 3b — CIC Integration | 2026-10-01 | 📅 Planned |
| 4 — Platformization | 2027 Q1 | 📅 Future |

---

## Known Issues & Backlog

- [ ] Task Scheduler integration tests (Windows-specific)
- [ ] Error recovery and retry logic in daemons
- [ ] Parallel execution safety (concurrency guards)
- [ ] Manifest versioning and migration path
- [ ] Tool dependency resolution
- [ ] Secrets management for tool configs

---

## Contributing

See [TOOL_CREATION_GUIDE.md](TOOL_CREATION_GUIDE.md) to add new tools.

See [GOVERNANCE.md](GOVERNANCE.md) for standards and review process.
