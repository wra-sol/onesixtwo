ALTER TABLE leaderboard_entries ADD COLUMN game_mode_id TEXT NOT NULL DEFAULT 'all-time';

CREATE INDEX idx_leaderboard_mode_created ON leaderboard_entries(
  game_mode_id, created_at DESC
);
CREATE INDEX idx_leaderboard_mode_rank ON leaderboard_entries(
  game_mode_id, wins DESC, losses ASC, team_score DESC, created_at ASC
);
CREATE INDEX idx_leaderboard_mode_lineup ON leaderboard_entries(
  game_mode_id, lineup_key, created_at DESC
);
