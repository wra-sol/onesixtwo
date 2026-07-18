# Perfect Season

**https://onesixtytwo.win**

A browser game where you draft MLB rosters and simulate seasons. Three modes:

- **Classic 162** — Spin franchise decades, draft historical legends, project a 162-game record. Aim for the dream **162-0**.
- **Daily Matchup** — Draft from last night's MLB players and play a simulated best-of-3 series against the highest-scoring real team.
- **Live Draft** — Head-to-head snake draft vs an AI opponent, then play a simulated best-of-3 series.
- **Sim 162** — Draft a 25-man roster (current MLB or all-time legends), simulate a 162-game season with full rotation and bullpen depth, then play through a 12-team MLB playoff bracket. The grail is the **World Series championship**.

Inspired by [82-0](https://www.82-0.com/).

## What you do

Each round, you spin a random **franchise + decade** (1960s–2020s). That combo unlocks a pool of real players from that team and era. You pick one legend and slot them into an open spot on your nine-man lineup. After nine rounds, the game rates your offense and run prevention and projects a **162-game record** — from rebuild years to the dream **Perfect Season**.

## How to play

1. **Spin** — Each round gives you a random MLB team and decade.
2. **Respin (optional)** — Once per game you can respin the **team** (new franchise, same decade) and once you can respin the **year** (new decade, same franchise) before you lock in a pick.
3. **Draft** — Choose one player from that era’s pool and assign them to one open position.
4. **Fill the lineup** — Complete all nine spots: **C**, **1B**, **2B**, **3B**, **SS**, **LF**, **CF**, **RF**, **P**.
5. **See your season** — Ratings roll up into contact, power, speed, and run prevention. Stronger lineups project more wins. Aim for a Perfect Season.

**Rules:** You can’t draft the same person twice in one game. Players must fit an open position (multi-position eligibility applies). If no valid spin remains, you’re stuck—finish with the lineup you have or start over.

## After the draft

You get a projected record (e.g. 118-44), a headline tier (rebuild → playoff push → contender → dynasty → perfect), category breakdowns, best/weakest player highlights, and shareable text to challenge friends.

## Domain & privacy

- **Production:** [onesixtytwo.win](https://onesixtytwo.win)
- **WHOIS privacy & DNS:** [docs/DOMAIN.md](./docs/DOMAIN.md)

## Data

Player pools are built from [Lahman](https://www.seanlahman.com/baseball-archive/statistics/) statistics (with Baseball Reference IDs) plus curated seed stars, grouped into franchise–era buckets. See [HANDOFF.md](./HANDOFF.md) for the build pipeline, dataset policy, and architecture.

## Play locally

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (typically http://localhost:5173).

Classic draft works with Vite alone. **Live Draft** and **Daily Matchup** need the Cloudflare Pages API (D1 + functions). In a second terminal:

```bash
npm run dev:pages   # builds once, applies local D1 migrations, API on :8790
npm run dev         # UI on :5173 with /api proxied to :8790
```

If the API runs on a different port, set `VITE_DEV_API_ORIGIN` (e.g. `http://127.0.0.1:8788`).

The old single-command flow still works for a static preview without hot reload:

```bash
npm run dev:pages   # then open http://localhost:8790
```

## Test & build

```bash
npm run fetch:lahman  # optional: refresh Lahman CSV (requires Rscript)
npm run build:data    # regenerate player/bucket JSON
npm run ci            # lint, validate:data, test, and build (matches GitHub Actions)
```

Or run steps individually:

```bash
npm run validate:data
npm test
npm run build
```

## CI

Pull requests and pushes to `main` run [`.github/workflows/ci.yml`](.github/workflows/ci.yml): **lint**, **test** (data validation + Vitest), and **build** in parallel. Deploy to Cloudflare Pages (`.github/workflows/deploy.yml`) runs only after CI succeeds on `main`.

## Deploy (Cloudflare Pages)

```bash
npm run deploy
```

Attach the custom domain and verify WHOIS redaction: [docs/DOMAIN.md](./docs/DOMAIN.md). Engineering notes: [HANDOFF.md](./HANDOFF.md).
