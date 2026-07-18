# Daily Matchup Draft Screen Overhaul

**Status:** Ready for engineering
**Source:** User request — "Today's challenge draft screen needs a LOT of work"
**Plan file:** docs/plans/daily-matchup-draft-overhaul.md
**Last updated:** 2026-06-26

## Summary

Rework the Daily Matchup draft screen from its current bare-shell form (search box + flat overall-sorted list + 12-slot grid) into a richly customized experience, staying **within** the shared `LiveDraftShell` extension mechanism that Live Draft already uses. Adds an opponent preview, draft-progress/scarcity UI, position filters and sort, drag-and-drop batting order, playable fixture fallback, and localStorage persistence. The shared shell, client, and hook changes are **additive** so Live Draft is unaffected unless it opts in.

## Sources

| Source | Relevance |
|--------|-----------|
| [docs/plans/thermo-loop-daily-games.md](./thermo-loop-daily-games.md) | Predecessor remediation (Done). Deferred polish: F-009 ModeSelect hook, F-010 display subtitle |
| [docs/adr/0001-split-daily-matchup-and-live-draft.md](../adr/0001-split-daily-matchup-and-live-draft.md) | Mode split; separate validation paths |
| `src/routes/daily-matchup.tsx` (15-line shell wrapper) | Current route — uses none of the shell's extension props |
| `src/routes/live-draft.tsx` | Reference for shell customization (extraPlayerPanel/lineupPanel/alternateLink) |
| [CONTEXT.md](../../CONTEXT.md) | Glossary: Daily Matchup, Challenge Date, Target Date, Daily Roster, Per-Roster Team Lock, 20-80 Grades |

## Current state (gap analysis)

The Daily Matchup draft screen is a deliberately thin route over the shared `LiveDraftShell` + `useLiveDraftSession` hook. It is the **least-customized** live mode — it passes no `extraPlayerPanel`, `lineupPanel`, `unavailable`, or `alternateLink`, so it renders the shell's bare default.

| Gap | Evidence |
|-----|----------|
| No opponent preview on draft screen | Opponent surfaced only as subtitle text (`src/routes/daily-matchup.tsx:10-12`) |
| No position filter / sort selector | Shell offers only search `Input` (`LiveDraftShell.tsx:199-204`) + fixed `overall` sort (`useLiveDraftSession.ts:107`) |
| No draft progress / scarcity UI | No slots-left-by-position, no per-roster team-lock tracker, no scarce-slot hint |
| Minimal batting-order editor | Only ↑/↓ buttons (`LiveLineupGrid.tsx:114-163`); no drag-drop, no autosort |
| Fixture-fallback is a client dead-end | `parseSnapshotResponse` throws on `fallback:true` (`live-api-client.ts:31-42`) → error branch, not playable |
| No persistence | In-memory `useState`; refresh = `window.location.reload()` (`LiveDraftShell.tsx:152`) |
| Dead `isStuck` branch for daily | `isStuck` requires `mode==='live-draft'` (`useLiveDraftSession.ts:179`); daily has no `'stuck'` status |
| Silent no-op on invalid assign | `draftDailyMatchupPlayer` returns state unchanged if disabled (`live-draft.ts:274`) |

## Decisions (confirmed with requester)

1. **Stay within the shared shell's extension props** — add new optional render props to `LiveDraftShell`; customize from `daily-matchup.tsx`. Matches Live Draft's pattern. Lower risk than a divergent screen.
2. **Drag-and-drop batting order** via `@dnd-kit` (new runtime dep). Plus ↑/↓ buttons and an Auto-sort button.
3. **Fixture-fallback playable** — shared client + hook change (affects Live Draft too, consistently). Shell already disables leaderboard submit for fallbacks (`LiveDraftShell.tsx:164`).
4. **localStorage persistence** keyed by `mode:challengeDate` in the shared hook (benefits both modes).
5. **Scope:** drafting phase + lineup/batting-order phase + loading/unavailable/error states. Result/leaderboard screen **out of scope**.

## Rubric

| Lens | Pass criteria |
|------|----------------|
| Shell additive | New props optional; Live Draft route unchanged without opt-in; `npm run build` green |
| Fallback playable | `fallback:true` body renders a playable draft with a non-blocking "sample data" banner; leaderboard submit stays disabled |
| Persistence | Refresh mid-draft restores roster + batting order for the same challenge date; cleared on simulate; no-op on date mismatch |
| UX completeness | Opponent preview, position filter, sort selector, draft progress, team-lock tracker, scarce-slot hint, DnD batting order, autosort all present |
| Verification | `npm run lint && npm test && npm run build` green |
| Behavior | Happy-path draft → sim → submit unchanged for non-fallback; server validation unaffected |

