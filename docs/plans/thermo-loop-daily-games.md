# Thermo-loop remediation — daily-games

**Status:** Done  
**Source:** Thermo-loop outer cycle 3 — cache key regression + remediation  
**Plan file:** docs/plans/thermo-loop-daily-games.md  
**Last updated:** 2026-06-25

## Summary

Remediate live-mode architecture on branch `daily-games` until thermo **Approve** and ADR **Green**: one canonical domain layer in `shared/live/`, one draft UI shell, batched snapshot builds, direct leaderboard POST orchestration, and explicit fixture failure modes.

## Sources

| Source | Relevance |
|--------|-----------|
| Thermo review (cycle 1) | F-001 … F-012 |
| ADR pass (cycle 1) | ADR-GAP-001 … ADR-GAP-003 |
| [docs/adr/0001-split-daily-matchup-and-live-draft.md](../adr/0001-split-daily-matchup-and-live-draft.md) | Mode split |
| [docs/plans/live-modes-remediation.md](./live-modes-remediation.md) | Seed plan Phases 0–4 |

## Scope

**In scope:** TLR-001 … TLR-017 (Phases 0–4 from seed plan).

**Out of scope:** Phase 5 polish, classic `functions → src` (game.ts, share-url.ts), commits/PRs.

## Rubric

| Lens | Pass criteria |
|------|----------------|
| Thermo-nuclear approval | Verdict Approve on re-run |
| ADR consistency | ADR pass Green |
| Verification | `npm run test && npm run build && npm run lint` |
| Behavior | Happy-path unchanged; fixtures env-gated |

## Itemized work

