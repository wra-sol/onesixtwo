CREATE TABLE sim162_leaderboard_entries (
  id TEXT PRIMARY KEY,
  pool TEXT NOT NULL,
  initials TEXT NOT NULL,
  wins INTEGER NOT NULL,
  losses INTEGER NOT NULL,
  postseason_result TEXT NOT NULL,
  postseason_rank INTEGER NOT NULL,
  won_world_series INTEGER NOT NULL,
  user_qualified INTEGER NOT NULL,
  lineup_key TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  submitter_ip TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_sim162_leaderboard_rank ON sim162_leaderboard_entries(
  won_world_series DESC, wins DESC, postseason_rank DESC, created_at ASC
);
CREATE INDEX idx_sim162_leaderboard_ip ON sim162_leaderboard_entries(
  submitter_ip, created_at DESC
);
CREATE INDEX idx_sim162_leaderboard_lineup ON sim162_leaderboard_entries(
  lineup_key
);
