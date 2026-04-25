-- Таблица ролей: title — русское название, value — английский slug (используется как FK)
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
);

-- Добавляем колонки если отсутствуют (для существующих инсталляций)
ALTER TABLE roles ADD COLUMN IF NOT EXISTS title VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE roles ADD COLUMN IF NOT EXISTS value VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE roles ADD COLUMN IF NOT EXISTS can_access_cabinet_chief BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS can_manage_it_requests BOOLEAN NOT NULL DEFAULT FALSE;

-- Если существует старая колонка name — копируем в title
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'roles' AND column_name = 'name'
  ) THEN
    UPDATE roles SET title = name WHERE title = '' AND name IS NOT NULL AND name <> '';
  END IF;
END $$;

-- Заполняем value из title по маппингу
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
WHERE value = '';

-- Удаляем дубликаты value (оставляем с наименьшим id)
DELETE FROM roles a
USING roles b
WHERE a.id > b.id
  AND a.value = b.value
  AND a.value <> '';

-- Добавляем UNIQUE constraint на value
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'roles_value_key'
  ) THEN
    ALTER TABLE roles ADD CONSTRAINT roles_value_key UNIQUE (value);
  END IF;
END $$;

-- Вставляем/обновляем роли по value
INSERT INTO roles (
  title, value,
  can_access_cabinet, can_access_admin_cabinet, can_access_quality_cabinet, can_access_cabinet_chief,
  can_manage_references, can_manage_documents, can_view_incidents, can_view_it_requests, can_manage_it_requests
)
VALUES
  ('Администрация',                'administration',     FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('Администратор',                'administrator',      TRUE,  TRUE,  FALSE, FALSE, TRUE,  TRUE,  TRUE,  TRUE,  FALSE),
  ('АХЧ',                          'facility',           FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('Главный врач',                 'chief_doctor',       TRUE,  FALSE, FALSE, TRUE,  FALSE, FALSE, TRUE,  TRUE,  FALSE),
  ('ИТ отдел',                     'it_department',      TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, TRUE),
  ('Метролог',                     'metrologist',        FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('Отдел кадров',                 'hr_department',      FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('Отдел качества',               'quality_department', TRUE,  FALSE, TRUE,  FALSE, FALSE, FALSE, TRUE,  FALSE, FALSE),
  ('Планово-экономический отдел',  'planning_department',FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('Профсоюз',                     'trade_union',        FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('Сотрудник',                    'employee',           FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('Эпидемиолог',                  'epidemiologist',     FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE)
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
  can_manage_it_requests = EXCLUDED.can_manage_it_requests;

-- Переносим users.role из любых старых названий в новые английские value
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
WHERE role NOT IN (SELECT value FROM roles WHERE value <> '');

-- Обновляем FK на users: теперь ссылается на roles(value)
ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(100);
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_fkey;
ALTER TABLE users ADD CONSTRAINT users_role_fkey FOREIGN KEY (role) REFERENCES roles(value);
