-- Deduplicate emails (keep lowest id), then enforce uniqueness.
DELETE FROM users
WHERE id NOT IN (
  SELECT MIN(id) FROM users GROUP BY lower(email)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users (email);

-- Deduplicate assets per user+symbol, then enforce uniqueness.
DELETE FROM assets
WHERE id NOT IN (
  SELECT MIN(id) FROM assets GROUP BY user_id, upper(symbol)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_user_symbol_unique ON assets (user_id, symbol);

-- Server-side refresh token store (rotation + revoke).
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  jti TEXT NOT NULL UNIQUE,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens (token_hash);

CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_prices_user_symbol_date
  ON custom_prices (user_id, symbol, date);
