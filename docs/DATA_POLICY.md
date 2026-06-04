# Data Policy

## Source strategy
- **Primary**: [Lahman Baseball Database](https://sabr.org/lahman-database/) CSV under `data/lahman/` (names align with Baseball Reference via `bbrefID`).
- **Curated seeds**: [`src/data/seed-players.ts`](../src/data/seed-players.ts) for iconic cards with tuned display stats/ratings.
- **Build**: [`scripts/build-player-data.ts`](../scripts/build-player-data.ts) merges seed + Lahman top performers per franchise-decade (**25–50 players per bucket**, up to 50 when data allows).

Refresh Lahman: `npm run fetch:lahman` (requires Rscript).

## Ranking metric
- **Lahman buckets**: Decade franchise value score from summed batting/pitching (HR, RBI, W, SO, ERA proxy).
- **Seed cards**: `ratings.overall` with era proximity weighting when placed in buckets.

## Franchise model
- One stable `franchiseId` per continuous franchise (e.g. `dodgers` for Brooklyn/LA).
- `teamDisplayName` varies by era in bucket metadata (e.g. Brooklyn Dodgers vs Los Angeles Dodgers).
- Lahman `franchID` mapping: [`scripts/lib/lahman-franchises.ts`](../scripts/lib/lahman-franchises.ts).

## Decade policy
- **Playable** decades: `1930s`–`2020s` (`PLAYABLE_ERAS` / `MODERN_ERAS` in `franchises.ts`).
- Lahman import still maps all years; the build script only emits playable franchise-decade buckets.
- Pre-1960 cards use the same percentile anchors; early-era buckets may have sparser relief/two-way coverage.
- Stats aggregate all MLB (AL/NL) seasons in that decade for the franchise.

## Position eligibility
- Field positions: `C`, `1B`, `2B`, `3B`, `SS`, `LF`, `CF`, `RF`, `P`.
- Optional roster slots: `DH` (all batting-qualified cards), `RP` (relief-qualified pitchers).
- Derived from Lahman `Appearances` (≥10 games at position) plus role rules in [`scripts/lib/lahman.ts`](../scripts/lib/lahman.ts).

## Two-way players
- One card per person per franchise-decade when `AB ≥ 80` and `IP ≥ 40` in that bucket **and** both batting and pitching overall ratings are ≥ 60 (purpose-made two-way only).
- NL pitchers who merely accumulated plate appearances while pitching are classified as `pitcher` and do not drag team offense.
- Carries `battingStats`, `pitchingStats`, and combined ratings; contributes to offense and pitching from a single roster slot.
- Example: Shohei Ohtani (`ohtansh01`) on Angels decade cards.

## Rating calibration
- Category ratings use percentile anchors from Lahman eligible cards (`1930s`–`2020s`).
- Hitter overall weights OPS/power/contact/run production; **speed is not a penalty** in team scoring.
- Tier meaning: `50` playable floor, `70` average starter, `80` good, `90` elite, `100` historically exceptional.
- Pitcher run prevention uses calibrated ERA; team run prevention subtracts a lineup fielding-error penalty from `Fielding.csv`.
- Analyze distributions: `npm run analyze:ratings` (requires Lahman CSV).

## Duplicate policy
- Each franchise-decade bucket lists at most one card per `personId` (BBRef id).
- The same `personId` may still appear on cards in different franchise-decade buckets.
- Draft prevents selecting any card whose `personId` is already in the lineup.

## Bucket coverage
- Target **25–50 players** per playable `franchiseId + era` bucket (top 50 by value score when enough qualifiers exist; sparse eras may be smaller).
- Documented in `src/data/generated/coverage-report.json`.

## Licensing
- **Do not** scrape Baseball Reference or FanGraphs.
- Lahman data is the approved historical source for real player names in v2+.
- Lahman Baseball Database © Sean Lahman / SABR. Used under their public distribution terms for research and non-commercial use. See https://sabr.org/lahman-database/
