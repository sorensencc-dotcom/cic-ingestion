---
title: "Write plans keep one birth or death per batch, match places by whole part, and key ops by fingerprint"
author: Soren
date: 2026-11-01
branch: feat/familysearch-write
cost: { minutes: 26, tokens: 29837 }
id: l-017773d4
scope: repo
status: active
src: agent
touches:
  - src/adapters/familysearch/__tests__/writer.test.ts
  - src/adapters/familysearch/writePlan.ts
  - src/adapters/familysearch/writeApply.ts
---

## Decided
- A batch plans at most one birth and one death conclusion. A second, different one stays a note, because a person has one of each and two differing deaths would otherwise both be written.
- Places match by whole comma-separated parts, with one side allowed to be less specific ("Provo" matches "Provo, Utah, United States"). The old first-word substring let "San Diego" match "San Francisco".
- An operation id is its fingerprint (type plus sorted finding ids). Positional `op-N` ids renumbered whenever a re-plan added or dropped an operation, so a reviewed id could point at a different operation.
## Tried and ruled out
- Keeping the year-only batch key: it neither separated 13 Aug from 11 Aug nor stopped both being planned as writes.
## Watch out
- `writePlan.ts` uses CRLF line endings. Edit and Write rewrite the whole file to LF; restore with `sed -i 's/\r$//; s/$/\r/'` and confirm with `git diff --stat` that only intended lines changed.
- A shell heredoc inside a JS template literal silently stripped regex backslashes (`\s`, `\d`). Check the written regex in the diff.
- A test person without a birth fact counts as possibly living and every finding is dropped; keep the birth fact in fixtures.
In the code: `placeAgrees`, `opKey`, and the `plannedUnique` guard in `src/adapters/familysearch/writePlan.ts`; tests in `src/adapters/familysearch/__tests__/writer.test.ts`.
