# 162-0

Build the ultimate MLB all-time lineup and see if you can go **162-0**.

Inspired by [82-0](https://www.82-0.com/).

## Play locally

```bash
npm install
npm run dev
```

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

See [HANDOFF.md](./HANDOFF.md) for architecture and handoff notes.
