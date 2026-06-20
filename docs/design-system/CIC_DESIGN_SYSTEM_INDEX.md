# CIC Design System Index

**Version:** 1.0.0  
**Last updated:** 2026-06-17  
**Audience:** Agents (retrieval), Humans (reference)  
**Canonical location:** `cic-ingestion/docs/design-system/`

---

## Navigation

| Category | Purpose | Consumer | File |
|----------|---------|----------|------|
| **Tokens** | Visual + semantic constants | UI agents, Dashboard builders | `CIC_DESIGN_TOKENS.md` |
| **Patterns** | Interaction & layout templates | Ingest, Enrich, Orchestrate agents | `CIC_UI_PATTERNS.md` |
| **Guidelines** | Agent behavior rules | All autonomous agents | `CIC_AGENT_INTERACTION_GUIDELINES.md` |
| **Governance** | System principles & safety | Safety Sandbox, Council, Lifecycle agents | `../governance/cic-governance-manifest.yaml` |
| **Integration** | Dashboard + vault wiring | Dashboard agents, Evidence system | `../dashboards/cic-wil-overview.json` |
| **Review Workflow** | Design PR process | Code review agents, Contributors | `CIC_DESIGN_REVIEW_WORKFLOW.md` |

---

## Design System Layers

### Layer 1: Foundations
- **Tokens:** Colors, spacing, typography, shadows, timing constants
- **Semantic mapping:** Token → intent (primary, success, warning, critical)
- **Agent retrieval:** Query by token name, category, or usage context
- **Dashboard integration:** Tokens feed WIL component library visualization

### Layer 2: Components & Patterns
- **Interaction patterns:** Ingest (read), Enrich (compute), Orchestrate (decide), Synthesize (output), Audit (validate)
- **Layout patterns:** Autonomy loop dashboard, Evidence vault view, Phase timeline, Metrics explorer
- **Error handling:** Design for failure states (missing data, policy rejection, drift detection)
- **Agent-enforceable:** Patterns stored as JSON schema; agents validate against spec before render

### Layer 3: Governance Integration
- **Safety:** Governance manifest principles (determinism, safety, transparency, autonomy-bounded, drift-minimization)
- **Drift rules:** Design system changes trigger drift detection in `cic-drift-rules-engine-v2`
- **Policy rails:** Design changes go through council voting if they affect agent decision-making
- **Rollback:** All design updates tracked in Evidence Vault; rollback via snapshot recovery

### Layer 4: Observability
- **Metrics:** Design compliance (pattern match %), token usage frequency, agent adherence rate
- **Trace logging:** All design system queries logged in CIC Agent Trace Schema
- **Replay:** Design changes replayable via CIC Replay Harness (deterministic re-evaluation)

---

## Agent Decision Flow (Design System as Input)

```
Agent request
  ↓
Query design system (tokens, patterns, guidelines)
  ↓
Load context (governance principles, safety sandbox rules)
  ↓
Check drift rules (design changes flagged? policy rails active?)
  ↓
Execute behavior (render UI, decide output format, apply policy)
  ↓
Log to Evidence Vault (design choice + reasoning)
  ↓
Optional: Council vote if high-stakes (e.g., new interaction pattern)
```

---

## Retrieval Index (Agent-Facing)

### By Token Category
- `tokens/color/*` — Brand, semantic (success/warning/critical), accessibility (contrast ratios)
- `tokens/spacing/*` — Rhythm (4px, 8px, 16px, etc.), grid system
- `tokens/typography/*` — Font families, weights, sizes, line heights
- `tokens/shadows/*` — Elevation levels (z0 to z5)
- `tokens/timing/*` — Animation durations, easing functions

### By Pattern Type
- `patterns/ingest/*` — Data input, query forms, batch upload
- `patterns/enrich/*` — Computation display, metric cards, result tables
- `patterns/orchestrate/*` — Task scheduling, phase timeline, state machine
- `patterns/synthesize/*` — Output generation, report views, export formats
- `patterns/audit/*` — Validation results, policy enforcement, drift alerts

### By Governance Layer
- `governance/evaluation/*` — Model eval + agent replay integration
- `governance/safety/*` — Safety sandbox constraints for design (e.g., no hardcoded secrets)
- `governance/drift/*` — Drift detection for visual/behavioral changes
- `governance/deployment/*` — Design system version promotion (canary → stable)

---

## Cross-Links

| Artifact | Link | Why | Updated |
|----------|------|-----|---------|
| CIC Governance Manifest | `cic/governance/cic-governance-manifest.yaml` | Source of truth for principles | Auto-sync |
| Autonomy Boundary | `cic/governance/cic-autonomy-boundary.yaml` | Scopes agent authority over design | Manual |
| Command Center Matrix | `cic/COMMAND-CENTER-PRIORITY-MATRIX.md` | Design system health metrics | 2026-06-17 |
| WIL Dashboard | `cic-ingestion/dashboards/cic-wil-overview.json` | Component library + token visualization | Daily |
| Phase 23–27 Autonomy Stack | `cic/PHASE-*-*.md` | Design system supports autonomy agent behavior | Per-phase |
| Agent Interaction Guidelines | This file → `CIC_AGENT_INTERACTION_GUIDELINES.md` | Detailed rules per agent role | Per-change |

---

## Integration Points

### Governance Vault (Evidence System)
- All design system changes create Evidence packets
- Type: `DESIGN_CHANGE`
- Payload: token diff, pattern revision, guideline amendment, reason, approver
- Retention: permanent (for replay)
- Query: `SELECT * FROM evidence_vault WHERE packet_type='DESIGN_CHANGE' ORDER BY timestamp DESC`

### CIC Observability Dashboard
- **Token usage heatmap:** Which tokens agents use most?
- **Pattern adherence:** % of agent outputs matching stored patterns?
- **Drift detection:** Visual/behavioral changes outside expected range?
- **Compliance rate:** % of PR design reviews passing policy rails?

### Safety Sandbox
- Design system validates all agent UI outputs pre-render
- Catches hardcoded values, unsafe colors (contrast), policy violations
- Blocks render if violations found; logs to Evidence Vault with rejection reason

---

## Maintenance

| Activity | Frequency | Owner | Impact |
|----------|-----------|-------|--------|
| Token audit | Monthly | Design lead | WIL dashboard |
| Pattern review | Per-PR | Code review agents | Governance rail |
| Guideline refresh | Quarterly | Autonomy team | Agent behavior |
| Drift threshold tuning | As-needed | Safety sandbox operators | False positive rate |
| Vault snapshot backup | Daily | Infra team | Recovery SLA |

---

## Schema References

Token schema: [See `CIC_DESIGN_TOKENS.md`]  
Pattern schema: [See `CIC_UI_PATTERNS.md`]  
Guideline schema: [See `CIC_AGENT_INTERACTION_GUIDELINES.md`]  
Governance schema: [See `cic-governance-manifest.yaml`]

---

**Next:** See vNext roadmap for design system evolution plan.
