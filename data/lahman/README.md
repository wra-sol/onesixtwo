# Lahman Baseball Database (CSV)

Player names and career stats are sourced from the **Sean Lahman / SABR Lahman Database** (2025 edition via CRAN `Lahman` 14.0).

- `People.bbrefID` matches [Baseball Reference](https://www.baseball-reference.com/) player IDs.
- Do not scrape BBRef; regenerate these files from Lahman instead.

## Refresh

```bash
npm run fetch:lahman   # needs curl, tar, Rscript
npm run build:data
```

## Attribution

Lahman Baseball Database © Sean Lahman / SABR. Used under their public distribution terms for research and non-commercial use. See https://sabr.org/lahman-database/
