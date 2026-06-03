/** Stable analytics event names — stub wrappers for future instrumentation. */

export type AnalyticsEvent =
  | 'draft_completed'
  | 'season_simulated'
  | 'season_resimulated'
  | 'share_copied'
  | 'native_share_opened'
  | 'perfect_season_achieved'

export function trackEvent(
  event: AnalyticsEvent,
  payload?: Record<string, string | number | boolean>,
): void {
  void event
  void payload
  // No-op stub — wire to analytics provider when ready.
}
