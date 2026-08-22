# ADR 0002: Server-Side Leaderboard Verification For Every Board

## Status

Accepted

## Context

The three leaderboards historically had inconsistent integrity models:

- Classic: re-simulated the season server-side before storing.
- Live Draft / Daily Matchup: re-ran the best-of-3 series server-side from ids + seed.
- Sim 162: stored client-claimed wins, losses, and postseason results after range checks only. A fabricated 162-0 World Series row could be posted directly.

Sim 162 was the outlier because verifying it seemed to require duplicating roster-assembly rules on the server. That obstacle is gone: `buildRoster25SimTeam`, the seed kit, and `buildSim162Season` all live in `shared/live/` and are proven deterministic on (roster ids, orders, seed) by tests and QA scripts.

While making this change we also found that migrations 0002 (`live modes`) and 0003 (`sim162`) had never been applied to remote D1 — the live and Sim 162 leaderboards were returning 500s in production while the classic board worked. The tables were created and the incident resolved during this decision; there were no live or sim162 rows to migrate or preserve.

## Decision

Every leaderboard verifies submissions server-side before storing. For Sim 162, the POST handler rebuilds the season with `buildSim162Season` from the submitted ids plus a seed derived from the server's own pool snapshot, and stores only server-derived values. Client-claimed results are accepted for display continuity but never trusted or validated; they are not part of the submission contract.

When a client's claimed numbers differ from the replay, the server values win. No mismatch rejection path exists: for an honest client the two always agree, because the simulation is deterministic.

## Consequences

One integrity model across all three boards. Fabricated records require forging inputs that actually produce them under the deterministic simulator, not just editing a JSON body.

A Sim 162 submission costs one full season replay (~100 ms) on an endpoint rate-limited to one submission per IP ever. The legends pool ships in the function bundle via the same import path the classic share resolver already uses.

Deployments must apply D1 migrations remotely (`npm run db:migrate:remote`) or new-board endpoints will 500 exactly as this incident showed. CI does not currently enforce that; treat it as part of release checklist until automated.
