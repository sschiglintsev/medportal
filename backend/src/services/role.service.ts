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
      ('АХЧ',                          'facility',          FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
      ('Главный врач',                 'chief_doctor',      TRUE,  FALSE, FALSE, TRUE,  FALSE, FALSE, TRUE,  TRUE,  FALSE),
      ('ИТ отдел',                     'it_department',     TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, TRUE),
      ('Метролог',                     'metrologist',       FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
      ('Отдел кадров',                 'hr_department',     FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
      ('Отдел качества',               'quality_department',TRUE,  FALSE, TRUE,  FALSE, FALSE, FALSE, TRUE,  FALSE, FALSE),
      ('Планово-экономический отдел',  'planning_department',FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
      ('Профсоюз',                     'trade_union',       FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
      ('Сотрудник',                    'employee',          FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
      ('Эпидемиолог',                  'epidemiologist',    FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE)
    ON CONFLICT (value) DO UPDATE SET
      title                  = EXCLUDED.title,
      can_access_cabinet     = EXCLUDED.can_access_cabinet,
      can_access_admin_cabinet     = EXCLUDED.can_access_admin_cabinet,
      can_access_quality_cabinet   = EXCLUDED.can_access_quality_cabinet,
      can_access_cabinet_chief     = EXCLUDED.can_access_cabinet_chief,
      can_manage_references  = EXCLUDED.can_manage_references,
      can_manage_documents   = EXCLUDED.can_manage_documents,
      can_view_incidents     = EXCLUDED.can_view_incidents,
      can_view_it_requests   = EXCLUDED.can_view_it_requests,
      can_manage_it_requests = EXCLUDED.can_manage_it_requests
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
