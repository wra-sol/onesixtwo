# Sim 162 — New Mode Plan

Status: Approved
Related: [CONTEXT.md](../../CONTEXT.md), [HANDOFF.md](../../HANDOFF.md)
Context: Stakeholder decisions locked across design session (pool choice, roster depth, playoff bracket, leaderboard, compute location, draft mechanic, grail outcome).

## One-line summary

A new "Sim 162" game mode: draft a **25-man roster** (current MLB or all-time legends, user's choice), **simulate a 162-game season** client-side with full rotation / bullpen / bench depth, then **broadcast marquee regular-season games and a full MLB playoff bracket** if you qualify — with the **World Series championship** as the grail and a D1 leaderboard.

## Locked decisions (stakeholder)

| Axis | Decision |
|---|---|
| Player pool | User chooses at start: current MLB (live `LivePlayer` via MLB API) OR all-time legends (Classic `Player` via Lahman, adapted) |
| Roster depth | Full: 5-man rotation, multi-arm bullpen by leverage, bench pinch-hitters. Drafting deep pitching and a bench genuinely changes outcomes. |
| Playoffs | Full 12-team MLB bracket (WC / DS / LCS / WS). Box scores only if you miss the postseason. |
| Persistence | D1 leaderboard (like the live modes) + share URL |
| Compute location | Client-side after snapshot fetch |
| Draft mechanic | Solo — pick 25 from the pool (no AI opponent, no snake). Quota-enforced. |
| Grail | World Series championship (tiers: Missed playoffs → WC → DS → LCS → WS Champs) |
| Season UX | 162 box scores in the background; animated broadcast only for 1-3 marquee regular-season games + every playoff series the user plays |

## Architecture — hybrid compute model (critical)

"Full bracket" implies league standings, which implies all 30 teams' records. **Do NOT PA-sim the whole league** — that's ~2,430 games (~5-12s) and requires generating 29 full 25-man rosters. Instead:

| What | How | Cost |
|---|---|---|
| **User's 162 games** | PA-sim (`simulateGame`, roster-extended) — rich scores / box scores, source of marquee broadcasts | ~0.3-0.5s |
| **Other 29 teams' seasons** | **Coarse win-probability sim** (each team → strength rating → expected wins + variance, like existing `simulateSeason` / `projectWins`) — standings only | <10ms |
| **Playoff field & seeding** | Derived from standings (division winners + wild cards) | trivial |
| **User's playoff series** | PA-sim + `SeriesBroadcast` (reuse) — the climax | ~0.2s / series |
| **Other playoff series** | Coarse W/L sim (advance the bracket) | trivial |

This keeps total compute **<1s**, reuses the calibrated coarse model for the league, and reserves rich PA-sim for the games the user watches. The other 29 teams need only a **strength rating**, not a full 25-man.

### Opponent rosters come free

`buildLiveDraftSnapshot` (`functions/_lib/live/live-draft-snapshot.ts:70`) already fetches **all 30 teams' rosters + stats** into one `LivePlayer[]` pool, each player tagged with `teamId` / `teamAbbrev` / `teamName`. Filter the same snapshot by `teamId` to build any franchise's 25-man for playoff opponents. The legends path mirrors this via `DRAFT_BUCKETS` filtered by franchise.

## Two big technical risks (spiked first)

### Risk 1 — PA-sim engine extension (rotation / bullpen / bench)

Current `SimTeam` (`shared/live/pa-sim.ts:12`) = `{ battingOrder[9], lineup: DailyLineup(12) }` with single SP / RP / CL. `simulateHalfInning` (`:105`) picks one pitcher per role via `getPitcher(lineup, 'SP'/'RP'/'CL')` (`:96`). For 25-man depth, the engine needs:

- `SimTeam` gains `rotation: LivePlayer[5]`, `bullpen: LivePlayer[]`, `bench: LivePlayer[]`.
- `simulateGame` takes `gameIndex` → starter = `rotation[gameIndex % 5]` (so #5 strength matters across 162).
- `simulateHalfInning` picks reliever from bullpen pool by leverage tier (not one RP / CL).
- Bench: pinch-hit logic in late innings (PH for pitcher spot / weak hitter), defensive sub.
- **Backward compat**: keep existing `simulateGame` / `buildSimTeam` / `simulateBestOfThree` working for Daily / Live; add roster-aware variants.
- **Spike goal**: prove rotation strength shifts season win totals (a 5-deep staff outperforms a top-heavy one), and bullpen leverage changes close-game outcomes. **W0a spike confirmed**: deep staff 79-21 vs top-heavy 44-56 (+35 wins); leverage bullpen 79-21 vs single-RP 70-30 (+9 wins); bench PH fires in late innings. **Critical spike bug found and fixed**: starter assignment was swapped (offense vs defense) — the W3 production code must assign the starter by which team is the DEFENSE, not the offense.

### Risk 2 — Dual player-pool data path

- **Current-MLB path**: reuse `LivePlayer`, `fetchLiveDraftSnapshot` / MLB API (`functions/_lib/live/mlb-client.ts`), `LiveModeConfig` plumbing. Pool is all active MLB players — sufficient for 25-man.
- **Legends path**: `Player` (Lahman, static `PLAYERS` / `DRAFT_BUCKETS`) → convert to `LivePlayer` via a **Player → LivePlayer adapter** (grade mapping from `PlayerRatings` to `LivePlayerGrades`: contact / power / speed direct, strikeouts → stuff, **whip → command directly** (the whip rating is already higher=better, NOT `100 - whip` — see W0b finding), catcher fielding → defense; soft-clamp 20-80). No backend fetch — build a static snapshot in-memory. `batSide` / `pitchHand` default `'R'` (not in Lahman `Player` type; W4 should source real handedness). Pitcher role slots derived from `ratings.saves` (=== 50 → SP, > 50 → RP, >= 60 → CL) — `gs`/`reliefGames` are unreliable on decade cards.
- Both paths converge on the same Sim 162 engine (which operates on `LivePlayer` / `SimTeam`).
- **Spike goal**: confirm the legends adapter produces well-behaved PA probabilities across eras (e.g., deadball-era contact-heavy hitters vs modern power).

## 25-man roster shape

Proposed slots (position-player + pitcher split, MLB-style):

- **Position (13)**: C ×2, 1B, 2B, 3B, SS, LF, CF, RF, DH, UTIL / Bench ×3 (multi-pos eligibility).
- **Pitching (12)**: SP ×5 (rotation), RP ×6 (bullpen), CL ×1.
- The 9-man batting order is derived from the 13 position players (user sets it, like Live Draft's `BattingOrderEditor`).

A new roster format lives in `shared/live/roster25.ts` (kept with the live family). Draft enforces position quotas.

## Draft UX

Solo draft, 25 picks from the full pool. Needs:

- Position-quota tracking (must fill 2C, 5SP, etc.) in the draft state.
- **Auto-fill-suggest / auto-fill-remaining** to cut tedium on the back half of 25 picks.
- A 25-slot lineup grid (new component, extends `LiveLineupGrid`).
- Per-roster team lock (existing rule) still applies; with 25 picks across 30 teams this is less constraining but keep it.

## Reusable code (do not rewrite)

| Purpose | Location |
|---|---|
| PA play-by-play sim | `shared/live/pa-sim.ts` `simulateGame`, `simulateBestOfThree`, `paProbabilities` |
| Build a sim team | `shared/live/pa-sim.ts:325` `buildSimTeam` |
| Replay frames + headline + performers | `src/lib/series-replay.ts` `buildSeriesReplay`, `headlineMoment`, `topPerformers` |
| Broadcast UI | `src/components/SeriesBroadcast.tsx` + `src/components/broadcast/*` + `playback-reducer.ts` |
| Opponent batting order heuristic | `shared/live/live-draft.ts:647` `heuristicAiBattingOrder` |
| Coarse win-prob pattern | `src/lib/simulation.ts` `simulateSeason`, `projectWins` |
| Live mode config plumbing | `src/hooks/useLiveDraftSession.ts`, `src/lib/*-mode-config.ts` |
| MLB API snapshot fetch | `functions/_lib/live/mlb-client.ts`, `live-draft-snapshot.ts` |
| D1 leaderboard pattern | `migrations/0002_live_modes.sql`, `functions/api/live-leaderboard.ts` |
| Benchmark lineups (test fixtures) | `src/lib/benchmarks.ts` `buildBenchmarkLineup` |
| Live fixtures (PA-sim test style) | `shared/live/live-fixtures.ts` |

## Workstreams

### W0 — Spikes (gate, ~2-3 days)

**W0a — PA-sim roster extension spike.** Extend `SimTeam` with rotation / bullpen / bench, `simulateGameRoster`, prove rotation depth + bullpen leverage affect outcomes. Throwaway validation script.
**W0b — Legends adapter spike.** `Player → LivePlayer` grade mapping; confirm PA probabilities well-behaved across eras; build a static legends snapshot.
**Blocks:** W3, W4 (adapter); W3 (sim extension).

### W1 — Coarse league-standings engine

New `shared/live/league-standings.ts` + tests. 30 teams → strength rating → `simulateCoarseSeason` (win-prob + variance, seeded) → standings. Synthetic 162-game schedule generator (opponent distribution, home / away) — deterministic from seed. Division / wild-card seeding.
**Depends on:** nothing. **Blocks:** W6.

### W2 — 25-man roster format + solo draft state

New `shared/live/roster25.ts` + `sim162-draft.ts` + tests. Roster slots, position quotas, eligibility (`playerEligibleForDailyPosition` pattern in `daily-roster.ts:62`). Solo pick flow (no snake / AI), quota enforcement, auto-fill-suggest helper.
**Depends on:** nothing. **Blocks:** W4, W5.

### W3 — PA-sim engine extension (from W0a)

`shared/live/pa-sim.ts` + tests. `buildRosterSimTeam`, `simulateGameRoster(gameIndex)`, bullpen-by-leverage, bench PH. Keep existing `simulateGame` / `buildSimTeam` intact for Daily / Live. Rotation cycling (game 5 uses SP5); bullpen leverage; PH in late innings; score invariants (reuse `series-replay.test.ts` style); backward-compat for Daily / Live.
**Depends on:** W0a. **Blocks:** W6, W7.

### W4 — Dual pool snapshots (from W0b)

`buildSim162LiveSnapshot` (reuse MLB API fetch, all 30 teams) + `buildLegendsSnapshot` (static, adapter) + tests. Both yield `LivePlayer[]` with team affiliation. Mode-select entry: user picks pool → route param → correct snapshot.
**Depends on:** W0b, W2. **Blocks:** W5.

### W5 — Mode config + session hook + route

`sim162-mode-config.ts` (extends `LiveModeConfig` pattern), `useSim162Session` hook (extends `useLiveDraftSession`), `/sim162` route, ModeSelect card with pool chooser + tests.
**Depends on:** W2, W4. **Blocks:** W7.

### W6 — Season sim: user's 162 + standings + bracket

New `shared/live/sim162-season.ts` + tests. PA-sim user's 162 (roster-aware) → box scores + marquee selection. Coarse-sim other 29 (W1) → standings → playoff field + seeding. Bracket engine: 12-team WC / DS / LCS / WS structure; user's series flagged for PA-sim, others coarse. 162 games produce valid box scores; standings consistent with records; bracket seeding correct; determinism.
**Depends on:** W1, W3. **Blocks:** W7, W8.

### W7 — Result UI: marquee broadcasts + box scores + playoff broadcasts

`Sim162ResultScreen` (season summary + standings finish + playoff qualification) + tests. 1-3 marquee regular-season broadcasts via `SeriesBroadcast` (thin `SeasonBroadcast` wrapper). 162 box-score list (`BoxScoreCard` from `SimBoxScore`). `PlayoffBracket` viz. Each of the user's playoff series broadcast. Tiers: Missed playoffs → WC → DS → LCS → WS Champs. If not qualified: season recap + box scores, "Eliminated — missed the playoffs." Rendering for qualified / eliminated; marquee selection bounds.
**Depends on:** W5, W6. **Blocks:** W8.

### W8 — D1 leaderboard + share + analytics

Migration `0003_sim162.sql`: `sim162_leaderboard_entries` (record, wins / losses, playoff_result, seed, lineup_key, payload_json, initials, submitter_ip, created_at) — mirror `0002_live_modes.sql` pattern + indexes on record / playoff_result. `functions/api/sim162-leaderboard.ts` + `Sim162LeaderboardSubmit` / `Sim162LeaderboardTable` components (extend live-leaderboard pattern). Share: `LiveShareInput`-style payload (playerIds + batting order + rotation order + simSeed) → `/sim162-share` route re-sims deterministically. Analytics: `trackEvent('sim162_season_simulated' / 'playoff_qualified' / 'won_world_series' / ...)`.
**Depends on:** W6, W7.

### W9 — Regression, docs, CONTEXT glossary

`CONTEXT.md`: add "Sim 162", "25-Man Roster", "Rotation", "Playoff Bracket" glossary entries. `HANDOFF.md`: new mode section. Confirm `npm run ci` green; manual QA both pools; verify Daily / Live / Classic unaffected.
**Depends on:** W8.

## Cross-cutting constraints

- **Determinism**: season seed from lineup + rotation order + chosen pool + `simSeed`. All sims seeded (`createSeededRandomFromString`). Share URLs re-sim identically. No `Math.random`.
- **Backward compat**: Daily / Live / Classic must not change. Keep existing `simulateGame` / `buildSimTeam` / `simulateBestOfThree` working; add roster-aware variants.
- **Bundle**: roster-aware pa-sim + bracket + standings add to client bundle (shared/live already bundled). 25-man draft board is heavier UI; lazy-load the result screen if needed.
- **Compute**: stay <1s via hybrid model (W1 / W6). If user's 162 PA-sim is too slow on low-end devices, stream with a progress bar.
- **No comments** unless the existing file uses them. Match `@/` and `@shared/live/` alias conventions. `verbatimModuleSyntax` is on → use `import type`.

## Verification

```bash
npm run lint && npm test && npm run build && npm run ci
npm run dev:pages   # backend for live-pool path
npm run dev         # UI; draft 25-man, sim season, watch marquee + playoffs
```

## Suggested execution order

W0 (parallel spikes, gate) → W1 + W2 (parallel) → W3 + W4 (parallel, after W0) → W5 → W6 → W7 → W8 → W9. Realistically **4-6 engineer-weeks** for a team of 2-3; the spikes (W0a / W0b) are the gate — if the pa-sim extension or legends adapter misbehave, the plan adjusts before heavy build.

## Out of scope (future)

- Simulating other teams' games at PA-sim level (currently coarse for standings only).
- In-season management (trades, lineup changes mid-season).
- Stat accumulators over 162 (player season stats) — only box scores per game.
- Reconciling emergent record with a calibrated curve (Sim 162 is its own emergent-contract mode).
