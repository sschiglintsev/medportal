-- ============================================================
-- 025: Добавление 4 новых булевых разрешений в таблицу roles,
--      роль head_nurse и назначение прав.
--
-- ВАЖНО: ON CONFLICT DO UPDATE для новых колонок НЕ используется
--        в role.service.ts (upsertRoles). Колонки задаются здесь
--        один раз и при последующих запусках сервиса не сбрасываются.
-- ============================================================

-- 1. Добавляем новые колонки
ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS can_manage_employees     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_manage_own_journals  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_manage_all_journals  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_manage_journal_access BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Создаём роль head_nurse (если ещё нет)
INSERT INTO roles (
  title, value,
  can_access_cabinet, can_access_admin_cabinet, can_access_quality_cabinet, can_access_cabinet_chief,
  can_manage_references, can_manage_documents, can_view_incidents, can_view_it_requests, can_manage_it_requests,
  can_manage_employees, can_manage_own_journals, can_manage_all_journals, can_manage_journal_access
)
VALUES (
  'Главная медсестра', 'head_nurse',
  TRUE, FALSE, FALSE, FALSE,
  FALSE, FALSE, FALSE, FALSE, FALSE,
  FALSE, TRUE, FALSE, TRUE
)
ON CONFLICT (value) DO NOTHING;

-- 3. Выдаём разрешения администратору
UPDATE roles
SET
  can_manage_employees      = TRUE,
  can_manage_own_journals   = TRUE,
  can_manage_all_journals   = TRUE,
  can_manage_journal_access = TRUE
WHERE value = 'administrator';

-- 4. Выдаём разрешения главной медсестре (обновляем, если роль уже была)
UPDATE roles
SET
  can_access_cabinet        = TRUE,
  can_manage_own_journals   = TRUE,
  can_manage_journal_access = TRUE
WHERE value = 'head_nurse';

-- 5. Включаем доступ в кабинет для employee (будет активировано
--    отдельным шагом после развёртывания нового frontend).
--    Пока ставим FALSE — существующее значение уже FALSE,
--    меняем только когда новый кабинет готов.
-- (активацию выполнить командой: UPDATE roles SET can_access_cabinet = TRUE WHERE value = 'employee';)
