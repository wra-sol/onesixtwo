# Cloudflare Pages Deployment

## Prerequisites

1. Cloudflare account with Pages enabled.
2. Wrangler CLI authenticated (required — deploy will fail without this):

```bash
npx wrangler login
npx wrangler whoami   # should show your account email
```

Alternatively set `CLOUDFLARE_ACCOUNT_ID` in `wrangler.toml` or the environment.

> **Note:** `npm run build` does not need Lahman CSV if `src/data/generated/` is already committed. To rebuild names from source stats, run `npm run fetch:lahman` first (requires Rscript).

## Project setup

- **Project name:** `onesixtwo` (see `wrangler.toml`)
- **Build output:** `dist/` (produced by `npm run build`)
- **Build command:** `npm run build` (runs `prebuild` → `build:data` first)
- **SPA routing:** `public/_redirects` → `/* /index.html 200`
- **Headers:** `public/_headers` (cache + security)

## Deploy

### Option A — GitHub Actions (recommended)

Add repository secrets:

| Secret | Where to find it |
|--------|------------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens → Create Token with **Cloudflare Pages — Edit** |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → any zone → Overview → Account ID (right column) |

Push to `main`; workflow `.github/workflows/deploy.yml` builds and deploys production automatically.

### Branch previews

Pushes to any branch **except `main`** run `.github/workflows/deploy-preview.yml`, which deploys a Cloudflare Pages preview at a branch-specific URL (via `wrangler pages deploy --branch <name>`).

**Required once in Cloudflare dashboard** (Pages → **onesixtwo** → Settings → Functions):

1. **D1 bindings** — attach database **onesixtwo-leaderboard** with binding name **DB** for **both Production and Preview** environments. Without Preview binding, `/api/live-leaderboard` returns 500; live snapshot APIs still work but skip D1 cache.
2. **Environment variables** — do **not** set `USE_LIVE_FIXTURES=true` on Production or Preview. Leave it unset (or `false`) so branch previews serve real MLB player names.

After changing `USE_LIVE_FIXTURES` or deploying snapshot logic updates, stale D1 cache entries are invalidated automatically via the snapshot cache version in `functions/_lib/live-api.ts`. To force a full refresh manually:

```bash
npx wrangler d1 execute onesixtwo-leaderboard --remote --command "DELETE FROM live_snapshots;"
```

Preview smoke test:

```bash
curl -s "https://<branch>.onesixtwo.pages.dev/api/daily-matchup" | head -c 200
# Expect kind daily-matchup, opponent.teamName, real player names (not "LAD Hitter 1")
```

### Option B — Local Wrangler

```bash
npx wrangler login          # re-auth if whoami fails
# Add to wrangler.toml: account_id = "your-account-id"
npm run deploy
```

This runs `npm run build` then `wrangler pages deploy dist`.

## Leaderboard database (D1)

One-time setup (requires `wrangler login`):

```bash
npx wrangler d1 create onesixtwo-leaderboard
# Copy the database_id from output into wrangler.toml [[d1_databases]]
npx wrangler d1 migrations apply onesixtwo-leaderboard --local
npx wrangler d1 migrations apply onesixtwo-leaderboard --remote
```

Attach the **DB** D1 binding to the Pages project **onesixtwo** in the Cloudflare dashboard (Settings → Functions → D1 database bindings) if production `/api/leaderboard` returns 500.

API routes: `GET /api/leaderboard?period=daily|weekly|all`, `POST /api/leaderboard` with `{ initials, p, f?, n? }`.

## Local Pages runtime

Use the Vite dev server for fast UI work, but use Pages dev when you need the SPA, Pages Functions (`/share`, `/og`), and leaderboard API in one local runtime:

```bash
npm run dev:pages
```

Apply local D1 migrations before first leaderboard test:

```bash
npm run db:migrate:local
```

`npm run dev:pages` uses the **DB** binding from `wrangler.toml` (same as production). Copy `.dev.vars.example` to `.dev.vars` for local secrets.

## Post-deploy verification

1. Open the production URL (record it in `HANDOFF.md` once known).
2. Confirm client-side routes work (refresh on `/` and deep links if added later).
3. Confirm `_headers` apply (check response headers in browser devtools).
4. Smoke-test: start draft, spin, filter players, finish 9 rounds, view result recap and copy share text.
5. Open a copied `/share?p=...` URL and confirm it renders a read-only result recap.
6. Fetch `/share?p=...` with a crawler user agent and confirm dynamic `og:title` and `og:image` meta tags.
7. Fetch `/og?p=...&v=2` and confirm it returns a 1200×630 PNG social card with the record and tagline.

## Custom domain

Production hostname: **onesixtytwo.win** (see [DOMAIN.md](./DOMAIN.md) for WHOIS privacy and DNS).

1. Pages → project **onesixtwo** → **Custom domains** → add `onesixtytwo.win` (and optional `www`).
2. Ensure the zone’s DNS CNAME points at the Pages target Cloudflare shows (often `onesixtwo.pages.dev`).
3. Wait for SSL active, then verify `https://onesixtytwo.win`.

## Production URL

| Environment | URL |
|-------------|-----|
| Production  | https://onesixtytwo.win |
| Pages default | `https://onesixtwo.pages.dev` (fallback until custom domain is attached) |

## Cloudflare Web Analytics (optional)

1. Dashboard → **Analytics & Logs** → **Web Analytics** → add site `onesixtytwo.win`.
2. Copy the beacon token.
3. Set `VITE_CF_BEACON_TOKEN` in GitHub Actions (Deploy workflow env) or locally when running `npm run build`. The Vite plugin injects the beacon script into `index.html` at build time.
4. Privacy Policy at `/privacy` describes analytics before enabling in production.

## Notes

- Dataset JSON is bundled into the main JS chunk (~2.7 MB minified, ~199 KB gzip). Acceptable for static Pages; consider lazy-loading or splitting if bundle grows further.
- Cloudflare Pages Functions power `/share` and `/og` for dynamic social cards. Vite dev does not run these functions; use `npm run build` followed by `npx wrangler pages dev dist --compatibility-date=2024-01-01` for local end-to-end testing.
- D1 stores optional leaderboard submissions (initials + validated score); share links remain encoded in query params.
- Legal pages: `/privacy`, `/terms`, `/data` (SPA routes; refresh works via `_redirects`).