## Architecture note — shared shell extension

`LiveDraftShell` already exposes `unavailable`, `extraPlayerPanel`, `lineupPanel`, `alternateLink` render props. This plan adds four more **optional** props, each defaulting to the current render so Live Draft is untouched:

```ts
loading?: (session) => ReactNode          // replaces "Loading {title}…" (LiveDraftShell.tsx:85-91)
error?: (session) => ReactNode            // replaces error + Retry (LiveDraftShell.tsx:72-83)
playerBrowser?: (session) => ReactNode    // replaces search Input + player list (LiveDraftShell.tsx:199-224)
lineupPhase?: (session) => ReactNode      // replaces BattingOrderEditor + Simulate (LiveDraftShell.tsx:226-236)
```

## Itemized work

| ID | Type | Blocked by | Work item | Verification | Status | Maps from |
|----|------|------------|-----------|--------------|--------|-----------|
| DMO-001 | AFK | — | Add `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` to `package.json` dependencies | `npm install` succeeds; `npm run build` bundles without error | Pending | Batting order UX |
| DMO-002 | AFK | — | Add optional `loading`/`error`/`playerBrowser`/`lineupPhase` render props to `LiveDraftShell.tsx:23-31`; branch on presence at `:72-83`, `:85-91`, `:197-224`, `:226-236`. Each defaults to current render. No behavior change when props absent. | `npm run build` green; Live Draft route (`live-draft.tsx`) renders unchanged; existing `SeriesBroadcast.test.ts` passes | Pending | Shell extension |
| DMO-003 | AFK | — | `src/lib/live-api-client.ts:31-42`: stop throwing on `fallback:true` — return the body so the draft renders. Keep throwing on `!response.ok`. Hook reads `data.fallback`/`data.error` for the banner. | `live-api-client.test.ts`: fallback body resolves (not throws); `!response.ok` throws `LiveSnapshotError` | Pending | Fallback playable |
| DMO-004 | AFK | — | New `shared/live/daily-draft-insights.ts` + `.test.ts`: pure functions `openPositionCounts(lineup)`, `eligiblePlayersForPosition(players, pos)`, `teamsRemaining(players, draftedTeamIds, opponentTeamId)`, `scarceSlotHint(lineup, players)`. Reuse `playerEligibleForDailyPosition` from `daily-roster.ts:62`. | `daily-draft-insights.test.ts` passes; functions are pure (no React/D1) | Pending | Draft progress / scarcity |
| DMO-005 | AFK | DMO-003 | `src/hooks/useLiveDraftSession.ts`: (a) set `isFallback` + expose `fallbackWarning` from `data.fallback`/`data.error` after successful load (`:73-75`); (b) persist `draftState`+`selectedPlayerId` to `localStorage["onesixtwo:${mode}:${challengeDate}"]`, restore after `initDraft` when snapshot `challengeDate` matches, clear on `handleSimulate`/`series` set (`:139-142`), no-op on mismatch. | `useLiveDraftSession.test.tsx`: fallback playable (no error), persistence round-trip, cleared on simulate | Pending | Fallback playable, Persistence |
| DMO-006 | AFK | DMO-002, DMO-004, DMO-005 | New `src/components/daily-matchup/` components (see Component spec below); all accept explicit props (testable in isolation). `DailyLineupPhase` uses `@dnd-kit` (DMO-001). | Component tests pass; each renders from fixture `DailyMatchupSnapshot` (`shared/live/live-fixtures.ts:95`) | Pending | All UX gaps |
| DMO-007 | AFK | DMO-006 | Wire `src/routes/daily-matchup.tsx`: add route-local state `positionFilter`, `sortBy`, `hideUnavailable`; `useMemo` `displayPlayers` from `snapshot.players` + hook `search` + filters/sort; pass `loading`/`error`/`unavailable`/`extraPlayerPanel`/`playerBrowser`/`lineupPanel`/`lineupPhase`/`alternateLink` to shell. | `npm run build` green; manual `npm run dev:pages` shows full customized flow | Pending | Route customization |
| DMO-008 | AFK | DMO-003, DMO-005, DMO-006 | Tests: `live-api-client.test.ts` (DMO-003), `useLiveDraftSession.test.tsx` (DMO-005), `daily-matchup/*.test.tsx` (browser filter/sort, progress counts, lineup-phase autosort + simulate fires, opponent preview renders). Use jsdom + @testing-library/react (already in devDeps). | `npm test` green; covers the new branches | Pending | Verification |
| DMO-009 | AFK | DMO-001..008 | Plan-level verification + manual smoke. | `npm run lint && npm test && npm run build` green; manual draft→sim→submit on `dev:pages` | Pending | Verification |

