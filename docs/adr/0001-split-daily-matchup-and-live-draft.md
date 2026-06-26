# ADR 0001: Split Daily Matchup And Live Draft

## Status

Accepted

## Context

The planned daily feature started as one mode: draft from last night and play against the highest-scoring team from last night. Off days introduced a fallback idea: run a live draft against an AI opponent when there are no completed MLB games.

That fallback changed the design shape. A fixed real opponent and a head-to-head AI draft have different draft pools, fairness rules, leaderboard comparisons, and user expectations.

## Decision

Create two distinct modes:

- Daily Matchup: draft from players tied to the Challenge Date and play a simulated best-of-3 series against the highest-scoring real MLB team from that date.
- Live Draft: run a head-to-head snake draft against an AI opponent from active MLB players, then play a simulated best-of-3 series.

Each mode gets its own leaderboard. Live Draft is always available and becomes the featured/default mode on MLB off days.

## Consequences

The product language is clearer because each mode has one core promise. Daily Matchup stays grounded in last night's real baseball, while Live Draft can optimize for direct draft interaction.

The implementation needs separate challenge kinds, leaderboard filters, and validation paths. This is more work than a single fallback mode, but avoids mixing incompatible scoring and draft rules in one leaderboard.
