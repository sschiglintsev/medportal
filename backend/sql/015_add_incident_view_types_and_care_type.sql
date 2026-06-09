CREATE TABLE IF NOT EXISTS incident_view_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  care_type VARCHAR(50) NOT NULL CHECK (care_type IN ('Стационар', 'Поликлиника')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE departments ADD COLUMN IF NOT EXISTS care_type VARCHAR(50) CHECK (care_type IN ('Стационар', 'Поликлиника'));
