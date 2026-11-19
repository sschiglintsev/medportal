-- ============================================================
-- 026: Кадровый модуль
--      employee_profiles, employee_departments,
--      department_journal_access, journal_department_settings
-- ============================================================

-- Кадровый профиль (1:1 к users)
CREATE TABLE IF NOT EXISTS employee_profiles (
  user_id         INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
  employee_code   VARCHAR(50) NOT NULL UNIQUE,
  version         INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Последовательность для автогенерации кодов EMP-NNNNNN
CREATE SEQUENCE IF NOT EXISTS employee_code_seq START 1;

-- Места работы (N:M users ↔ departments + должность)
CREATE TABLE IF NOT EXISTS employee_departments (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  position      VARCHAR(255) NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  version       INTEGER NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_employee_department UNIQUE (user_id, department_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_departments_user_id
  ON employee_departments (user_id);
CREATE INDEX IF NOT EXISTS idx_employee_departments_dept_id
  ON employee_departments (department_id);
CREATE INDEX IF NOT EXISTS idx_employee_departments_active
  ON employee_departments (department_id, user_id) WHERE is_active = TRUE;

-- Версия общего списка допуска по отделению (для optimistic-locking)
CREATE TABLE IF NOT EXISTS journal_department_settings (
  department_id   INTEGER PRIMARY KEY REFERENCES departments(id) ON DELETE RESTRICT,
  access_version  INTEGER NOT NULL DEFAULT 1,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Общий допуск сотрудников к журналам отделения
CREATE TABLE IF NOT EXISTS department_journal_access (
  id            SERIAL PRIMARY KEY,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  granted_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  granted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  revoked_at    TIMESTAMPTZ,
  CONSTRAINT uq_dept_journal_access UNIQUE (department_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_dept_journal_access_dept_user
  ON department_journal_access (department_id, user_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_dept_journal_access_user
  ON department_journal_access (user_id) WHERE is_active = TRUE;

-- Таблица пакетов импорта сотрудников
CREATE TABLE IF NOT EXISTS employee_import_batches (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by       INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status           VARCHAR(20) NOT NULL DEFAULT 'preview'
                   CHECK (status IN ('preview', 'committed', 'expired')),
  preview_version  INTEGER NOT NULL DEFAULT 1,
  expires_at       TIMESTAMPTZ NOT NULL,
  idempotency_key  VARCHAR(255) UNIQUE,
  plan_digest      VARCHAR(64),
  summary          JSONB,
  rows_data        JSONB,     -- нормализованные строки с персданными; удаляется при истечении
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_import_batches_owner
  ON employee_import_batches (created_by, expires_at);

-- Таблица ключей идемпотентности (общая для всех мутаций)
CREATE TABLE IF NOT EXISTS idempotency_keys (
  id              BIGSERIAL PRIMARY KEY,
  actor_user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operation       VARCHAR(100) NOT NULL,
  key             VARCHAR(255) NOT NULL,
  payload_digest  VARCHAR(64),
  result_id       VARCHAR(255),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_idempotency UNIQUE (actor_user_id, operation, key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_cleanup ON idempotency_keys (created_at);
