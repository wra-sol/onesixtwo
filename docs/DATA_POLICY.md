# Data Policy

## Source strategy
- **Primary**: [Lahman Baseball Database](https://sabr.org/lahman-database/) CSV under `data/lahman/` (names align with Baseball Reference via `bbrefID`).
- **Curated seeds**: [`src/data/seed-players.ts`](../src/data/seed-players.ts) for iconic cards with tuned display stats/ratings.
- **Build**: [`scripts/build-player-data.ts`](../scripts/build-player-data.ts) merges seed + Lahman top performers per franchise-decade (20 players per bucket).

Refresh Lahman: `npm run fetch:lahman` (requires Rscript).

## Ranking metric
- **Lahman buckets**: Decade franchise value score from summed batting/pitching (HR, RBI, W, SO, ERA proxy).
- **Seed cards**: `ratings.overall` with era proximity weighting when placed in buckets.

## Franchise model
- One stable `franchiseId` per continuous franchise (e.g. `dodgers` for Brooklyn/LA).
- `teamDisplayName` varies by era in bucket metadata (e.g. Brooklyn Dodgers vs Los Angeles Dodgers).
- Lahman `franchID` mapping: [`scripts/lib/lahman-franchises.ts`](../scripts/lib/lahman-franchises.ts).

## Decade policy
- Decades: `1910s` … `2020s` (season years mapped by `floor(year/10)*10`).
- Stats aggregate all MLB (AL/NL) seasons in that decade for the franchise.

## Position eligibility
- Exact positions only: `C`, `1B`, `2B`, `3B`, `SS`, `LF`, `CF`, `RF`, `P`.
- Derived from Lahman `Appearances` game counts (≥10 games at position).

## Duplicate policy
- Same `personId` (BBRef id) may appear on multiple franchise-decade **cards**.
- Draft prevents selecting any card whose `personId` is already in the lineup.

## Bucket coverage
- Target **20 players** per playable `franchiseId + era` bucket.
- Documented in `src/data/generated/coverage-report.json`.

## Licensing
- **Do not** scrape Baseball Reference or FanGraphs.
- Lahman data is the approved historical source for real player names in v2+.
