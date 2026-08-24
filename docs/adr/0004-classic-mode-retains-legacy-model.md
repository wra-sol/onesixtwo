# ADR 0004: Classic Mode Retains Its Legacy Statistical Model For Now

## Status

Accepted

## Context

ADR-0003 routed every live mode (Daily Matchup, Live Draft, Sim 162) through
the shared half-inning seam and said the classic spin-draft board's
verification re-sim (`src/lib/simulation.ts`, a marginal win-probability
model) is "tracked as follow-up work — the shared half-inning seam is where
it lands."

An architecture review (Aug 2026) surfaced the friction this causes:

- `game.ts ↔ simulation.ts` circular import (fixed since — see below).
- The classic win-probability curve existed in three drifting copies.
- ~130 lines of dead coarse-season model in `league-standings.ts`, kept alive
  only by its own tests, duplicating legacy curves.

The review proposed landing classic verification on the half-inning seam.
Investigation showed that swap is not a server-side refactor: **classic mode's
client gameplay also runs the legacy model.** `calculateSeasonResult` powers
the play flow, result screens, share text, and share-page replays. Swapping
only the server verifier would make stored leaderboard rows disagree with
freshly re-rendered share pages; swapping both means rewriting classic mode's
core UX and recalibrating its pinned marginals (`src/lib/calibration.ts`,
perfect-season gates). Historical share links would re-render with different
records after either variant of the swap.

## Decision

Keep the legacy statistical model for classic mode end-to-end, and treat its
replacement as a product migration, not an internal cleanup:

1. Consolidate instead of swap: one `projectWins` curve owner
   (`src/lib/win-curve.ts`), circular import removed, duplicated curves and
   the dead coarse model deleted.
2. Any future model unification must ship as a deliberate classic-mode
   migration with an accepted break for pre-existing share links.

## Consequences

The win-probability curve has exactly one implementation; `game.ts` no longer
imports `simulation.ts`'s exporter while being imported by it; ~200 lines of
dead or duplicated model code are gone. Future architecture reviews should
not re-suggest "just route classic verify through pa-sim" without scoping it
as the product migration described above.