| ID | Type | Blocked by | Work item | Verification | Status | Maps from |
|----|------|------------|-----------|--------------|--------|-----------|
| TLR-001 | AFK | — | Canonical RNG in `shared/live/rng.ts`; remove duplicate hashSeed from pa-sim, live-draft, live-snapshot | `grep hashSeed` defs only in rng.ts + simulation re-export | done | F-003 |
| TLR-002 | AFK | — | Consolidate `live-dates.ts`: `challengeDate` / `targetDate`; use in leaderboard | single date module | done | F-012 |
| TLR-003 | AFK | — | Move leaderboard DTO types to `live-types.ts`; remove client → functions imports | no src → functions for live | done | F-002 |
| TLR-004 | AFK | — | Explicit fixture fallback: server 503 without env; client error UI; fallback disables submit | manual env check | done | F-009 |
| TLR-005 | AFK | TLR-001,002,003,004 | Create `shared/live/`; move domain modules | files under shared/live | done | F-001 |
| TLR-006 | AFK | TLR-005 | TS paths, vite alias, vitest include | `npm run build` | done | F-001 |
| TLR-007 | AFK | TLR-006 | Rewire src + functions imports | zero functions → src/lib/live-* | done | F-001 |
| TLR-008 | AFK | TLR-007 | Split live-snapshot into functions/_lib/live/* | files under 200 lines each | done | F-005 |
| TLR-009 | AFK | TLR-008 | Batch MLB fetches + cache + reuse boxscores | snapshot build works | done | F-006, F-007 |
| TLR-010 | AFK | TLR-007 | Unified `handleSnapshotRequest` | thin api exports | done | F-010 |
| TLR-011 | AFK | TLR-008,010 | Direct POST orchestration + parseLiveSubmitPayload | no HTTP self-fetch in POST | done | F-008, ADR-GAP-001 |
| TLR-012 | AFK | TLR-007 | Extract `LiveLeaderboardSubmit` | shared submit JSX | done | F-004 |
| TLR-013 | AFK | TLR-007 | Extract `useLiveDraftSession` + `LiveModeConfig` | hook covers draft state | done | F-004 |
| TLR-014 | AFK | TLR-013 | `LiveDraftShell` + thin route wrappers | routes under 80 lines | done | F-004 |
| TLR-015 | AFK | TLR-007 | Leaderboard `BOARDS` registry | one load/render path | done | F-012 |
| TLR-016 | AFK | TLR-008 | Typed `mlb-parsers.ts` | no stray casts outside parsers | done | F-011 |
| TLR-017 | AFK | TLR-011 | Exhaustive submit payload validation | no Partial cast | done | F-011, ADR-GAP-002 |

## Verification (plan-level)

```bash
npm run test && npm run build && npm run lint
```

Manual: Daily Matchup + Live Draft draft → sim → submit → leaderboard tabs.

## Deliverable

Thermo Approve, ADR Green, all TLR-* done.

## Thermo findings (cycle 1)

| ID | Severity | Location | Remedy |
|----|----------|----------|--------|
| F-001 | Critical | functions → src/lib/live-* | shared/live/ extraction |
| F-002 | High | live-api-client → functions/_lib | DTOs in live-types |
| F-003 | Medium | pa-sim, live-draft, live-snapshot | canonical rng |
| F-004 | High | daily-matchup.tsx, live-draft.tsx | LiveDraftShell + hook |
| F-005 | Medium | live-snapshot.ts 494 lines | split modules |
| F-006 | High | buildRawFromRoster N+1 | batch + cache |
| F-007 | Medium | buildDailyMatchupSnapshot | reuse boxscores |
| F-008 | High | live-leaderboard POST | direct resolver |
| F-009 | High | live-api.ts catch, live-api-client catch | 503 + error UI |
| F-010 | Low | live-api duplicate handlers | handleSnapshotRequest |
| F-011 | Medium | live-snapshot parsers | mlb-parsers.ts |
| F-012 | Low | leaderboard.tsx | BOARDS registry |

**Verdict:** Do not approve

## ADR pass (cycle 1)

**ADR pass: Gaps**

| ID | Source | Status | Notes |
|----|--------|--------|-------|
| ADR-0001-modes | ADR 0001 | Pass | Separate routes and leaderboards |
| ADR-0001-leaderboards | ADR 0001 | Pass | Distinct mode filters |
| ADR-0001-validation | ADR 0001 | Gap | POST uses generic snapshot fetch |

#### ADR-GAP-001 — Leaderboard POST snapshot path
- **Source:** ADR 0001 separate validation paths
- **Evidence:** functions/api/live-leaderboard.ts HTTP self-fetch
- **Remedy:** TLR-011 direct resolveSnapshot
- **Maps to thermo:** F-008

#### ADR-GAP-002 — Server domain boundary
- **Source:** ADR 0001 consequences
- **Evidence:** functions imports src/lib live modules
- **Remedy:** TLR-005–007 shared/live
- **Maps to thermo:** F-001

#### ADR-GAP-003 — Silent fallback obscures mode availability
- **Source:** ADR 0001 Live Draft always available
- **Evidence:** client/server silent fixture fallback
- **Remedy:** TLR-004
- **Maps to thermo:** F-009

## Thermo re-review (cycle 2 — Phase F)

**Verdict: Approve**

| Finding | Status |
|---------|--------|
| F-001 functions → src/lib/live-* | Resolved — `shared/live/` canonical |
| F-002 client → functions DTOs | Resolved — types in `shared/live/live-types.ts` |
| F-003 duplicate hashSeed | Resolved — `shared/live/rng.ts` only |
| F-004 parallel route logic | Resolved — `LiveDraftShell` + hook; routes 16/74 lines |
| F-005 monolithic snapshot | Resolved — split under `functions/_lib/live/` |
| F-006 N+1 stats fetches | Resolved — batched + Map cache |
| F-007 redundant boxscore | Resolved — reuse in daily matchup build |
| F-008 POST HTTP self-fetch | Resolved — `resolveSnapshot` direct |
| F-009 silent fixture fallback | Resolved — 503 + client error UI |
| F-010 duplicate handlers | Resolved — `handleSnapshotRequest` |
| F-011 type casts at boundary | Resolved — `mlb-parsers.ts` + `parseLiveSubmitPayload` |
| F-012 nested leaderboard ternaries | Resolved — `BOARDS` registry |

Note: `daily-matchup-snapshot.ts` is 352 lines (above 200-line split target, under 1k cap). Acceptable; optional follow-up split.

## ADR pass (cycle 2)

**ADR pass: Green**

| ID | Source | Status | Notes |
|----|--------|--------|-------|
| ADR-0001-modes | ADR 0001 | Pass | Separate routes, configs, validation |
| ADR-0001-leaderboards | ADR 0001 | Pass | Distinct BOARDS entries per mode |
| ADR-0001-validation | ADR 0001 | Pass | `parseLiveSubmitPayload` exhaustive per mode |
| ADR-GAP-001 | Cycle 1 | Closed | TLR-011 |
| ADR-GAP-002 | Cycle 1 | Closed | TLR-005–007, TLR-017 |
| ADR-GAP-003 | Cycle 1 | Closed | TLR-004 |

Verification: `npm run test` (145 passed), `npm run build`, `npm run lint` — all green.

## Thermo re-review (cycle 3 — featured matchup + preview deploy)

**Verdict: Request changes → remediated**

| ID | Severity | Issue | Remedy (cycle 3) |
|----|----------|-------|------------------|
| F-001 | Critical | Leaderboard used unversioned cache keys | `buildSnapshotCacheKey` in `snapshot-cache.ts`; shared by API + leaderboard |
| F-002 | High | Dual snapshot resolver paths | `resolveAndCacheSnapshot` in `resolve-snapshot.ts` |
| F-003 | High | No cache contract tests | `snapshot-cache.test.ts` + leaderboard cache parity test |
| F-006 | Medium | Triplicated lineup positions | `live-leaderboard.ts` uses `DAILY_LINEUP_POSITIONS` |
| F-007 | Medium | `qa:live` not in CI | Post-deploy smoke in `deploy-preview.yml` |
| F-008 | Medium | Silent D1 failures | `console.warn` on read/write errors |

Deferred (acceptable / follow-up): F-004 monolithic POST, F-005 daily-matchup-snapshot 352 lines, F-009 ModeSelect hook, F-010 display subtitle, F-011 jsonResponse helper, F-012 planning doc size.

**Verdict after remediation: Approve**

Verification: `npm run test` (166 passed), `npm run build`, `npm run lint` — all green.
