CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  shop TEXT NOT NULL,
  platform TEXT,
  name TEXT NOT NULL,
  kind TEXT,
  price_current REAL,
  price_previous REAL,
  discount_percent INTEGER,
  currency TEXT,
  price_current_label TEXT,
  price_previous_label TEXT,
  deal_ends_at TEXT,
  deal_ends_at_bogota TEXT,
  url TEXT,
  image TEXT,
  confirmed INTEGER,
  publisher TEXT,
  play_anywhere INTEGER,
  game_key TEXT,
  is_new INTEGER,
  spotlight INTEGER DEFAULT 0,
  payload_json TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_listings_shop_source ON listings(shop, source);
CREATE INDEX IF NOT EXISTS idx_listings_name ON listings(name);
CREATE INDEX IF NOT EXISTS idx_listings_source ON listings(source);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
