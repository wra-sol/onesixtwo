# Thermo-loop remediation — main (uncommitted Live Draft QA)

**Status:** Complete
**Source:** Thermo-loop outer cycle 1 — thermo review + ADR pass
**Plan file:** docs/plans/thermo-loop-main.md
**Last updated:** 2026-06-25

## Summary

Close thermo **Approve** and ADR **Green** for uncommitted Live Draft round-engine QA work: spin-pair eligibility, AI tuning, and UI hints. Extract AI policy from the canonical state machine, dedupe scarcity messaging in `shared/live/`, simplify spin helpers, and add focused unit tests.

## Sources

| Source | Relevance |
|--------|-----------|
| Thermo review (cycle 1) | F-001 … F-011 |
| Thermo review (cycle 2) | Approve; F-012–F-015 polish applied |
| ADR pass (cycle 1) | ADR-GAP-001 |
| ADR 0001 | Live Draft canonical layer in `shared/live/` |
| live-modes-remediation.md | `shared/live/` owns domain; `src/` UI only |

## Scope

**In scope:** Thermo findings F-001–F-015 and ADR-GAP-001 for the changed files.

**Out of scope:** Home teaser, server replay validation, commits, unrelated refactors.

## Itemized work

| ID | Type | Blocked by | Work item | Verification | Status | Maps from |
|----|------|------------|-----------|--------------|--------|-----------|
| TLR-001 | AFK | — | Add `shared/live/live-draft-ai.ts`; move AI score/pick/reroll policy + constants | `npm test -- shared/live/live-draft.test.ts` | done | F-001, F-005, F-006, F-008, F-010 |
| TLR-002 | AFK | — | Simplify `hasDistinctPickPair`; drop redundant `userOk && aiOk` | unit test + draft tests | done | F-002, F-003, F-013 |
| TLR-003 | AFK | TLR-001 | Fix `aiPickFromRoundPool` top slice to 3 | draft tests | done | F-004 |
| TLR-004 | AFK | — | Add `liveDraftPlayerListMessage` in shared; wire config to it | lint + test | done | F-007, F-009, ADR-GAP-001 |
| TLR-005 | AFK | TLR-002 | Export/test `hasDistinctPickPair` directly | new unit tests pass | done | F-011 |
| TLR-006 | AFK | TLR-004 | Extract `snakeDraftSide` to `live-draft-snake.ts` | build + test | done | F-012 |
| TLR-007 | AFK | TLR-001 | Type AI position bonuses; name pick roll weights | build + test | done | F-014, F-015 |

## Verification (plan-level)

```bash
npm test
npm run build
```

## Deliverable

Thermo Approve, ADR Green, all TLR-* done.
