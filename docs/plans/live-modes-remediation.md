# Live Modes Remediation Plan

Status: Draft  
Related: [ADR 0001 — Split Daily Matchup And Live Draft](../adr/0001-split-daily-matchup-and-live-draft.md)  
Context: Thermo-nuclear code quality review of uncommitted live-mode work (~5k lines)

## Goal

Ship Daily Matchup and Live Draft with **one canonical domain layer**, **one draft UI shell**, **shippable snapshot builds**, and **explicit failure modes** — without a cosmetic pass over duplicated architecture.

## Current Problems

| Area | Issue |
|------|-------|
| Layering | `functions/` imports runtime code from `src/lib/` for live modules |
| UI | `daily-matchup.tsx` and `live-draft.tsx` duplicate ~600 lines of parallel logic |
| Utilities | `hashSeed` / seeded RNG copied in 4 places; date helpers in 3 places |
| Server | N+1 MLB fetches, duplicate snapshot handlers, leaderboard POST self-fetches via HTTP |
| Client | Silent fixture fallback; leaderboard tabs use nested conditionals |
| Types | Casts at MLB boundary; DTO types live in `functions/_lib` |

No single file exceeds 1k lines yet. Restructure before the debt hardens.

## Target Architecture

```
src/                          shared/live/                    functions/
├── routes/ (thin wrappers)   ├── live-types.ts (+ contracts) ├── _lib/live/
├── components/               ├── daily-roster.ts             │   ├── mlb-client.ts
│   LiveDraftShell            ├── live-draft.ts               │   ├── mlb-parsers.ts
│   LiveLeaderboardSubmit     ├── pa-sim.ts                   │   ├── daily-matchup-snapshot.ts
└── lib/live-api-client.ts    ├── live-grades.ts              │   ├── live-draft-snapshot.ts
                              ├── live-mlb-mapper.ts          │   └── snapshot-cache.ts
                              ├── live-dates.ts               ├── api/daily-matchup.ts
                              └── live-fixtures.ts            ├── api/live-draft.ts
                                                              └── api/live-leaderboard.ts
```

**Rules**

- `shared/live/` owns domain logic (no React, no D1).
- `functions/` owns I/O (MLB HTTP, D1, caching).
- `src/` owns React UI and fetch wrappers only.
- RNG helpers stay canonical in `simulation.ts`; PA sim stays separate from classic season sim.

## Phase 0 — Quick Wins

**Size:** ~half day · **PR:** 1 · **Risk:** Low

### 0.1 Canonical seed utilities

- Add `createSeededRandomFromString(seed: string)` to `src/lib/simulation.ts`.
- Delete private `hashSeed` / `createSeededRandom` from:
  - `src/lib/pa-sim.ts`
  - `src/lib/live-draft.ts`
  - `functions/_lib/live-snapshot.ts`
- Import canonical helpers everywhere else.

**Done when:** `grep hashSeed` shows definitions only in `simulation.ts`.

### 0.2 Canonical date helpers

- Consolidate `src/lib/live-dates.ts` to export:
  - `challengeDate(now?: Date): string`
  - `targetDate(now?: Date): string`
- Delete `challengeDateFromNow` / `targetDateFromClient` naming split.
- Use in `src/routes/leaderboard.tsx` instead of inline `toLocaleDateString`.

**Done when:** one module is the single source of truth for Eastern challenge/target dates.

### 0.3 Move shared DTO types

- Move `LiveLeaderboardEntryRow` and related submit contract types into `live-types.ts` (or `live-contracts.ts`).
- Remove `../../functions/_lib/` imports from `src/lib/live-api-client.ts` and `LiveLeaderboardTable.tsx`.

**Done when:** client code does not import from `functions/`.

### 0.4 Explicit fixture fallback

- **Client:** remove silent catch → fixture in production paths; show error UI with retry.
- **Server:** keep `USE_LIVE_FIXTURES=true` env gate; on real failure return 503 (not a fake snapshot).
- If fallback is ever returned, set `fallback: true` and disable leaderboard submit in UI.

**Done when:** dev fixtures work via env flag; prod failures are visible to the user.

### Phase 0 acceptance

- [ ] `npm run test && npm run build && npm run lint` pass
- [ ] Happy-path behavior unchanged
- [ ] Fixture path is opt-in only

---

## Phase 1 — Shared Layer Extraction

