CREATE TABLE live_snapshots (
  snapshot_key TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE live_leaderboard_entries (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  challenge_date TEXT NOT NULL,
  target_date TEXT,
  initials TEXT NOT NULL,
  series_wins INTEGER NOT NULL,
  series_losses INTEGER NOT NULL,
  user_runs INTEGER NOT NULL,
  opponent_runs INTEGER NOT NULL,
  run_diff INTEGER NOT NULL,
  won_series INTEGER NOT NULL,
  lineup_key TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  submitter_ip TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_live_leaderboard_mode_date ON live_leaderboard_entries(
  mode, challenge_date, series_wins DESC, run_diff DESC, user_runs DESC, created_at ASC
);

CREATE INDEX idx_live_leaderboard_ip_mode_date ON live_leaderboard_entries(
  submitter_ip, mode, challenge_date, created_at DESC
);

CREATE INDEX idx_live_leaderboard_lineup ON live_leaderboard_entries(
  mode, challenge_date, lineup_key
);
