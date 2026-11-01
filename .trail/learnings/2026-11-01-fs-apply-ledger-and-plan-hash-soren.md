---
title: "fs:apply ledger and plan hash design"
author: Soren
date: 2026-11-01
branch: feat/familysearch-write
cost: { minutes: 1, tokens: 1273 }
id: l-7a8e3a81
scope: repo
status: active
src: agent
---

fs:apply keys its ledger on pid + op type + posted target (description id for attach, fact type + normalised date for add_fact, TRM marker for note), not the op fingerprint, because fingerprints and trmFactIds renumber when the extract is regenerated and a fingerprint key would let the same attachment post twice. The ledger check lives in a PersonWriter wrapper under applyPlan so it sees the fully resolved body (@op refs already replaced); intent is fsynced before the POST and an intent without a done line blocks that target until the user deletes the line by hand, which is why a failed POST is never auto-retried. The plan hash covers pid + operations + findings, not operations alone, because applyPlan re-plans from the findings: hashing only operations would let edited findings change the posted bodies under the same hash. The CLI hard-refuses non-beta writers on its own, independent of assertWritesAllowed, which admits production when FAMILYSEARCH_ALLOW_PRODUCTION_WRITES=1.
