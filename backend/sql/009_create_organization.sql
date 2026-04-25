CREATE TABLE IF NOT EXISTS organization_profile (
  id INTEGER PRIMARY KEY DEFAULT 1,
  logo_url TEXT,
  hero_image_url TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Гарантируем что единственная строка существует
INSERT INTO organization_profile (id) VALUES (1) ON CONFLICT DO NOTHING;
