-- График поверок МКС и ПИ
CREATE TABLE IF NOT EXISTS calibration_schedule (
  id                         SERIAL PRIMARY KEY,
  commissioning_date         DATE,
  nomenclature               TEXT NOT NULL,
  name                       TEXT,
  type                       TEXT,
  inventory_number           TEXT,
  serial_number              TEXT,
  manufacture_date           DATE,
  department_id              INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  quantity                   INTEGER,
  verification_kind          TEXT,
  current_verification_date  DATE,
  next_verification_date     DATE,
  note                       TEXT,
  created_at                 TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS calibration_schedule_department_idx
  ON calibration_schedule (department_id);

CREATE INDEX IF NOT EXISTS calibration_schedule_next_date_idx
  ON calibration_schedule (next_verification_date);
