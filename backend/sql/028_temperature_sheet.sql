-- ============================================================
-- 028: Модуль «Температурный лист»
--      patients, temperature_sheets, temperature_sheet_columns,
--      temp_sheet_user_access
-- ============================================================

-- Пациенты (дети)
CREATE TABLE IF NOT EXISTS patients (
  id         SERIAL PRIMARY KEY,
  full_name  VARCHAR(255) NOT NULL,
  birth_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patients_name ON patients (full_name);

-- Температурные листы (один на пациента × отделение)
CREATE TABLE IF NOT EXISTS temperature_sheets (
  id            SERIAL PRIMARY KEY,
  patient_id    INTEGER NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  height_cm     NUMERIC(5,1),
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_sheet_patient_dept UNIQUE (patient_id, department_id)
);

CREATE INDEX IF NOT EXISTS idx_temp_sheets_patient ON temperature_sheets (patient_id);
CREATE INDEX IF NOT EXISTS idx_temp_sheets_dept    ON temperature_sheets (department_id);

-- Колонки заполнения (позиции 1–15)
-- temperature_band: один из восьми диапазонов или NULL
CREATE TABLE IF NOT EXISTS temperature_sheet_columns (
  id                   SERIAL PRIMARY KEY,
  sheet_id             INTEGER NOT NULL REFERENCES temperature_sheets(id) ON DELETE CASCADE,
  column_index         SMALLINT NOT NULL CHECK (column_index BETWEEN 1 AND 15),
  stay_day             VARCHAR(100),
  observation_date     DATE,
  observation_time     TIME,
  temperature_band     VARCHAR(20)
                       CHECK (temperature_band IN
                         ('above41','40_409','39_399','38_389',
                          '37_379','36_369','35_359','below35')),
  respiratory_rate     VARCHAR(20),
  spo2                 VARCHAR(20),
  weight_kg            VARCHAR(20),
  oral_fluid_ml        VARCHAR(20),
  parenteral_fluid_ml  VARCHAR(20),
  urine_volume_ml      VARCHAR(20),
  stool                VARCHAR(500),
  CONSTRAINT uq_sheet_column UNIQUE (sheet_id, column_index)
);

CREATE INDEX IF NOT EXISTS idx_tsc_sheet ON temperature_sheet_columns (sheet_id);

-- Доступ сотрудников к модулю «Температурный лист» (per-user)
CREATE TABLE IF NOT EXISTS temp_sheet_user_access (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  granted_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  revoked_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tsua_user ON temp_sheet_user_access (user_id, is_active);

-- Разрешение на модуль (роль-уровень: head_nurse, administrator)
ALTER TABLE roles ADD COLUMN IF NOT EXISTS can_manage_temp_sheet BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE roles SET can_manage_temp_sheet = TRUE
  WHERE value IN ('head_nurse', 'administrator');
