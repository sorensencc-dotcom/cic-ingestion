---
title: Birth and death dates count as already on the tree only when provably equal
author: Soren
date: 2026-11-01
branch: feat/familysearch-write
cost: { minutes: 51, tokens: 72631 }
id: l-9c000f9c
scope: repo
status: active
src: agent
touches:
  - src/adapters/familysearch/__tests__/writer.test.ts
  - src/adapters/familysearch/writePlan.ts
---

## Decided
- For birth and death, an existing fact is "present" only for equal exact days, a bare-year finding matching the existing year, or identical text after punctuation is stripped. Anything else is a conflict and is written as a note, never as a fact. Reason: the old day comparison failed open whenever either date was in a format `dayOf` could not parse, so a different date could read as already present and the finding was silently dropped.
- Residence and other non-unique facts keep the old year-plus-day logic.
## Tried and ruled out
- Keeping the lenient year-only match for qualified or impossible dates ("about 5 March 1920", "31 February 1920"): two old tests encoded that on purpose, but it hides real disagreements, so the tests were rewritten to expect a note.
## Watch out
- Punctuation-only differences count as equal ("1-Jan-1920" vs "1 Jan 1920"), and month names that share a 3-letter English prefix parse ("januar" is January). Danish "maj" and "okt" do not parse, so they land as conflicts, which is the safe direction.
- Test iterations failed three times on my own test data, not on the code: wrong example dates and a regex whose backslashes were stripped by a shell heredoc.
In the code: `uniqueDateAgrees` and `factMatches` in `src/adapters/familysearch/writePlan.ts`; tests in `src/adapters/familysearch/__tests__/writer.test.ts`.
