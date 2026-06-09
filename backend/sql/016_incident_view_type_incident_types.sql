CREATE TABLE IF NOT EXISTS incident_view_type_incident_types (
  incident_view_type_id INTEGER NOT NULL REFERENCES incident_view_types(id) ON DELETE CASCADE,
  incident_type_id      INTEGER NOT NULL REFERENCES incident_types(id) ON DELETE CASCADE,
  PRIMARY KEY (incident_view_type_id, incident_type_id)
);
