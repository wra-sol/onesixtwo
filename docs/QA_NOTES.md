# QA Notes (v1 playtest)

## Validated
- Full 9-round draft completes without refresh.
- Position assignment and duplicate player prevention work for card `id`.
- Spin → pick → assign loop is understandable.

## Blockers addressed in v2
- **No valid bucket**: UI could stall in `spinning` when `getSpinEligibleBuckets()` is empty; added `stuck` status with restart.
- **Disabled players**: No explanation when a player cannot fill open positions; added reason text on cards.
- **Thin buckets**: Few choices per spin; addressed via generated top-20 franchise-decade buckets.

## Non-blockers (deferred)
- Spin animation is timer-only (400ms); polish later.
- Baseball diamond layout deferred; grid retained for mobile.