## Component spec (DMO-006)

New files under `src/components/daily-matchup/`. All consume explicit props (snapshot/draftState/handlers), not the whole session, for isolation and testability. Match house styling: `Card`/`CardContent`/`CardHeader` from `@/components/ui/card`, `Button` from `@/components/ui/button`, `cn` from `@/lib/utils`, Tailwind v4 classes, `font-display` for headings.

| Component | Role | Shell prop | Key contents |
|---|---|---|---|
| `DailyLoadingState` | Loading skeleton | `loading` | Opponent card placeholder + 12-slot grid placeholders; "Loading Daily Matchup…" sr-only text |
| `DailyErrorState` | Error + Retry; "Play sample roster" CTA when `isFallback` | `error` | Destructive message, Retry button, fallback CTA routes to same route (now playable) |
| `DailyUnavailableState` | Unavailable reason + challenge-date context + "Play Live Draft" link | `unavailable` | Replaces default `LiveDraftShell.tsx:110-125`; adds Target Date context |
| `DailyOpponentPreview` | Opponent team, score (runs/hits/runDiff), lineup w/ 20-80 grades (collapsible) | inside `lineupPanel` | Uses `snapshot.opponent` (`OpponentRoster`, `live-types.ts:63-69`) + `opponentGameScore`; grade labels from `shared/live/live-grades.ts` |
| `DailyDraftProgress` | X/12, open-position chips, team-lock tracker, scarce-slot hint, fallback banner | `extraPlayerPanel` | Uses `daily-draft-insights.ts` (DMO-004); fallback banner shows `fallbackWarning` |
| `DailyPlayerBrowser` | Position filter chips + sort selector + hide-unavailable + list | `playerBrowser` | Reuses `LivePlayerCard compact`; filters via route-local state from DMO-007 |
| `DailyLineupGrid` | Richer slots: name + team + overall grade, eligibility highlight, group fill counts | inside `lineupPanel` | Extends `LiveLineupGrid.tsx` slot rendering with `continuousToDisplayGrade` + `GRADE_LABELS` |
| `DailyLineupPhase` | `@dnd-kit` sortable batting order + ↑/↓ + "Auto-sort" + Simulate + roster-vs-opponent summary | `lineupPhase` | `DndContext` + `SortableContext` for 9 hitters; autosort by `grades.overall` desc; Simulate calls `handleSimulate` |

## Verification (plan-level)

```bash
npm run lint && npm test && npm run build
```

Manual:
- `npm run dev:pages` (local D1 + API on :8790) → Daily Matchup: opponent preview, filter/sort, assign 12 slots, DnD batting order, autosort, simulate best-of-3, submit leaderboard.
- Offline sample game: set `USE_LIVE_FIXTURES=true` in `.dev.vars` → fallback renders playable draft with "sample data" banner; leaderboard submit disabled.
- Persistence: mid-draft refresh restores roster + batting order; after simulate, refresh does not restore.
- Live Draft regression: `/live-draft` renders unchanged (no new props passed).

## Deliverable

All DMO-001 … DMO-009 done; `npm run lint && npm test && npm run build` green; Daily Matchup draft screen fully customized within the shared shell; Live Draft unaffected.

## Out of scope (separate follow-ups)

- Result / leaderboard submit screen rework
- `ModeSelect` double-fetch (predecessor F-009)
- `daily-matchup-snapshot.ts` size split (predecessor F-005, 352 lines)
- Opponent lineup realism (`buildOpponentRosterFromBox` heuristic) — sim realism only, not the user's roster

## Risk notes

- Shell changes (DMO-002) are additive optional props with current-render defaults → Live Draft unchanged unless it opts in.
- Fallback-playable (DMO-003) + persistence (DMO-005) are shared hook/client changes → affect Live Draft too (desirable, consistent). Live Draft's `live-draft.tsx` does not pass the new shell props, so its loading/error/browser/lineup-phase branches render defaults.
- `@dnd-kit` is the only new runtime dep (DMO-001); SPA, no SSR concern.
- Server-side validation (`live-submit-validation.ts`) is authoritative and unchanged — fallback snapshots already disable submit client-side.