**Size:** 1–2 days · **PR:** 1–2 · **Risk:** Medium · **Blocks:** Phases 2–4

### 1.1 Create `shared/live/`

Move (not copy) from `src/lib/`:

| Module | Notes |
|--------|-------|
| `live-types.ts` | Include leaderboard/submit DTOs from Phase 0 |
| `daily-roster.ts` | No React deps |
| `live-draft.ts` | Pure draft state machine |
| `pa-sim.ts` | Import RNG from `simulation.ts` |
| `live-grades.ts`, `live-mlb-mapper.ts` | Grading pipeline |
| `live-dates.ts` | From Phase 0 |
| `live-fixtures.ts` | Dev/test data |

Keep in `src/lib/` (client-only):

- `live-api-client.ts`

### 1.2 TypeScript / bundler wiring

- Add `tsconfig.shared.json` (or extend `tsconfig.node.json`) including `shared/`.
- Path alias: `@shared/live/*` → `./shared/live/*`.
- Update `vite.config.ts` alias.
- Verify `wrangler pages dev` resolves `shared/` (adjust config if needed).

### 1.3 Rewire imports

- `src/**` → `@shared/live/...`
- `functions/**` → `../../shared/live/...`
- Update test import paths.

**Out of scope:** classic `functions → src` imports (`game.ts`, `share-url.ts`, etc.).

### Phase 1 acceptance

- [ ] Zero `functions → src/lib/live-*` imports
- [ ] `npm run test && npm run build` pass
- [ ] Live mode unit tests pass

---

## Phase 2 — Server Hardening

**Size:** 1–2 days · **PR:** 1–2 · **Depends on:** Phase 1  
**Must ship before real MLB traffic.**

### 2.1 Split `live-snapshot.ts`

Target layout under `functions/_lib/live/`:

| File | Responsibility |
|------|----------------|
| `mlb-client.ts` | `fetchJson`, schedule, boxscore, roster |
| `mlb-parsers.ts` | Typed stat parsing at API boundary |
| `daily-matchup-snapshot.ts` | Daily Matchup orchestration |
| `live-draft-snapshot.ts` | Live Draft orchestration |
| `snapshot-cache.ts` | D1 read/write (from `live-api.ts`) |

### 2.2 Fix N+1 and redundant fetches

- **`buildRawFromRoster`:** batch `fetchSeasonStats` with `Promise.all` + concurrency cap (~10).
- **Cache:** `Map<"${personId}:${season}", stats>` for duration of one snapshot build.
- **`buildDailyMatchupSnapshot`:** reuse boxscores from the first loop; remove redundant opponent refetch.
- **`buildLiveDraftSnapshot`:** parallelize per-team roster builds with concurrency cap.

### 2.3 Unify snapshot API handlers

Replace duplicate `onRequest` / `onRequestLiveDraft` in `live-api.ts` with:

```ts
handleSnapshotRequest(context, {
  keyPrefix: 'daily-matchup' | 'live-draft',
  build,
  fixture,
})
```

Keep thin one-liner exports in `functions/api/daily-matchup.ts` and `live-draft.ts`.

### 2.4 Leaderboard POST — direct orchestration

In `functions/api/live-leaderboard.ts`:

1. Replace HTTP self-fetch with `resolveSnapshot(mode, challengeDate, db)`.
2. Validate payload via `parseLiveSubmitPayload(body)`.
3. Build lineups → `simulateBestOfThree` → insert → rank.

Include mode-specific fields (`aiPlayerIds` for live-draft) in the typed payload.

### 2.5 Optional follow-up (defer if needed)

- Cron-triggered snapshot prebuild before first user request.
- Document in deploy notes.

### Phase 2 acceptance

- [ ] Snapshot cold build completes under Worker timeout (log timings locally)
- [ ] POST does not HTTP-fetch `/api/daily-matchup` or `/api/live-draft`
- [ ] Submit rank matches server re-sim (manual or integration test)

---

## Phase 3 — UI Consolidation

**Size:** ~1 day · **PR:** 1 · **Depends on:** Phase 1

### 3.1 Extract `LiveLeaderboardSubmit`

Mirror `LeaderboardSubmit.tsx`:

- Lazy initials init
- Validation and loading state
- Link to `/leaderboard`

Use from both modes via `submitSlot` on `LiveResultScreen`.

### 3.2 Extract `useLiveDraftSession`

Shared hook state:

