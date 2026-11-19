import type { PoolClient } from 'pg';

import { withDbClient } from '../db';

export type RolePermissions = {
  canAccessCabinet: boolean;
  canAccessAdminCabinet: boolean;
  canAccessQualityCabinet: boolean;
  canAccessCabinetChief: boolean;
  canManageReferences: boolean;
  canManageDocuments: boolean;
  canViewIncidents: boolean;
  canViewItRequests: boolean;
  canManageItRequests: boolean;
  // Новые разрешения (добавлены миграцией 025)
  canManageEmployees: boolean;
  canManageOwnJournals: boolean;
  canManageAllJournals: boolean;
  canManageJournalAccess: boolean;
};

type RoleRow = {
  id: number;
  title: string;
  value: string;
  can_access_cabinet: boolean;
  can_access_admin_cabinet: boolean;
  can_access_quality_cabinet: boolean;
  can_access_cabinet_chief: boolean;
  can_manage_references: boolean;
  can_manage_documents: boolean;
  can_view_incidents: boolean;
  can_view_it_requests: boolean;
  can_manage_it_requests: boolean;
  can_manage_employees: boolean;
  can_manage_own_journals: boolean;
  can_manage_all_journals: boolean;
  can_manage_journal_access: boolean;
  is_active: boolean;
};

let rolesTableReady = false;

function mapRolePermissions(row: RoleRow): RolePermissions {
  return {
    canAccessCabinet: row.can_access_cabinet,
    canAccessAdminCabinet: row.can_access_admin_cabinet,
    canAccessQualityCabinet: row.can_access_quality_cabinet,
    canAccessCabinetChief: row.can_access_cabinet_chief,
    canManageReferences: row.can_manage_references,
    canManageDocuments: row.can_manage_documents,
    canViewIncidents: row.can_view_incidents,
    canViewItRequests: row.can_view_it_requests,
    canManageItRequests: row.can_manage_it_requests,
    // Новые разрешения из миграции 025; если колонок ещё нет — false по умолчанию
    canManageEmployees: row.can_manage_employees ?? false,
    canManageOwnJournals: row.can_manage_own_journals ?? false,
    canManageAllJournals: row.can_manage_all_journals ?? false,
    canManageJournalAccess: row.can_manage_journal_access ?? false,
  };
}

