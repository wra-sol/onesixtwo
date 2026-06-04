CREATE TABLE leaderboard_entries (
  id TEXT PRIMARY KEY,
  initials TEXT NOT NULL,
  wins INTEGER NOT NULL,
  losses INTEGER NOT NULL,
  team_score REAL NOT NULL,
  is_perfect INTEGER NOT NULL,
  roster_format_id TEXT NOT NULL,
  lineup_key TEXT NOT NULL,
  share_path TEXT NOT NULL,
  submitter_ip TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_leaderboard_created ON leaderboard_entries(created_at DESC);
CREATE INDEX idx_leaderboard_rank ON leaderboard_entries(
  wins DESC, losses ASC, team_score DESC, created_at ASC
);
CREATE INDEX idx_leaderboard_lineup_period ON leaderboard_entries(
  lineup_key, created_at DESC
);
CREATE INDEX idx_leaderboard_ip_day ON leaderboard_entries(
  submitter_ip, created_at DESC
);
