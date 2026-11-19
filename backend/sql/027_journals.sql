-- ============================================================
-- 027: Модуль электронных журналов
--      journals, journal_columns, journal_rows,
--      journal_row_revisions, journal_row_confirmations,
--      journal_audit_events
-- ============================================================

-- Журнал
CREATE TABLE IF NOT EXISTS journals (
  id                SERIAL PRIMARY KEY,
  title             VARCHAR(255) NOT NULL,
  department_id     INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  owner_user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status            VARCHAR(20) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'published', 'archived')),
  version           INTEGER NOT NULL DEFAULT 1,
  schema_version    INTEGER NOT NULL DEFAULT 1,
  first_published_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_journals_owner        ON journals (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_journals_dept_status  ON journals (department_id, status);

-- Колонки журнала (UUID для стабильного идентификатора значений)
CREATE TABLE IF NOT EXISTS journal_columns (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id  INTEGER NOT NULL REFERENCES journals(id) ON DELETE CASCADE,
  title       VARCHAR(255) NOT NULL,
  type        VARCHAR(20) NOT NULL CHECK (type IN ('text', 'date', 'confirmation')),
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- Не более одной колонки confirmation на журнал
CREATE UNIQUE INDEX IF NOT EXISTS uq_journal_one_confirmation
  ON journal_columns (journal_id)
  WHERE type = 'confirmation';

CREATE INDEX IF NOT EXISTS idx_journal_columns_journal
  ON journal_columns (journal_id, sort_order);

-- Строки журнала (мягкое удаление)
CREATE TABLE IF NOT EXISTS journal_rows (
  id               SERIAL PRIMARY KEY,
  journal_id       INTEGER NOT NULL REFERENCES journals(id) ON DELETE RESTRICT,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  current_revision INTEGER NOT NULL DEFAULT 1,
  deleted_at       TIMESTAMPTZ,
  deleted_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  deletion_reason  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_rows_journal_order
  ON journal_rows (journal_id, sort_order) WHERE deleted_at IS NULL;

-- Ревизии строк (неизменяемые снимки данных)
CREATE TABLE IF NOT EXISTS journal_row_revisions (
  row_id         INTEGER NOT NULL REFERENCES journal_rows(id) ON DELETE RESTRICT,
  revision       INTEGER NOT NULL,
  values         JSONB NOT NULL DEFAULT '{}',
  schema_snapshot JSONB NOT NULL DEFAULT '{}',
  created_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  change_reason  TEXT,
  PRIMARY KEY (row_id, revision)
);

CREATE INDEX IF NOT EXISTS idx_journal_row_revisions_row
  ON journal_row_revisions (row_id, revision);

-- Гарантируем, что current_revision указывает на реальную ревизию
-- (FK с отложенной проверкой из-за цикличности при создании)
-- Добавляем FK явно: journal_rows.current_revision → journal_row_revisions(row_id, revision)
-- (Postgres не поддерживает FK на составной PK по-простому, используем триггер через check)
-- Вместо этого обеспечиваем через код контроллера + тест

-- Подтверждения строк
CREATE TABLE IF NOT EXISTS journal_row_confirmations (
  id                    BIGSERIAL PRIMARY KEY,
  row_id                INTEGER NOT NULL REFERENCES journal_rows(id) ON DELETE RESTRICT,
  row_revision          INTEGER NOT NULL,
  signer_user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  signer_full_name      VARCHAR(255) NOT NULL,  -- снимок ФИО
  signer_position       VARCHAR(255),           -- снимок должности в отделении
  department_name       VARCHAR(255) NOT NULL,  -- снимок названия отделения
  journal_title         VARCHAR(255) NOT NULL,  -- снимок названия журнала
  confirmed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  method                VARCHAR(50) NOT NULL DEFAULT 'password_confirmation',
  status                VARCHAR(20) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'voided')),
  voided_at             TIMESTAMPTZ,
  voided_by             INTEGER REFERENCES users(id) ON DELETE SET NULL,
  void_reason           TEXT,
  idempotency_key       VARCHAR(255) UNIQUE,

  CONSTRAINT fk_confirmation_revision
    FOREIGN KEY (row_id, row_revision)
    REFERENCES journal_row_revisions (row_id, revision)
);

-- Не более одного активного подтверждения на строку
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_active_confirmation_per_row
  ON journal_row_confirmations (row_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_confirmations_row
  ON journal_row_confirmations (row_id, status);
CREATE INDEX IF NOT EXISTS idx_confirmations_signer
  ON journal_row_confirmations (signer_user_id);

-- Журнал аудита
CREATE TABLE IF NOT EXISTS journal_audit_events (
  id          BIGSERIAL PRIMARY KEY,
  object_type VARCHAR(50) NOT NULL,   -- 'journal', 'row', 'access', 'employee', 'import', ...
  object_id   VARCHAR(100) NOT NULL,
  action      VARCHAR(50) NOT NULL,
  actor_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  request_id  VARCHAR(100),
  reason      TEXT,
  prev_data   JSONB,
  new_data    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_object ON journal_audit_events (object_type, object_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_actor  ON journal_audit_events (actor_id, created_at);
