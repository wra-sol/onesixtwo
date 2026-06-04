# Dataset Expansion — Handoff Summary

## What shipped (v2)

- **236 franchise-era buckets**, **25–50 players each** (up to 50 when data allows), **~11700 player cards**
- **Seed + generate pipeline:** `src/data/seed-players.ts` → `scripts/build-player-data.ts` → `src/data/generated/*.json`
- **Validation:** `npm run validate:data` (coverage report in `coverage-report.json`)
- **`personId` duplicate prevention** across franchise-era cards
- **Gameplay:** stuck state, draft history, disabled-player reasons, player filters (search/position/sort/compact)
- **Scoring:** dynamic benchmark lineups + win-range tests
- **Result recap:** best/weakest player, distance from 162-0, shareable text

## Data source decision (v2)

See `docs/DATA_POLICY.md`. v2 uses a **hand-curated seed catalog** expanded by the build script with rating-based ranking and filler cards for sparse buckets. Lahman or licensed exports are the recommended path for v3.

## Unresolved / v3 candidates

| Topic | Recommendation |
|-------|----------------|
| WAR-based ranking | Import Lahman or licensed WAR when licensing is confirmed |
| Filler “Contributor” players | Replace with real historical names from import |
| Bundle size | Main chunk ~2.7 MB; optional `import()` split for `players.json` |
| Cloudflare deploy | Run `wrangler login` + `npm run deploy`; record URL |
| D1 / share links | Optional; not required for playable v2 |

## Suggested order (v3)

1. Deploy v2 to Cloudflare Pages and smoke-test production.
2. Replace filler players with Lahman-derived names/stats.
3. Calibrate scoring again with real WAR-weighted top-20 lists.
4. Add lazy-loaded data chunk if bundle warnings become a problem.
