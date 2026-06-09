ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS incident_view_type_id INTEGER REFERENCES incident_view_types(id) ON DELETE SET NULL;

ALTER TABLE incidents
  ALTER COLUMN place SET DEFAULT '';
