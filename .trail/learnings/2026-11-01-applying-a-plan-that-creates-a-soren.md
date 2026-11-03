---
title: Applying a plan that creates a source description needs an explicit absence check
author: Soren
date: 2026-11-01
branch: feat/familysearch-write
cost: { minutes: 11, tokens: 16249 }
id: l-eeb1a641
scope: repo
status: active
src: agent
touches:
  - src/adapters/familysearch/__tests__/writer.test.ts
  - src/adapters/familysearch/writeApply.ts
  - src/adapters/familysearch/writePlan.ts
---

## Decided
- `applyPlan` refuses any plan containing a create-source-description op unless the caller sets `sourceDescriptionsVerified: true` (or declares the description in `planOptions.existingSources`, which turns the op into an attach). Reason: the person document only lists descriptions the person already references, so an unattached description such as one made by an earlier run is invisible, and a re-run posts a duplicate that cannot be detected or undone from code.
- The planner also matches an inlined description by normalised title, since captured descriptions carried no marker note.
## Tried and ruled out
- Relying on the `[TRM-SOURCE:...]` note marker: captured data showed notes on 0 of 31 descriptions.
## Watch out
- Title matching only helps when the description is inlined on the person; it cannot see unattached ones. Before any create, check the beta Source Box by hand or declare the id in `existingSources`.
In the code: guard in `applyPlan` in `src/adapters/familysearch/writeApply.ts`; `findDescription` title match in `src/adapters/familysearch/writePlan.ts`; tests in `src/adapters/familysearch/__tests__/writer.test.ts`.
