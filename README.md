# Perfect Season

**https://onesixtytwo.win**

A browser game where you draft an all-time MLB starting lineup and see if your squad can earn a **Perfect Season**: a projected **162-0** record.

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

## Test & build

```bash
npm run fetch:lahman  # optional: refresh Lahman CSV (requires Rscript)
npm run build:data    # regenerate player/bucket JSON
npm run validate:data
npm test
npm run build
```

## Deploy (Cloudflare Pages)

```bash
npm run deploy
```

Attach the custom domain and verify WHOIS redaction: [docs/DOMAIN.md](./docs/DOMAIN.md). Engineering notes: [HANDOFF.md](./HANDOFF.md).
