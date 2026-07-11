# CIC Orchestrator v3.0.0

Semantic versioned orchestrator subsystem for Castironforge CIC.

## Layout

- `dag/` — dynamic DAG engine with live mutation
- `scheduler/` — task scheduler + tick loop
- `registry/` — module registry + module metadata
- `mcp/` — MCP event bus + message routing
- `replay/` — replay engine for deterministic runs

## Invariants

- DAG nodes are pure functions.
- Scheduler is deterministic and monotonic.
- Registry is immutable after initialization.
- MCP bus is non-blocking and best-effort.
- Replay engine produces identical outputs for identical inputs.