- `snapshot`, `draftState`, `selectedPlayerId`, `search`, `series`
- `playersById`, `filteredPlayers`
- `handleSelect`, `handleAssign`, `handleSimulate`

Mode config:

```ts
type LiveModeConfig = {
  mode: LiveModeId
  fetchSnapshot: () => Promise<LiveSnapshot>
  initDraft: (snapshot) => DraftState
  onAssign: (state, player, position) => DraftState
  getDisabledReason: (player, state) => string | null
  buildSeries: (state, snapshot) => SimulatedSeries
  buildSubmitPayload: (state, snapshot) => LiveSubmitInput
}
```

### 3.3 Collapse routes

- `daily-matchup.tsx` → thin wrapper (~40 lines) + `LiveDraftShell`
- `live-draft.tsx` → thin wrapper (~60 lines) + AI reveal + dual lineup grids

### 3.4 Leaderboard board registry

Replace nested `board === 'classic'` ternaries in `leaderboard.tsx` with a `BOARDS` registry and one load/render path.

### Phase 3 acceptance

- [ ] Route files under ~80 lines each
- [ ] No duplicated submit JSX
- [ ] Manual QA: both modes draft → sim → submit → leaderboard tab

---

## Phase 4 — Type Boundaries

**Size:** 0.5–1 day · **Can overlap:** Phase 2.2

### 4.1 MLB parse layer

- `mlb-parsers.ts`: explicit return types; return `null` on invalid data.
- Replace `Record<string, unknown>` + silent defaults (`era ?? 4.5`) with skip-or-warn.
- Narrow `batSide` / `pitchHand` at the boundary.

### 4.2 Submit payload validation

- `parseLiveSubmitPayload(raw): LiveSubmitPayload | ValidationError`
- Exhaustive mode switch for required fields.
- Remove `record as Partial<LiveSubmitPayload>`.

### Phase 4 acceptance

- [ ] No stray `as LivePlayer` casts outside parse functions in snapshot build path

---

## Phase 5 — Polish (Post-Merge)

| Item | Effort |
|------|--------|
| Replace `window.location.reload()` with in-app restart | Small |
| Prebuild snapshots via cron | Medium |
| E2E smoke test for live modes | Medium |

---

## PR Sequence

```
PR1  Phase 0 — utilities, dates, DTO move, explicit fixtures
PR2  Phase 1 — shared/live/ extraction + import rewires
PR3  Phase 2.1–2.2 — split snapshot + batch MLB fetches
PR4  Phase 2.3–2.4 — unified handler + direct POST sim
PR5  Phase 3 — LiveDraftShell + leaderboard registry
PR6  Phase 4 — MLB parsers + payload validation
```

PR3 and PR4 can merge as one PR if preferred.  
**Do not merge PR5 before PR2.**

---

## Final Approval Bar

- [ ] No runtime `functions → src/lib/live-*` imports
- [ ] Single seed/date utility surface
- [ ] Snapshot build batched; no redundant boxscore fetch
- [ ] Leaderboard POST calls snapshot resolver directly
- [ ] Fixture fallback is env-gated and visible in UI
- [ ] Route files are thin wrappers, not parallel 300-line state machines
- [ ] `npm run test && npm run build && npm run lint` pass
- [ ] Manual: Daily Matchup + Live Draft + both leaderboard tabs

---

## Risks

| Risk | Mitigation |
|------|------------|
| Wrangler can't resolve `shared/` | Test `wrangler pages dev` early in PR2; use relative imports if needed |
| Moving files breaks vitest paths | Run tests after each move |
| MLB API rate limits during dev | `USE_LIVE_FIXTURES=true` locally; batch + cache before real API in CI |
| Scope creep into classic `functions → src` | Limit Phase 1 to live modules only |

---

## Out of Scope

- Refactoring classic mode's existing `functions → src` imports
- Merging `pa-sim.ts` into `simulation.ts` (shared RNG only)
- Snapshot cron unless production requires it at launch

---

## Positive Wins to Preserve

- ADR split (separate modes and leaderboards)
- Pure draft state in `live-draft.ts` with tests
- `daily-roster.ts` as canonical lineup model
- `live-mlb-mapper.ts` + `live-grades.ts` grading pipeline
- Partial UI extraction (`LiveLineupGrid`, `LivePlayerCard`, `LiveResultScreen`, `ModeSelect`)
- `LeaderboardSubmit` lazy-init fix
