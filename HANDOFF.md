# Perfect Season — Engineering Handoff

**Site:** https://onesixtytwo.win · **Brand module:** `src/lib/brand.ts`

## What was built

A browser-based MLB all-time draft game (goal: **162-0**) inspired by [82-0](https://www.82-0.com/). Players spin random franchise/era combinations, draft legends into a **9-man starting lineup** (`C`, `1B`, `2B`, `3B`, `SS`, `LF`, `CF`, `RF`, `P`), and receive a projected **162-game record** with recap and shareable text.

## Stack

- **Vite + React + TypeScript**
- **React Router v7** for client routing
- **Vitest** for unit tests
- **Cloudflare Pages** for static hosting (`dist`)
- **tsx** for dataset build/validate scripts

## Commands

```bash
npm install
npm run dev           # local dev (http://localhost:5173)
npm test              # unit tests (13)
npm run build:data    # regenerate src/data/generated/*.json
npm run validate:data # coverage + schema checks
npm run build         # prebuild:data + tsc + vite → dist/
npm run deploy        # build + wrangler pages deploy
```

## Dataset (v2)

| Metric | Value |
|--------|-------|
| Franchise-era buckets | 236 |
| Players per bucket | 25–50 (top 50 when Lahman has enough; min 25 target) |
| Total player cards | ~11700 |
| Name source | Lahman DB (`bbrefID` = Baseball Reference) + seed stars |
| Franchises | 30 (`src/data/franchises.ts`) |
| Eras | 1930s–2020s per franchise |

Pipeline:

```
data/lahman/*.csv (Lahman / BBRef ids)
seed-players.ts → scripts/build-player-data.ts → generated/players.json + buckets.json
                                              → data/index.ts → game + UI
```

Refresh Lahman CSV: `npm run fetch:lahman`

Duplicate rule: same `personId` cannot be drafted twice in one game.

Policy docs: `docs/DATA_POLICY.md`, `docs/QA_NOTES.md`, `docs/NEXT_ITERATION_HANDOFF.md`.

## Verification (local)

- `npm run validate:data` — passes (sparse buckets may be under 25 players)
- `npm test` — 13 tests passing
- `npm run build` — succeeds (~8.3 MB JS, ~1.1 MB gzip with full player dataset)

## Gameplay (v2)

- **Stuck state** when no valid spin buckets remain (`StuckDraft` component)
- **Draft history** (spin, pick, position per round)
- **Disabled player reasons** on cards
- **Player list filters:** search, position, sort, compact list mode
- **Result recap:** best/weakest player, games from 162-0, copy share text

## Deployment

See `docs/CLOUDFLARE_DEPLOY.md`.

```bash
npx wrangler login   # once per machine
npm run deploy
```

Config: `wrangler.toml`, `public/_redirects`, `public/_headers`.

**Production URL:** https://onesixtytwo.win (attach custom domain in Cloudflare Pages; see `docs/DOMAIN.md`)

**Legal:** `/privacy`, `/terms`, `/data` · **Analytics:** set `VITE_CF_BEACON_TOKEN` at build (see `docs/CLOUDFLARE_DEPLOY.md`)

## Known limitations

- Rankings use decade stat totals, not full WAR (WAR import is a future improvement)
- No persistence, leaderboards, or backend share URLs
- `162-0` remains rare (team score ≥ 98)
- Large static JSON bundle (acceptable for Pages; split optional later)

## Future candidates

- Lahman / licensed stat import for top-20 by WAR
- Lazy-loaded or split player JSON
- Cloudflare D1 leaderboards, KV daily seeds, Pages Functions for share links
