-- ============================================================
-- 024: Расширение таблицы users для поддержки
--      блокировки аккаунта, временных паролей и
--      отзыва JWT через auth_version.
--
-- Defaults безопасны для существующих записей:
--   is_active                    = TRUE  — прежние пользователи не блокируются
--   must_change_password         = FALSE — прежние пользователи не получают обязательную смену
--   temporary_password_expires_at= NULL  — нет ограничения по времени
--   password_changed_at          = NULL  — не заполнено ретроактивно
--   auth_version                 = 0     — совместимо со старыми JWT без claim версии
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active                     BOOLEAN    NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS must_change_password          BOOLEAN    NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS temporary_password_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS password_changed_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auth_version                  INTEGER    NOT NULL DEFAULT 0;
