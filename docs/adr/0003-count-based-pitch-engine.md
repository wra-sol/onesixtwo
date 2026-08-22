# ADR 0003: Count-Based Pitch Engine And All-PA Seasons

## Status

Accepted

## Context

The plate-appearance engine resolved each PA with a single draw from a marginal outcome table (strikeout, walk, singles...). There were no pitches, no counts, no fatigue: a starter was fresh in game 40 and his 100th pitch of an outing, and bullpen arms never tired. Standings for the 29 non-user teams came from a coarse win-probability model, so their staffs had no physical reality at all.

Three product goals drove the change: better pitching depth, better pitch sequencing, and batter-vs-pitch-type matchups. The first two are impossible without counting pitches; the third requires pitch families to exist at all.

## Decision

1. **Count-based plate appearances.** Every PA is resolved pitch-by-pitch inside the shared half-inning core: the pitcher selects a family (fastball / breaking / offspeed) with count-contextual tendencies, then location, swing/take, and contact are rolled. Walks and strikeouts emerge from counts. One pitch engine serves every live/season mode (Daily Matchup, Live Draft, Sim 162). The classic spin-draft board's *verification re-sim* still runs its legacy statistical model (`src/lib/simulation.ts`) — unifying it is tracked as follow-up work; the shared half-inning seam is where it lands.

2. **Hybrid arsenal data.** Real pitch mixes ride the snapshot for live pitchers where MLB tracks them; per-pitch quality always derives from grades. Everything else — all legends, all batter profiles (contact/power modifiers per family, chase tendency) — is synthesized deterministically from grades and handedness via `getArsenal()`. Same player id → same profile, so seeds stay replayable.

3. **Staff state across games.** Each team carries rest counters and last-outing pitch totals. Stuff/command decay past a stamina-driven soft cap within an outing; relievers on short rest after heavy work take the mound diminished. States persist through the playoff bracket.

4. **All-PA seasons as a prerequisite.** Rest is fiction if you don't simulate the games in between. The season now simulates all 2,430 scheduled games plus every playoff series; standings come from real results. Full league simulation costs ~350 ms (memoized profiles, allocation-free selection), acceptable behind the existing simulate spinner and in server-side verification.

5. **Calibration policy.** The count model is tuned to reproduce the legacy marginals — K ≈ 24%, BB ≈ 9%, ~4.8 runs/team/game, ~3.4 pitches/PA — pinned by a league-harness test (`count-engine.test.ts`). Any future engine change that moves these bands is a conscious recalibration, never a side effect.

## Consequences

Rotation construction, bullpen building, and stamina grades now materially shape seasons; broadcasts can eventually narrate real sequences. The coarse league model remains in `league-standings.ts` but is unused by Sim 162. Season build time (~350 ms) scales linearly; web-worker offloading is available if the spinner ever needs to disappear.
