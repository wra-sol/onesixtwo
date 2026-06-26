/** Stable analytics event names — stub wrappers for future instrumentation. */

export type AnalyticsEvent =
  | 'draft_completed'
  | 'season_simulated'
  | 'season_resimulated'
  | 'share_copied'
  | 'native_share_opened'
  | 'perfect_season_achieved'
  | 'leaderboard_submit'
  | 'leaderboard_submit_error'
  | 'sim162_season_simulated'
  | 'sim162_playoff_qualified'
  | 'sim162_won_world_series'
  | 'sim162_leaderboard_submitted'

export function trackEvent(
  event: AnalyticsEvent,
  payload?: Record<string, string | number | boolean>,
): void {
  void event
  void payload
  // No-op stub — wire to analytics provider when ready.
}
