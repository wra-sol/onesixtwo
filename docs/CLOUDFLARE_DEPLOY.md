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

Push to `main`; workflow `.github/workflows/deploy.yml` builds and deploys automatically.

### Option B — Local Wrangler

```bash
npx wrangler login          # re-auth if whoami fails
# Add to wrangler.toml: account_id = "your-account-id"
npm run deploy
```

This runs `npm run build` then `wrangler pages deploy dist`.

## Post-deploy verification

1. Open the production URL (record it in `HANDOFF.md` once known).
2. Confirm client-side routes work (refresh on `/` and deep links if added later).
3. Confirm `_headers` apply (check response headers in browser devtools).
4. Smoke-test: start draft, spin, filter players, finish 9 rounds, view result recap and copy share text.

## Production URL

| Environment | URL |
|-------------|-----|
| Production  | _Pending first successful deploy_ |

## Notes

- Dataset JSON is bundled into the main JS chunk (~2.7 MB minified, ~199 KB gzip). Acceptable for static Pages; consider lazy-loading or splitting if bundle grows further.
- No Workers/D1 required for v2; static hosting only.
