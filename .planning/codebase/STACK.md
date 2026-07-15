# STACK.md — cic-ingestion (Phase 5 focus)

## Languages
- TypeScript 5.4.5 (primary) — `C:\dev\cic-ingestion\tsconfig.json:1`, `package.json:17`
- SQL (PostgreSQL dialect) for governance/lineage schemas — `postgres/phase4/*.sql`, `postgres/phase6/*.sql`

## Runtime
- Node.js, ESM (`"type": "module"`) — `package.json:5`
- Entry: `src/index.js` (compiled) — `package.json:6`

## Build / Test tooling
- Build: `tsc --project tsconfig.json` — `package.json:8`
- Test runner: Jest 29.7.0 + ts-jest 29.1.1 — `package.json:20-21`, config at `jest.config.cjs:1`
- No bundler (plain `tsc` emits to `dist/`) — `dist/` mirrors `src/` 1:1

## Package manager
- npm, `package-lock.json` present (155KB) — lockfile committed
- `.npmrc` NOT read (forbidden file per role instructions)

## Critical dependencies (≤15)
| dep | why it matters |
|---|---|
| `pg` (implicit, used not declared in package.json deps) | Postgres client for all governance/lineage/audit stores — `src/governance/GovernanceEnvelopeCache.ts:1`, `src/metrics/MetricsEngine.ts:1`, `src/governance/GovernanceReplayHarness.ts:1`. **Not listed in `package.json` dependencies — likely a hoisted/transitive or undeclared dep.** |
| `qdrant-js` 1.7.0 | vector store for KB/RAG side of repo, unrelated to Phase 5 canary path — `package.json:13` |
| `axios` 1.6.0 | HTTP client for adapters (FamilySearch, Grok) — `package.json:14` |
| `typescript` 5.4.5 | strict compile target for all governance/canary modules |
| `jest` + `ts-jest` | all Phase 3/4/5/6 pipeline behavior is currently validated ONLY via `*-e2e.test.ts` files, not standalone integration scripts |
| `ajv` 8.12.0 | JSON schema validation (used elsewhere in repo, not in governance path directly) |

## Notable
- No ORM — all Postgres access is raw parameterized SQL via `pg.Pool.query()` (see `GovernanceEnvelopeCache.ts:26`, `MetricsEngine.ts:62`)
- `.env` present at repo root — existence noted only, not read (`C:\dev\cic-ingestion\.env`)