async function ensureRolesSchema(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY,
      title VARCHAR(100) NOT NULL DEFAULT '',
      value VARCHAR(100) NOT NULL DEFAULT '',
      can_access_cabinet BOOLEAN NOT NULL DEFAULT FALSE,
      can_access_admin_cabinet BOOLEAN NOT NULL DEFAULT FALSE,
      can_access_quality_cabinet BOOLEAN NOT NULL DEFAULT FALSE,
      can_access_cabinet_chief BOOLEAN NOT NULL DEFAULT FALSE,
      can_manage_references BOOLEAN NOT NULL DEFAULT FALSE,
      can_manage_documents BOOLEAN NOT NULL DEFAULT FALSE,
      can_view_incidents BOOLEAN NOT NULL DEFAULT FALSE,
      can_view_it_requests BOOLEAN NOT NULL DEFAULT FALSE,
      can_manage_it_requests BOOLEAN NOT NULL DEFAULT FALSE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  // Для существующих инсталляций — добавляем новые колонки если их нет
  await client.query(`ALTER TABLE roles ADD COLUMN IF NOT EXISTS title VARCHAR(100) NOT NULL DEFAULT ''`);
  await client.query(`ALTER TABLE roles ADD COLUMN IF NOT EXISTS value VARCHAR(100) NOT NULL DEFAULT ''`);
  await client.query(`ALTER TABLE roles ADD COLUMN IF NOT EXISTS can_access_cabinet_chief BOOLEAN NOT NULL DEFAULT FALSE`);
  await client.query(`ALTER TABLE roles ADD COLUMN IF NOT EXISTS can_manage_it_requests BOOLEAN NOT NULL DEFAULT FALSE`);

  // Колонки из миграции 025 — добавляем если ещё нет (для установок без SQL-миграций)
  await client.query(`ALTER TABLE roles ADD COLUMN IF NOT EXISTS can_manage_employees BOOLEAN NOT NULL DEFAULT FALSE`);
  await client.query(`ALTER TABLE roles ADD COLUMN IF NOT EXISTS can_manage_own_journals BOOLEAN NOT NULL DEFAULT FALSE`);
  await client.query(`ALTER TABLE roles ADD COLUMN IF NOT EXISTS can_manage_all_journals BOOLEAN NOT NULL DEFAULT FALSE`);
  await client.query(`ALTER TABLE roles ADD COLUMN IF NOT EXISTS can_manage_journal_access BOOLEAN NOT NULL DEFAULT FALSE`);

  // Если старая колонка name существует — убираем NOT NULL чтобы новые вставки не падали
  await client.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'roles' AND column_name = 'name'
      ) THEN
        ALTER TABLE roles ALTER COLUMN name DROP NOT NULL;
      END IF;
    END $$
  `);

  // Если существует старая колонка name — копируем в title где title пустой
  await client.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'roles' AND column_name = 'name'
      ) THEN
        UPDATE roles SET title = name WHERE title = '' AND name IS NOT NULL AND name <> '';
      END IF;
    END $$
  `);

  // Заполняем value из title по известным маппингам (если value ещё пустой)
  await client.query(`
    UPDATE roles SET value = CASE title
      WHEN 'Администрация'                THEN 'administration'
      WHEN 'Администратор'                THEN 'administrator'
      WHEN 'АХЧ'                          THEN 'facility'
      WHEN 'АХЧ отдел'                    THEN 'facility'
      WHEN 'Главный врач'                 THEN 'chief_doctor'
      WHEN 'ИТ отдел'                     THEN 'it_department'
      WHEN 'Ит отдел'                     THEN 'it_department'
      WHEN 'Метролог'                     THEN 'metrologist'
      WHEN 'Metrolog'                     THEN 'metrologist'
      WHEN 'Отдел кадров'                 THEN 'hr_department'
      WHEN 'Отдел качества'               THEN 'quality_department'
      WHEN 'Контроль качества'            THEN 'quality_department'
      WHEN 'Планово-экономический отдел'  THEN 'planning_department'
      WHEN 'Профсоюз'                     THEN 'trade_union'
      WHEN 'Сотрудник'                    THEN 'employee'
      WHEN 'Эпидемиолог'                  THEN 'epidemiologist'
      ELSE lower(replace(title, ' ', '_'))
    END
    WHERE value = ''
  `);

  // Удаляем дубликаты value (оставляем с наименьшим id)
  await client.query(`
    DELETE FROM roles a
    USING roles b
    WHERE a.id > b.id
      AND a.value = b.value
      AND a.value <> ''
  `);

  // Добавляем UNIQUE на value если его ещё нет
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'roles_value_key'
      ) THEN
        ALTER TABLE roles ADD CONSTRAINT roles_value_key UNIQUE (value);
      END IF;
    END $$
  `);
}

async function upsertRoles(client: PoolClient): Promise<void> {
  // ВАЖНО: новые разрешения (can_manage_employees, can_manage_own_journals,
  // can_manage_all_journals, can_manage_journal_access) НЕ включены
  // в ON CONFLICT DO UPDATE SET — их устанавливает миграция 025 и они
  // не должны сбрасываться при каждом перезапуске сервера.
  // Для новой установки INSERT задаёт корректные начальные значения.
  await client.query(`
    INSERT INTO roles (
      title,
      value,
      can_access_cabinet,
      can_access_admin_cabinet,
      can_access_quality_cabinet,
      can_access_cabinet_chief,
      can_manage_references,
      can_manage_documents,
      can_view_incidents,
      can_view_it_requests,
      can_manage_it_requests
    )
    VALUES
      ('Администрация',                'administration',    FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
      ('Администратор',                'administrator',     TRUE,  TRUE,  FALSE, FALSE, TRUE,  TRUE,  TRUE,  TRUE,  FALSE),
      ('АХЧ',                          'facility',          TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
      ('Главный врач',                 'chief_doctor',      TRUE,  FALSE, FALSE, TRUE,  FALSE, FALSE, TRUE,  TRUE,  FALSE),
      ('Диспетчер',                    'dispatcher',        TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
      ('ИТ отдел',                     'it_department',     TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, TRUE),
      ('Метролог',                     'metrologist',       TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
      ('Отдел кадров',                 'hr_department',     FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
      ('Отдел качества',               'quality_department',TRUE,  FALSE, TRUE,  FALSE, TRUE,  FALSE, TRUE,  FALSE, FALSE),
      ('Планово-экономический отдел',  'planning_department',FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
      ('Профсоюз',                     'trade_union',       FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
      ('Сотрудник',                    'employee',          TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
      ('Эпидемиолог',                  'epidemiologist',    FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE)
    ON CONFLICT (value) DO UPDATE SET
      title                        = EXCLUDED.title,
      can_access_cabinet           = EXCLUDED.can_access_cabinet,
      can_access_admin_cabinet     = EXCLUDED.can_access_admin_cabinet,
      can_access_quality_cabinet   = EXCLUDED.can_access_quality_cabinet,
      can_access_cabinet_chief     = EXCLUDED.can_access_cabinet_chief,
      can_manage_references        = EXCLUDED.can_manage_references,
      can_manage_documents         = EXCLUDED.can_manage_documents,
      can_view_incidents           = EXCLUDED.can_view_incidents,
      can_view_it_requests         = EXCLUDED.can_view_it_requests,
      can_manage_it_requests       = EXCLUDED.can_manage_it_requests
      -- can_manage_employees, can_manage_own_journals, can_manage_all_journals,
      -- can_manage_journal_access — НЕ обновляются здесь (см. миграцию 025)
  `);

  // head_nurse создаётся миграцией 025, но если её нет — создаём здесь
  // без ON CONFLICT UPDATE (не затираем права, установленные миграцией)
  await client.query(`
    INSERT INTO roles (
      title, value,
      can_access_cabinet, can_access_admin_cabinet, can_access_quality_cabinet, can_access_cabinet_chief,
      can_manage_references, can_manage_documents, can_view_incidents, can_view_it_requests, can_manage_it_requests
    )
    VALUES ('Главная медсестра', 'head_nurse', TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE)
    ON CONFLICT (value) DO NOTHING
  `);

  // ── Эквивалент миграции 025: выставляем права для ролей ──────────────────
  // Используем DO UPDATE WHERE ... чтобы не затирать уже правильно выставленные значения,
  // но гарантировать, что после первого запуска права корректны.
  await client.query(`
    UPDATE roles
    SET
      can_manage_employees    = TRUE,
      can_manage_all_journals = TRUE,
      can_manage_journal_access = TRUE
    WHERE value = 'administrator'
      AND (can_manage_employees = FALSE OR can_manage_all_journals = FALSE OR can_manage_journal_access = FALSE)
  `);

  await client.query(`
    UPDATE roles
    SET
      can_manage_own_journals   = TRUE,
      can_manage_journal_access = TRUE
    WHERE value = 'head_nurse'
      AND (can_manage_own_journals = FALSE OR can_manage_journal_access = FALSE)
  `);

  // Кабинет сотрудника готов — включаем доступ (ранее был отложен до деплоя frontend)
  await client.query(`
    UPDATE roles
    SET can_access_cabinet = TRUE
    WHERE value = 'employee'
      AND can_access_cabinet = FALSE
  `);
}

async function migrateUsersRoleToValue(client: PoolClient): Promise<void> {
  // Переносим users.role из любых старых русских названий в английские value
  await client.query(`
    UPDATE users SET role = CASE role
      WHEN 'Администрация'                THEN 'administration'
      WHEN 'Администратор'                THEN 'administrator'
      WHEN 'АХЧ'                          THEN 'facility'
      WHEN 'АХЧ отдел'                    THEN 'facility'
      WHEN 'Главный врач'                 THEN 'chief_doctor'
      WHEN 'ИТ отдел'                     THEN 'it_department'
      WHEN 'Ит отдел'                     THEN 'it_department'
      WHEN 'Метролог'                     THEN 'metrologist'
      WHEN 'Metrolog'                     THEN 'metrologist'
      WHEN 'Отдел кадров'                 THEN 'hr_department'
      WHEN 'Отдел качества'               THEN 'quality_department'
      WHEN 'Контроль качества'            THEN 'quality_department'
      WHEN 'Планово-экономический отдел'  THEN 'planning_department'
      WHEN 'Профсоюз'                     THEN 'trade_union'
      WHEN 'Сотрудник'                    THEN 'employee'
      WHEN 'Эпидемиолог'                  THEN 'epidemiologist'
      ELSE role
    END
    WHERE role NOT IN (SELECT value FROM roles WHERE value <> '')
  `);
}

async function migrateUsersTable(client: PoolClient): Promise<void> {
  await client.query(`ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(100)`);
  await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
  await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_fkey`);
  await client.query(`
    ALTER TABLE users
    ADD CONSTRAINT users_role_fkey
    FOREIGN KEY (role) REFERENCES roles(value)
  `);

  // Таблица транспортных заявок
  await client.query(`
    CREATE TABLE IF NOT EXISTS transport_requests (
      id               SERIAL PRIMARY KEY,
      department       VARCHAR(255) NOT NULL,
      initiator        VARCHAR(255) NOT NULL,
      submission_date  DATE         NOT NULL,
      submission_time  TIME         NOT NULL,
      route_from       VARCHAR(255) NOT NULL,
      route_to         VARCHAR(255) NOT NULL,
      purpose          TEXT         NOT NULL,
      passenger_count  INTEGER      NOT NULL,
      special_notes    TEXT,
      status           VARCHAR(20)  NOT NULL DEFAULT 'new',
      comment          TEXT,
      created_at       TIMESTAMP    NOT NULL DEFAULT NOW()
    )
  `);

  // Колонки из миграции 024 — добавляем если ещё нет (auth-расширения)
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_version INTEGER NOT NULL DEFAULT 0`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS temporary_password_expires_at TIMESTAMPTZ`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ`);

  // Поля для привязки Max
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS max_chat_id VARCHAR(50)`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS max_username VARCHAR(255)`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS max_verified_at TIMESTAMP`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS max_link_code_hash TEXT`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS max_link_code_expires_at TIMESTAMP`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS max_link_pending_user_id VARCHAR(50)`);
  await client.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS max_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE
  `);
}

async function ensureUsersTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      role VARCHAR(100) NOT NULL REFERENCES roles(value),
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
}

async function ensureEmployeeTables(client: PoolClient): Promise<void> {
  // ── Миграция 026: кадровый модуль ────────────────────────────────────────
  await client.query(`
    CREATE TABLE IF NOT EXISTS employee_profiles (
      user_id         INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
      employee_code   VARCHAR(50) NOT NULL UNIQUE,
      version         INTEGER NOT NULL DEFAULT 1,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`CREATE SEQUENCE IF NOT EXISTS employee_code_seq START 1`);

  await client.query(`
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
    )
  `);

  await client.query(`CREATE INDEX IF NOT EXISTS idx_employee_departments_user_id ON employee_departments (user_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_employee_departments_dept_id ON employee_departments (department_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_employee_departments_active  ON employee_departments (department_id, user_id) WHERE is_active = TRUE`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS journal_department_settings (
      department_id   INTEGER PRIMARY KEY REFERENCES departments(id) ON DELETE RESTRICT,
      access_version  INTEGER NOT NULL DEFAULT 1,
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
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
    )
  `);

  await client.query(`CREATE INDEX IF NOT EXISTS idx_dept_journal_access_dept_user ON department_journal_access (department_id, user_id) WHERE is_active = TRUE`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_dept_journal_access_user     ON department_journal_access (user_id) WHERE is_active = TRUE`);

  await client.query(`
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
      rows_data        JSONB,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`CREATE INDEX IF NOT EXISTS idx_employee_import_batches_owner ON employee_import_batches (created_by, expires_at)`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      id              BIGSERIAL PRIMARY KEY,
      actor_user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      operation       VARCHAR(100) NOT NULL,
      key             VARCHAR(255) NOT NULL,
      payload_digest  VARCHAR(64),
      result_id       VARCHAR(255),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_idempotency UNIQUE (actor_user_id, operation, key)
    )
  `);

  await client.query(`CREATE INDEX IF NOT EXISTS idx_idempotency_cleanup ON idempotency_keys (created_at)`);
}

async function ensureJournalTables(client: PoolClient): Promise<void> {
  // ── Миграция 027: модуль журналов ─────────────────────────────────────────
  await client.query(`
    CREATE TABLE IF NOT EXISTS journals (
      id                 SERIAL PRIMARY KEY,
      title              VARCHAR(255) NOT NULL,
      department_id      INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
      owner_user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      status             VARCHAR(20) NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft', 'published', 'archived')),
      version            INTEGER NOT NULL DEFAULT 1,
      schema_version     INTEGER NOT NULL DEFAULT 1,
      first_published_at TIMESTAMPTZ,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      archived_at        TIMESTAMPTZ
    )
  `);

  await client.query(`CREATE INDEX IF NOT EXISTS idx_journals_owner       ON journals (owner_user_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_journals_dept_status ON journals (department_id, status)`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS journal_columns (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      journal_id  INTEGER NOT NULL REFERENCES journals(id) ON DELETE CASCADE,
      title       VARCHAR(255) NOT NULL,
      type        VARCHAR(20) NOT NULL CHECK (type IN ('text', 'date', 'confirmation')),
      sort_order  INTEGER NOT NULL DEFAULT 0
    )
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_journal_one_confirmation
      ON journal_columns (journal_id) WHERE type = 'confirmation'
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_journal_columns_journal ON journal_columns (journal_id, sort_order)`);

  // Миграция: флаг «разрешено заполнять медсестре при подтверждении»
  await client.query(`
    ALTER TABLE journal_columns
      ADD COLUMN IF NOT EXISTS is_editable_by_employee BOOLEAN NOT NULL DEFAULT TRUE
  `);

  await client.query(`
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
    )
  `);

  await client.query(`CREATE INDEX IF NOT EXISTS idx_journal_rows_journal_order ON journal_rows (journal_id, sort_order) WHERE deleted_at IS NULL`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS journal_row_revisions (
      row_id          INTEGER NOT NULL REFERENCES journal_rows(id) ON DELETE RESTRICT,
      revision        INTEGER NOT NULL,
      values          JSONB NOT NULL DEFAULT '{}',
      schema_snapshot JSONB NOT NULL DEFAULT '{}',
      created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      change_reason   TEXT,
      PRIMARY KEY (row_id, revision)
    )
  `);

  await client.query(`CREATE INDEX IF NOT EXISTS idx_journal_row_revisions_row ON journal_row_revisions (row_id, revision)`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS journal_row_confirmations (
      id               BIGSERIAL PRIMARY KEY,
      row_id           INTEGER NOT NULL REFERENCES journal_rows(id) ON DELETE RESTRICT,
      row_revision     INTEGER NOT NULL,
      signer_user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      signer_full_name VARCHAR(255) NOT NULL,
      signer_position  VARCHAR(255),
      department_name  VARCHAR(255) NOT NULL,
      journal_title    VARCHAR(255) NOT NULL,
      confirmed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      method           VARCHAR(50) NOT NULL DEFAULT 'password_confirmation',
      status           VARCHAR(20) NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'voided')),
      voided_at        TIMESTAMPTZ,
      voided_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
      void_reason      TEXT,
      idempotency_key  VARCHAR(255) UNIQUE,
      CONSTRAINT fk_confirmation_revision
        FOREIGN KEY (row_id, row_revision) REFERENCES journal_row_revisions (row_id, revision)
    )
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_one_active_confirmation_per_row
      ON journal_row_confirmations (row_id) WHERE status = 'active'
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_confirmations_row    ON journal_row_confirmations (row_id, status)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_confirmations_signer ON journal_row_confirmations (signer_user_id)`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS journal_audit_events (
      id          BIGSERIAL PRIMARY KEY,
      object_type VARCHAR(50) NOT NULL,
      object_id   VARCHAR(100) NOT NULL,
      action      VARCHAR(50) NOT NULL,
      actor_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
      request_id  VARCHAR(100),
      reason      TEXT,
      prev_data   JSONB,
      new_data    JSONB,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_object ON journal_audit_events (object_type, object_id, created_at)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_actor  ON journal_audit_events (actor_id, created_at)`);
}

export async function ensureAuthTables(): Promise<void> {
  if (rolesTableReady) {
    return;
  }

  await withDbClient(async (client) => {
    await ensureRolesSchema(client);
    await upsertRoles(client);
    await ensureUsersTable(client);
    await migrateUsersRoleToValue(client);
    await migrateUsersTable(client);
    await ensureEmployeeTables(client);
    await ensureJournalTables(client);
  });

  rolesTableReady = true;
}

export async function getRegistrationRoles(): Promise<Array<{ id: number; title: string; value: string }>> {
  await ensureAuthTables();

  const result = await withDbClient((client) =>
    client.query<{ id: number; title: string; value: string }>(
      `
      SELECT id, title, value
      FROM roles
      WHERE is_active = TRUE
      ORDER BY title
      `,
    ),
  );

  return result.rows;
}

export async function getRoleByValue(
  roleValue: string,
): Promise<(RoleRow & { permissions: RolePermissions }) | null> {
  await ensureAuthTables();

  const result = await withDbClient((client) =>
    client.query<RoleRow>(
      `
      SELECT
        id,
        title,
        value,
        can_access_cabinet,
        can_access_admin_cabinet,
        can_access_quality_cabinet,
        can_access_cabinet_chief,
        can_manage_references,
        can_manage_documents,
        can_view_incidents,
        can_view_it_requests,
        can_manage_it_requests,
        COALESCE(can_manage_employees, FALSE)      AS can_manage_employees,
        COALESCE(can_manage_own_journals, FALSE)   AS can_manage_own_journals,
        COALESCE(can_manage_all_journals, FALSE)   AS can_manage_all_journals,
        COALESCE(can_manage_journal_access, FALSE) AS can_manage_journal_access,
        is_active
      FROM roles
      WHERE value = $1
      LIMIT 1
      `,
      [roleValue],
    ),
  );

  const role = result.rows[0];
  if (!role) {
    return null;
  }

  return {
    ...role,
    permissions: mapRolePermissions(role),
  };
}
