# Context Glossary

## Daily Matchup

A daily game mode where the user drafts a roster from players tied to the most recent completed MLB schedule date, then plays a simulated best-of-3 series against the highest-scoring real MLB team from that date.

## Live Draft

A game mode where the user and an AI opponent run a head-to-head snake draft from active MLB players, then play a simulated best-of-3 series.

## Challenge Date

The calendar date shown for a Daily Matchup or Live Draft leaderboard and challenge experience.

## Target Date

The MLB schedule date used to find completed games for Daily Matchup. It is yesterday's MLB schedule date in the America/New_York timezone.

## 20-80 Grades

Season-to-date player strength grades derived from current MLB performance. 20-80 Grades drive plate-appearance outcome probabilities and are shown to users with short labels.

The grade labels are 20 Poor, 30 Well Below Avg, 40 Below Avg, 50 Average, 60 Plus, 70 Plus-Plus, and 80 Elite.

Hitters show role-specific skill grades such as Contact, Power, Speed, Defense, and Overall. Pitchers show role-specific skill grades such as Stuff, Command, Stamina or Role, and Overall.

## Defense Band

A season-to-date player strength grade for defensive value. Defense Bands affect simulated hit prevention, runner advancement, rare errors, and catcher-specific effects when the player is rostered at catcher.

## Per-Roster Team Lock

A draft rule where each roster may include at most one player from a given MLB team. The user and AI may each draft one player from the same MLB team in Live Draft.

## Global Player Exclusivity

A Live Draft rule where the exact same player cannot appear on both the user roster and AI roster.

## Daily Roster

The roster shape used by Daily Matchup and Live Draft: C, 1B, 2B, 3B, SS, OF, OF, OF, DH, SP, RP, and CL.

## Sim 162

A game mode where the user drafts a 25-man roster (current MLB players or all-time legends), simulates a full 162-game season pitch-by-pitch for all thirty teams (~2,430 games), then plays through a 12-team MLB playoff bracket if they qualify. The grail is the World Series championship.

## 25-Man Roster

The roster shape used by Sim 162: C, C, 1B, 2B, 3B, SS, LF, CF, RF, DH, BENCH, BENCH, BENCH, SP, SP, SP, SP, SP, RP, RP, RP, RP, RP, RP, CL. Thirteen position players and twelve pitchers.

## Rotation

The five starting pitchers (SP1 through SP5) on a Sim 162 roster. The starter for each game is determined by game index modulo five, so rotation depth materially affects season outcomes.

## Playoff Bracket

The 12-team MLB postseason format used by Sim 162: six teams per league (three division winners and three wild cards). Wild Card round, Division Series (best-of-5), League Championship Series (best-of-7), and World Series (best-of-7). Every series — user or not — is simulated pitch-by-pitch with full box scores.

## Series Tie Policy

What happens when a simulated game ends tied. Daily Matchup and Live Draft let the tie stand, so a best-of-3 can end without a series winner. Sim 162 coin-flips tied games with the season seed, so a playoff series always advances someone.

## Season Seed

The seed string that makes a simulation reproducible: same roster, orders, and seed produce an identical season. Share links and stored leaderboard rows re-sim from it, so its format must never drift.

## Pitch Family

One of three pitch classes used by the simulation: fastball, breaking, or offspeed. Pitchers carry an Arsenal of families with usage shares; batters carry contact/power modifiers against each family plus a chase tendency.

## Arsenal

A pitcher's pitch mix. Real mixes ride the snapshot for live pitchers where MLB tracks them; every other case (legends, missing data) synthesizes deterministically from grades and handedness. Per-pitch quality always derives from the pitcher's grade profile.

## Staff State

Per-team pitching data that persists across games: rest counters and last-outing pitch totals per arm. Stuff and command decay within an outing past a stamina-driven soft cap, and relievers on short rest after heavy work are diminished. States persist through the playoff bracket.

Every roster-convention game states its fatigue regime explicitly: Sim 162 passes live, season-persisted Staff State; best-of-3 modes pass an explicit everyone-fresh regime because a short series has no off-days to model.

## Fatigue Regime

The choice, made at each game-simulation call site, between persistent Staff State (Sim 162 seasons and playoff brackets) and an explicit fresh regime (best-of-3 modes). There is no silent default: omitting fatigue is always a visible decision.
