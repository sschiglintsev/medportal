-- ============================================================
-- Шаг 1: Снимаем ВСЕ ограничения с users.role,
--         чтобы можно было свободно менять roles
-- ============================================================
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_fkey;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- ============================================================
-- Шаг 1б: Убираем NOT NULL с колонки name (если она есть)
--          чтобы новые вставки без name не падали
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'roles' AND column_name = 'name'
  ) THEN
    ALTER TABLE roles ALTER COLUMN name DROP NOT NULL;
  END IF;
END $$;

-- ============================================================
-- Шаг 2: Заполняем title из name (если ещё не заполнен)
-- ============================================================
UPDATE roles SET title = name WHERE (title IS NULL OR title = '') AND name IS NOT NULL AND name <> '';

-- ============================================================
-- Шаг 3: Заполняем value по маппингу title → slug
-- ============================================================
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
  ELSE lower(regexp_replace(title, '\s+', '_', 'g'))
END;

-- ============================================================
-- Шаг 4: Мигрируем users.role из любых старых строк в value-слаги
-- ============================================================
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
END;

-- ============================================================
-- Шаг 5: Удаляем дубликаты в roles (оставляем с наименьшим id)
-- ============================================================
DELETE FROM roles a
USING roles b
WHERE a.id > b.id
  AND a.value = b.value
  AND a.value <> '';

-- ============================================================
-- Шаг 6: Добавляем UNIQUE на value (если ещё нет)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'roles_value_key'
  ) THEN
    ALTER TABLE roles ADD CONSTRAINT roles_value_key UNIQUE (value);
  END IF;
END $$;

-- ============================================================
-- Шаг 7: Upsert всех ролей с актуальными правами
-- ============================================================
INSERT INTO roles (
  title, value,
  can_access_cabinet, can_access_admin_cabinet, can_access_quality_cabinet, can_access_cabinet_chief,
  can_manage_references, can_manage_documents, can_view_incidents, can_view_it_requests, can_manage_it_requests
)
VALUES
  ('Администрация',                'administration',     FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('Администратор',                'administrator',      TRUE,  TRUE,  FALSE, FALSE, TRUE,  TRUE,  FALSE, TRUE,  FALSE),
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
  title                        = EXCLUDED.title,
  can_access_cabinet           = EXCLUDED.can_access_cabinet,
  can_access_admin_cabinet     = EXCLUDED.can_access_admin_cabinet,
  can_access_quality_cabinet   = EXCLUDED.can_access_quality_cabinet,
  can_access_cabinet_chief     = EXCLUDED.can_access_cabinet_chief,
  can_manage_references        = EXCLUDED.can_manage_references,
  can_manage_documents         = EXCLUDED.can_manage_documents,
  can_view_incidents           = EXCLUDED.can_view_incidents,
  can_view_it_requests         = EXCLUDED.can_view_it_requests,
  can_manage_it_requests       = EXCLUDED.can_manage_it_requests;

-- ============================================================
-- Шаг 8: Навешиваем FK на users.role → roles(value)
-- ============================================================
ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(100);
ALTER TABLE users
  ADD CONSTRAINT users_role_fkey
  FOREIGN KEY (role) REFERENCES roles(value);

-- ============================================================
-- Шаг 9: Проверка — выводим итоговые роли и пользователей
-- ============================================================
SELECT id, title, value FROM roles ORDER BY title;
SELECT id, username, full_name, role FROM users;
