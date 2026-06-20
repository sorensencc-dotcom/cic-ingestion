# CIC Design System → Agent Behavior Mapping

**Version:** 1.0.0  
**Purpose:** Map design system components to agent roles, behaviors, and policy enforcement  
**Audience:** Agent developers, Council voters, Safety Sandbox operators  
**Governance:** Subject to council votes when mapping affects agent decision-making

---

## Design Tokens → Agent Behaviors

### Color Tokens

| Token | Semantic | Agent Category | Behavior Rule | Policy Rail |
|-------|----------|-----------------|----------------|------------|
| `color/primary` | Brand/primary action | All | Use for CTA buttons, primary navigation | Mandatory for user-facing UIs |
| `color/success` | Positive outcome | Synthesize, Audit | Render completed tasks, policy approval status | Must have ≥4.5:1 contrast |
| `color/warning` | Alert/caution | Audit, Orchestrate | Flag drift detected, policy near-threshold | Must pair with icon (not color-only) |
| `color/critical` | Error/failure/block | Safety Sandbox, Audit | Block policy violations, safety rejections, rollback states | Immutable; requires operator override |
| `color/neutral` | Disabled, metadata | Ingest, Enrich | Inactive fields, historical data, read-only context | Background-only; no text |

**Agent Decision Flow:**
```
Agent wants to render status → Query color token by semantic intent
  → Load color + accessibility rules → Validate contrast → Apply color
  → Log choice to Evidence Vault → Optional council escalation if critical
```

### Spacing Tokens

| Token | Value | Usage | Agent Category | Constraint |
|-------|-------|-------|-----------------|-----------|
| `spacing/xs` | 4px | Inline, tight components | Ingest | Minimum; use for form field padding |
| `spacing/sm` | 8px | Component margins, small gaps | Enrich, Ingest | Standard internal spacing |
| `spacing/md` | 16px | Section margins, medium spacing | Orchestrate, Synthesize | Default section padding |
| `spacing/lg` | 24px | Major section breaks | Synthesize, Audit | Use between major sections only |
| `spacing/xl` | 32px | Page-level spacing | All (dashboard layout) | Rare; only top-level sections |

**Agent Decision Flow:**
```
Agent laying out component → Determine visual hierarchy level
  → Query appropriate spacing token → Apply via grid system
  → Validate responsive rules (mobile ≤80% of desktop) → Render
```

### Typography Tokens

| Token | Font | Weight | Size | Line-height | Usage | Agent Category |
|-------|------|--------|------|------------|-------|-----------------|
| `type/heading-1` | System sans | 700 | 32px | 1.2 | Page title | Synthesize |
| `type/heading-2` | System sans | 700 | 24px | 1.2 | Section title | Orchestrate, Synthesize |
| `type/body` | System sans | 400 | 14px | 1.5 | Content, tables | Enrich, Audit |
| `type/caption` | System sans | 400 | 12px | 1.4 | Metadata, timestamps | Audit, Ingest |
| `type/code` | Monospace | 400 | 13px | 1.6 | Code blocks, terminal output | Enrich, Audit |

**Agent Decision Flow:**
```
Agent outputting text → Determine content type (heading/body/caption/code)
  → Query matching typography token → Apply font + size + line-height
  → Validate legibility (reading time <5min) → Render
```

### Timing Tokens

| Token | Duration | Easing | Usage | Agent Category | Rule |
|-------|----------|--------|-------|-----------------|------|
| `timing/fast` | 150ms | cubic-bezier(0.4, 0, 0.2, 1) | Button press, hover | UI agents | Use for immediate feedback |
| `timing/normal` | 300ms | cubic-bezier(0.4, 0, 0.2, 1) | Fade, slide, state change | Synthesize | Default; most animations use this |
| `timing/slow` | 500ms | cubic-bezier(0.4, 0, 0.2, 1) | Emphasis, attention-draw | Audit (alerts) | Rare; only for critical alerts |
| `timing/instant` | 0ms | none | Critical state (block) | Safety Sandbox | No animation; immediate block |

**Agent Decision Flow:**
```
Agent animating state change → Determine urgency (immediate/normal/slow)
  → Query timing token → Apply to CSS transition
  → Validate accessibility (≤5s for comprehension) → Render
```

---

## Interaction Patterns → Agent Categories

### Pattern: INGEST (Read, Collect, Import)
**Design pattern characteristics:**
- Input focus (forms, file uploads, queries)
- Clear required vs. optional fields
- Real-time validation feedback
- Batch import with preview

**Agent roles using pattern:**
- Harvester (ingest repo data)
- Memory Store (ingest signals)
- Evidence Collector (ingest packets)

**Interaction guidelines:**
- ✅ Provide inline validation (don't wait for submit)
- ✅ Show upload progress (bytes/sec for large files)
- ✅ Preview data before commit (immutable once committed)
- ✅ Batch operations must show diff before apply
- ❌ Do not silently drop invalid rows
- ❌ Do not auto-proceed without user/council approval

**Policy rails:**
- Max batch size: 10,000 items (else council vote required)
- Validation errors block submit (non-overridable)
- Immutable audit trail (all ingested data timestamped + approver logged)

**Example:** Agent ingesting GitHub repo metadata
```
1. User/agent selects repo
2. Agent queries repo API (validated via Ingest pattern)
3. Agent previews 10 sample commits (pattern: PREVIEW)
4. Agent shows metadata transformation (schema mapping)
5. User/council approves (explicit gate)
6. Agent commits to Evidence Vault (pattern: AUDIT)
```

### Pattern: ENRICH (Compute, Analyze, Score)
**Design pattern characteristics:**
- Computation display (metrics, charts, detailed results)
- Ranking & sorting
- Drill-down capabilities
- Relative vs. absolute comparisons

**Agent roles using pattern:**
- Analyzer (code metrics)
- Cost Estimator (phase planning)
- Scoring Engine (lead/model rank)

**Interaction guidelines:**
- ✅ Show computation method (transparency)
- ✅ Display confidence/uncertainty bounds
- ✅ Provide drill-down (why this rank?)
- ✅ Show historical trend (how did score change?)
- ❌ Do not hide computation details
- ❌ Do not display single-point estimates without confidence intervals

**Policy rails:**
- High-stakes scorings (model ranking) require council review if >3-point delta
- Computations must be deterministic (replay audit trail)
- Drift detection: if score changes >10% month-over-month, escalate

**Example:** Agent ranking candidate models
```
1. Agent fetches eval results
2. Agent computes rank score (shown: formula + parameters)
3. Agent displays confidence interval (e.g., Rank 2–4, 95% confidence)
4. User clicks drill-down (shows why this rank, past trends)
5. If delta from prior rank >3 points, council vote (pattern: ESCALATE)
```

### Pattern: ORCHESTRATE (Schedule, Decide, Route)
**Design pattern characteristics:**
- Timeline/phase visualization
- Decision trees & branching
- State machine display
- Resource allocation view

**Agent roles using pattern:**
- Planner (task scheduling)
- Orchestrator (execution routing)
- Council (voting & escalation)

**Interaction guidelines:**
- ✅ Show dependencies (what blocks task X?)
- ✅ Display constraints (resource, time, policy limits)
- ✅ Preview impact of decision (cascade effect analysis)
- ✅ Provide rollback option (decision reversible?)
- ❌ Do not auto-execute without explicit approval
- ❌ Do not hide cascade impact (if I approve this, what else changes?)

**Policy rails:**
- Phase transitions require council majority (>50%) approval
- Rollback decisions locked for 24h (prevent flip-flopping)
- Cascade depth limit: max 5 levels (else break into smaller tasks)

**Example:** Agent scheduling next phase
```
1. Agent identifies next phase ready (all blockers cleared)
2. Agent shows timeline (current phase end → new phase start)
3. Agent shows resource forecast (CPU, memory, token budget)
4. Agent shows cascade (which downstream phases affected?)
5. Agent awaits council vote (pattern: COUNCIL_VOTE) or operator approval
6. On approval, agent logs decision to vault (pattern: AUDIT)
```

### Pattern: SYNTHESIZE (Generate, Report, Export)
**Design pattern characteristics:**
- Output format selection (markdown, JSON, PDF)
- Report templates
- Export with versioning
- Summary + detail views

**Agent roles using pattern:**
- Synthesizer (generate recommendations)
- Reporter (create summaries)
- Exporter (package outputs)

**Interaction guidelines:**
- ✅ Provide output format options (not all agents consume same format)
- ✅ Show data lineage (what inputs generated this output?)
- ✅ Enable regeneration (can user re-run with different params?)
- ✅ Version all exports (outputs are immutable once shared)
- ❌ Do not generate without explicit trigger
- ❌ Do not share outputs outside governance boundary without approval

**Policy rails:**
- Sensitive exports (containing model weights, credentials, PII) require encryption + audit log
- All exports versioned + signed (integrity guarantee)
- External-facing exports require council review if new content type

**Example:** Agent generating handoff doc
```
1. Agent has completed analysis (Phase 24.1–24.5)
2. Agent queries handoff template (pattern: TEMPLATE_SELECT)
3. Agent populates doc (what changed, why, test results)
4. Agent shows preview (pattern: PREVIEW)
5. Agent signs doc (deterministic hash + approver signature)
6. Agent exports to vault (pattern: AUDIT)
```

### Pattern: AUDIT (Validate, Review, Enforce)
**Design pattern characteristics:**
- Policy enforcement display
- Violation highlighting
- Approval workflows
- Audit trail review

**Agent roles using pattern:**
- Safety Sandbox (pre-render validation)
- Code Review Agent (PR checks)
- Compliance Agent (policy audit)

**Interaction guidelines:**
- ✅ Show violation severity (error vs. warning vs. info)
- ✅ Provide fix suggestions (auto-fix if safe)
- ✅ Log approvals (who approved this violation override?)
- ✅ Escalate per policy (who needs to approve this type?)
- ❌ Do not auto-fix without approval
- ❌ Do not hide violations (shadow-banning breaks trust)

**Policy rails:**
- Policy violations block deployment (non-overridable by agents)
- Operator overrides require explicit reason + timestamp
- All audit decisions logged to vault (immutable record)

**Example:** Agent reviewing PR before merge
```
1. Agent runs design system checks (pattern: AUDIT)
2. Agent finds token contrast violation (error-level)
3. Agent suggests fix (auto-proposed)
4. If design author approves, agent applies fix (pattern: AUTO_FIX)
5. If design author refuses, agent escalates to council (pattern: ESCALATE)
6. Council votes; decision logged to vault
```

---

## Interaction Guidelines → Policy Enforcement

### Determinism Guideline
**Rule:** All agent outputs must be deterministic (same input → same output under fixed sampling params)

**Agent behaviors:**
- No randomization in core logic (allowed in exploration only, logged separately)
- No time-dependent output (use timestamps as input, not clock)
- All decisions logged to vault (replayable)

**Design system enforcement:**
- Tokens must be constants (no dynamic generation in Phase 1)
- Patterns must have deterministic selector rules (no random component ordering)
- Guidelines must be immutable (no hidden tuning)

**Policy rail:** Non-deterministic behavior flagged by Replay Harness; blocks promotion

### Safety Guideline
**Rule:** All design system queries must pass through Safety Sandbox; no hardcoded values

**Agent behaviors:**
- Query design system API (don't embed tokens directly)
- Validate token existence before use (fail gracefully if missing)
- Log all queries (for drift detection)

**Design system enforcement:**
- Token API has schema validation (rejects invalid requests)
- Missing token queries surface as alerts (pattern broken?)
- Hardcoded value detection (grep for colors/spacing/font-size; flag in PR)

**Policy rail:** Safety Sandbox rejects tokens not in canonical system

### Transparency Guideline
**Rule:** All agent decisions must explain reasoning; hidden decisions are escalated

**Agent behaviors:**
- Show computation method (not just result)
- Explain policy application (why this rule applied to this case?)
- Surface uncertainty (confidence intervals, drift flags)

**Design system enforcement:**
- Pattern violations logged with reason (why didn't this match?)
- Token deviations tracked (agent used non-canonical color; why?)
- Cascade analysis shown (if decision changes X, then Y changes too)

**Policy rail:** Unexplained deviations → council escalation

### Autonomy-Bounded Guideline
**Rule:** Agents can use design system autonomously, but cannot modify it without council vote

**Agent behaviors:**
- Query and apply patterns (allowed)
- Propose new patterns (not auto-approved; requires vote)
- Adapt guidelines per context (if approved by council first)

**Design system enforcement:**
- Design system modifications require council approval (immutable without vote)
- Agent-generated patterns go through review workflow (Pattern: REVIEW_WORKFLOW)
- Guideline amendments trigger drift detection (flag as potential safety issue)

**Policy rail:** Agents attempting to modify design system without council vote are blocked

---

## Evidence Vault Integration

All design system decisions logged as Evidence packets:

```yaml
packet:
  id: "DS-2026-06-17-001"
  type: "DESIGN_DECISION"
  timestamp: "2026-06-17T14:30:00Z"
  agent_id: "synthesizer-v2"
  governance_layer: "design-system"
  
  decision:
    category: "token-usage"  # or pattern|guideline|workflow
    action: "applied-color-token"
    token_name: "color/success"
    context: {
      output: "phase-complete-notification",
      reason: "semantic match: positive outcome",
      alternative_tokens: ["color/primary", "color/neutral"]
    }
    
  approver: "council-vote-2026-06-17-023"  # or operator ID
  vault_signature: "sha256:abc123..."
```

**Query example:**
```sql
SELECT * FROM evidence_vault 
WHERE packet_type='DESIGN_DECISION' 
  AND decision.category='token-usage'
  AND timestamp > '2026-06-01'
ORDER BY timestamp DESC
LIMIT 100
```

---

## Self-Healing Triggers

| Condition | Detection | Recovery |
|-----------|-----------|----------|
| Token missing from canonical system | Agent query fails (404) | Log to Ingest queue; create issue; escalate to design lead |
| Pattern schema mismatch | Agent output validation fails | Revert to prior pattern version; log to Evidence Vault |
| Policy rail violation | Safety Sandbox blocks | Reject operation; notify agent + council |
| Guideline drift detected | Drift rules engine spike | Analyze recent changes; propose guideline amendment |
| Broken cross-link (e.g., token renamed) | Evidence replay fails | Snapshot rollback + rerun; update mapping |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Agent design system query success rate | ≥99% | Queries / Failures in agent logs |
| Pattern conformance rate | ≥95% | Conformant outputs / Total outputs |
| Policy rail violation rate | ≤2% | Violations flagged / Total operations |
| Council vote approval time | ≤24h | Submission → Approval timestamp |
| Design change replay success rate | 100% | Replay passes / Total replays |

---

**Related documents:**
- `CIC_DESIGN_SYSTEM_INDEX.md` — Retrieval index
- `CIC_DESIGN_SYSTEM_VNEXT_ROADMAP.md` — Evolution timeline
- `cic-governance-manifest.yaml` — Principles & layers
- `CIC_AGENT_INTERACTION_GUIDELINES.md` — Detailed rules

