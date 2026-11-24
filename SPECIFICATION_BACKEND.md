# Спецификация Backend — medPortal

Внутренний веб-портал ГБУЗ РБ ГДКБ №17 (г. Уфа).

---

## Содержание

1. [Технологический стек](#1-технологический-стек)
2. [Структура проекта](#2-структура-проекта)
3. [База данных](#3-база-данных)
4. [Аутентификация и авторизация](#4-аутентификация-и-авторизация)
5. [REST API — полный справочник маршрутов](#5-rest-api--полный-справочник-маршрутов)
6. [Загрузка файлов](#6-загрузка-файлов)
7. [Уведомления Max](#7-уведомления-max)
8. [Переменные окружения](#8-переменные-окружения)
9. [Запуск и деплой](#9-запуск-и-деплой)

---

## 1. Технологический стек

| Пакет | Назначение |
|-------|-----------|
| `express` | HTTP-сервер |
| `pg` | Драйвер PostgreSQL (пул соединений) |
| `jsonwebtoken` | JWT авторизация |
| `bcrypt` | Хеширование паролей |
| `multer` | Загрузка файлов (документы, изображения организации) |
| `cors` | CORS с явным whitelist |
| `dotenv` | Переменные окружения |
| `typescript` | Статическая типизация |
| `ts-node-dev` | Hot reload в dev-режиме |

---

## 2. Структура проекта

```
backend/
├── src/
│   ├── app.ts                     ← Express-приложение, подключение всех роутеров
│   ├── server.ts                  ← Запуск HTTP-сервера (listen)
│   ├── db.ts                      ← Пул соединений PostgreSQL + withDbClient()
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── user.controller.ts
│   │   ├── employees.controller.ts       ← Управление сотрудниками
│   │   ├── journal-access.controller.ts  ← Допуск отделений к журналам
│   │   ├── journals.controller.ts        ← Журналы, колонки, строки, подтверждения
│   │   ├── announcement.controller.ts
│   │   ├── document.controller.ts
│   │   ├── documentFolder.controller.ts
│   │   ├── incident.controller.ts
│   │   ├── it-request.controller.ts
│   │   ├── ahch-request.controller.ts
│   │   ├── metrologist-request.controller.ts
│   │   ├── transport-request.controller.ts
│   │   ├── vehicle.controller.ts
│   │   ├── urgency.controller.ts
│   │   ├── analytics.controller.ts
│   │   ├── organization.controller.ts
│   │   ├── health.controller.ts
│   │   ├── profile.controller.ts   ← Max привязка
│   │   └── calibration-schedule.controller.ts
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── user.routes.ts
│   │   ├── employees.routes.ts
│   │   ├── journal-access.routes.ts
│   │   ├── journals.routes.ts
│   │   ├── announcement.routes.ts
│   │   ├── document.routes.ts
│   │   ├── documentFolder.routes.ts
│   │   ├── incident.routes.ts
│   │   ├── it-request.routes.ts
│   │   ├── ahch-request.routes.ts
│   │   ├── metrologist-request.routes.ts
│   │   ├── transport-request.routes.ts
│   │   ├── vehicle.routes.ts
│   │   ├── urgency.routes.ts
│   │   ├── analytics.routes.ts
│   │   ├── organization.routes.ts
│   │   ├── health.routes.ts
│   │   ├── max.routes.ts
│   │   └── calibration-schedule.routes.ts
│   ├── middlewares/
│   │   ├── auth.middleware.ts      ← requireAuth, requireRoles, requirePermission,
│   │   │                              requireAnyPermission, requirePasswordChanged
│   │   ├── rbac.middleware.ts      ← Готовые RBAC-проверки для конкретных разделов
│   │   └── error.middleware.ts     ← Глобальный обработчик ошибок
│   ├── utils/
│   │   ├── password.ts             ← generateTemporaryPassword()
│   │   └── transliterate.ts        ← generateUsername() из ФИО
│   └── services/
│       ├── role.service.ts         ← Инициализация БД (ensureAuthTables) + права по роли
│       └── max-bot.service.ts      ← Отправка уведомлений через Bot API Max
├── sql/                            ← SQL-миграции (справочные, не применяются вручную)
├── uploads/
│   ├── documents/                  ← Загруженные файлы документов
│   └── organization/               ← Логотип и hero-изображение
└── .env
```

**Соглашения по коду:**
- Только параметризованные SQL-запросы — `$1, $2, ...`; никаких шаблонных строк
- После `pool.connect()` всегда вызывать `client.release()` (или использовать `withDbClient()`)
- Все маршруты начинаются с `/api`
- Async middleware в Express 4 оборачивается в sync wrapper + `.catch(next)`

---

## 3. База данных

### Применение схемы

Вся схема создаётся **автоматически при старте сервера** через `ensureAuthTables()` в `role.service.ts`.  
Файлы в `backend/sql/` — справочные, применять вручную не нужно.

Функция `ensureAuthTables()` вызывает:
- `ensureRolesSchema()` — создаёт таблицу `roles`, добавляет отсутствующие колонки
- `migrateUsersTable()` — создаёт таблицу `users`, добавляет новые колонки
- `upsertRoles()` — вставляет/обновляет предустановленные роли
- `ensureEmployeeTables()` — создаёт таблицы сотрудников
- `ensureJournalTables()` — создаёт таблицы модуля журналов

---

### `users` — Пользователи системы

| Колонка | Тип | Описание |
|---------|-----|---------|
| `id` | SERIAL PK | — |
| `username` | VARCHAR(100) UNIQUE NOT NULL | Логин |
| `full_name` | VARCHAR(255) NOT NULL | ФИО |
| `role` | VARCHAR(100) → `roles(value)` | Роль (FK) |
| `password_hash` | TEXT NOT NULL | Bcrypt-хеш пароля |
| `is_active` | BOOLEAN NOT NULL DEFAULT TRUE | Активен ли аккаунт |
| `auth_version` | INTEGER NOT NULL DEFAULT 0 | Версия сессии (инкрементируется при сбросе пароля) |
| `must_change_password` | BOOLEAN NOT NULL DEFAULT FALSE | Требует смены пароля при входе |
| `temporary_password_expires_at` | TIMESTAMPTZ | Срок действия временного пароля |
| `password_changed_at` | TIMESTAMPTZ | Дата последней смены пароля |
| `max_chat_id` | VARCHAR | ID чата в Max (nullable) |
| `max_link_code` | VARCHAR | Одноразовый код привязки (nullable) |
| `max_link_code_expires_at` | TIMESTAMP | Срок действия кода |
| `max_notifications_enabled` | BOOLEAN | Флаг уведомлений Max |
| `created_at` | TIMESTAMP | Дата создания |

---

### `roles` — Роли и разрешения

| Колонка | Тип | Описание |
|---------|-----|---------|
| `id` | SERIAL PK | — |
| `title` | VARCHAR(100) | Русское название роли |
| `value` | VARCHAR(100) UNIQUE | Slug (используется как FK в `users`) |
| `can_access_cabinet` | BOOLEAN | Доступ в личный кабинет |
| `can_access_admin_cabinet` | BOOLEAN | Доступ в кабинет администратора |
| `can_access_quality_cabinet` | BOOLEAN | Доступ в кабинет контроля качества |
| `can_access_cabinet_chief` | BOOLEAN | Доступ в кабинет главного врача |
| `can_manage_references` | BOOLEAN | Управление справочниками |
| `can_manage_documents` | BOOLEAN | Управление документами |
| `can_view_incidents` | BOOLEAN | Просмотр инцидентов |
| `can_view_it_requests` | BOOLEAN | Просмотр ИТ-заявок |
| `can_manage_it_requests` | BOOLEAN | Полное управление ИТ-заявками |
| `can_manage_employees` | BOOLEAN | Управление сотрудниками |
| `can_manage_own_journals` | BOOLEAN | Управление своими журналами |
| `can_manage_all_journals` | BOOLEAN | Управление всеми журналами (любого владельца) |
| `can_manage_journal_access` | BOOLEAN | Настройка допуска сотрудников к журналам |
| `is_active` | BOOLEAN | Активна ли роль |
| `created_at` | TIMESTAMP | — |

**Предустановленные роли:**

| `value` | `title` | Ключевые права |
|---------|---------|----------------|
| `administrator` | Администратор | `can_access_cabinet`, `can_access_admin_cabinet`, `can_manage_references`, `can_manage_documents`, `can_manage_employees`, `can_manage_all_journals`, `can_manage_journal_access`, `can_manage_temp_sheet` |
| `head_nurse` | Главная медсестра | `can_access_cabinet`, `can_manage_own_journals`, `can_manage_journal_access`, `can_manage_temp_sheet` (полный доступ к температурному листу + выдача доступа сотрудникам) |
| `employee` | Сотрудник | `can_access_cabinet` |
| `chief_doctor` | Главный врач | `can_access_cabinet`, `can_access_cabinet_chief` |
| `quality_department` | Контроль качества | `can_access_cabinet`, `can_access_quality_cabinet`, `can_manage_references`, `can_view_incidents` |
| `it_department` | ИТ отдел | `can_access_cabinet`, `can_manage_it_requests` |
| `facility` | АХЧ | `can_access_cabinet` |
| `metrologist` | Метролог | `can_access_cabinet` |
| `dispatcher` | Диспетчер | `can_access_cabinet` |
| `hr_department` | Отдел кадров | — |
| `planning_department` | Планово-экономический отдел | — |
| `trade_union` | Профсоюз | — |
| `epidemiologist` | Эпидемиолог | — |
| `administration` | Администрация | — |

---

### `departments` — Отделения больницы

| Колонка | Тип | Описание |
|---------|-----|---------|
| `id` | SERIAL PK | — |
| `name` | VARCHAR(255) UNIQUE NOT NULL | Название отделения |
| `care_type` | VARCHAR(50) | `'Стационар'` или `'Поликлиника'` |
| `created_at` | TIMESTAMP | — |

---

### `employee_profiles` — Профили сотрудников

| Колонка | Тип | Описание |
|---------|-----|---------|
| `id` | SERIAL PK | — |
| `user_id` | INTEGER UNIQUE → `users(id)` ON DELETE CASCADE | Пользователь |
| `employee_code` | VARCHAR(50) UNIQUE | Табельный номер (nullable) |
| `profile_version` | INTEGER NOT NULL DEFAULT 1 | Версия профиля |
| `created_at` | TIMESTAMPTZ | — |
| `updated_at` | TIMESTAMPTZ | — |

---

### `employee_departments` — Привязка сотрудника к отделениям

| Колонка | Тип | Описание |
|---------|-----|---------|
| `id` | SERIAL PK | — |
| `user_id` | INTEGER → `users(id)` ON DELETE CASCADE | Сотрудник |
| `department_id` | INTEGER → `departments(id)` ON DELETE RESTRICT | Отделение |
| `position` | VARCHAR(255) NOT NULL DEFAULT '' | Должность в отделении |
| `is_active` | BOOLEAN NOT NULL DEFAULT TRUE | Активна ли привязка |
| `dept_version` | INTEGER NOT NULL DEFAULT 1 | Версия для оптимистичных блокировок |
| `created_at` | TIMESTAMPTZ | — |
| `updated_at` | TIMESTAMPTZ | — |

Уникальный индекс: `(user_id, department_id)`.

---

### `department_journal_access` — Допуск сотрудников к журналам отделения

| Колонка | Тип | Описание |
|---------|-----|---------|
| `id` | SERIAL PK | — |
| `user_id` | INTEGER → `users(id)` ON DELETE CASCADE | Сотрудник |
| `department_id` | INTEGER → `departments(id)` ON DELETE CASCADE | Отделение |
| `granted_by` | INTEGER → `users(id)` ON DELETE SET NULL | Кто предоставил допуск |
| `is_active` | BOOLEAN NOT NULL DEFAULT TRUE | Активен ли допуск |
| `granted_at` | TIMESTAMPTZ | Дата выдачи |
| `revoked_at` | TIMESTAMPTZ | Дата отзыва (nullable) |

Уникальный индекс: `(user_id, department_id)`.

---

### `idempotency_keys` — Идемпотентность операций

| Колонка | Тип | Описание |
|---------|-----|---------|
| `id` | BIGSERIAL PK | — |
| `actor_user_id` | INTEGER → `users(id)` | Пользователь-инициатор |
| `operation` | VARCHAR(100) | Тип операции (например, `'copy_row'`, `'confirm_row'`) |
| `key` | VARCHAR(500) | Ключ идемпотентности |
| `result_id` | TEXT | ID созданного ресурса |
| `created_at` | TIMESTAMPTZ | — |

Уникальный индекс: `(actor_user_id, operation, key)`.

---

### `journals` — Электронные журналы

| Колонка | Тип | Описание |
|---------|-----|---------|
| `id` | SERIAL PK | — |
| `title` | VARCHAR(255) NOT NULL | Название журнала |
| `department_id` | INTEGER → `departments(id)` ON DELETE RESTRICT | Отделение |
| `owner_user_id` | INTEGER → `users(id)` ON DELETE RESTRICT | Владелец (главная медсестра) |
| `status` | VARCHAR(20) CHECK (`draft`, `published`, `archived`) DEFAULT `draft` | Статус |
| `version` | INTEGER NOT NULL DEFAULT 1 | Версия (оптимистичная блокировка) |
| `schema_version` | INTEGER NOT NULL DEFAULT 1 | Версия схемы колонок |
| `first_published_at` | TIMESTAMPTZ | Дата первой публикации (после — схема заморожена) |
| `created_at` | TIMESTAMPTZ | — |
| `updated_at` | TIMESTAMPTZ | — |
| `archived_at` | TIMESTAMPTZ | — |

---

### `journal_columns` — Колонки журнала

| Колонка | Тип | Описание |
|---------|-----|---------|
| `id` | UUID PK DEFAULT `gen_random_uuid()` | Стабильный идентификатор для значений строк |
| `journal_id` | INTEGER → `journals(id)` ON DELETE CASCADE | Журнал |
| `title` | VARCHAR(255) NOT NULL | Название колонки |
| `type` | VARCHAR(20) CHECK (`text`, `date`, `confirmation`) | Тип данных |
| `sort_order` | INTEGER NOT NULL DEFAULT 0 | Порядок отображения |
| `is_editable_by_employee` | BOOLEAN NOT NULL DEFAULT TRUE | Может ли сотрудник заполнять поле при подтверждении |

Уникальный индекс: `(journal_id) WHERE type = 'confirmation'` — не более одной confirmation-колонки.

**Правило `is_editable_by_employee`:**
- `TRUE` (по умолчанию) — сотрудник видит это поле как ввод в модалке подтверждения
- `FALSE` — поле только для чтения; заполняется главной медсестрой при создании строк

---

### `journal_rows` — Строки журнала (мягкое удаление)

| Колонка | Тип | Описание |
|---------|-----|---------|
| `id` | SERIAL PK | — |
| `journal_id` | INTEGER → `journals(id)` ON DELETE RESTRICT | Журнал |
| `sort_order` | INTEGER NOT NULL DEFAULT 0 | Порядок строки |
| `current_revision` | INTEGER NOT NULL DEFAULT 1 | Указатель на актуальную ревизию |
| `deleted_at` | TIMESTAMPTZ | Мягкое удаление (nullable) |
| `deleted_by` | INTEGER → `users(id)` ON DELETE SET NULL | Кто удалил |
| `deletion_reason` | TEXT | Причина удаления |
| `created_at` | TIMESTAMPTZ | — |
| `updated_at` | TIMESTAMPTZ | — |

---

### `journal_row_revisions` — Неизменяемые ревизии строк

| Колонка | Тип | Описание |
|---------|-----|---------|
| `row_id` | INTEGER → `journal_rows(id)` | Строка |
| `revision` | INTEGER | Номер ревизии |
| `values` | JSONB NOT NULL DEFAULT `{}` | Значения `{column_id: value}` |
| `schema_snapshot` | JSONB NOT NULL DEFAULT `{}` | Снимок схемы на момент создания |
| `created_by` | INTEGER → `users(id)` ON DELETE SET NULL | Кто создал ревизию |
| `created_at` | TIMESTAMPTZ | — |
| `change_reason` | TEXT | Причина изменения (для корректировок) |

PK: `(row_id, revision)`.

---

### `journal_row_confirmations` — Подтверждения строк

| Колонка | Тип | Описание |
|---------|-----|---------|
| `id` | BIGSERIAL PK | — |
| `row_id` | INTEGER → `journal_rows(id)` | Строка |
| `row_revision` | INTEGER | Ревизия, которую подтвердили (FK → `journal_row_revisions`) |
| `signer_user_id` | INTEGER → `users(id)` ON DELETE RESTRICT | Подписавший |
| `signer_full_name` | VARCHAR(255) NOT NULL | Снимок ФИО |
| `signer_position` | VARCHAR(255) | Снимок должности в отделении |
| `department_name` | VARCHAR(255) NOT NULL | Снимок названия отделения |
| `journal_title` | VARCHAR(255) NOT NULL | Снимок названия журнала |
| `confirmed_at` | TIMESTAMPTZ NOT NULL | Дата и время подтверждения |
| `method` | VARCHAR(50) DEFAULT `password_confirmation` | Метод аутентификации |
| `status` | VARCHAR(20) CHECK (`active`, `voided`) DEFAULT `active` | Статус |
| `voided_at` | TIMESTAMPTZ | Дата аннулирования |
| `voided_by` | INTEGER → `users(id)` ON DELETE SET NULL | Кто аннулировал |
| `void_reason` | TEXT | Причина аннулирования |
| `idempotency_key` | VARCHAR(255) UNIQUE | Защита от дублей |

Уникальный индекс: `(row_id) WHERE status = 'active'` — не более одного активного подтверждения.

---

### `journal_audit_events` — Аудит журналов

| Колонка | Тип | Описание |
|---------|-----|---------|
| `id` | BIGSERIAL PK | — |
| `object_type` | VARCHAR(50) | `journal`, `row`, `access`, `employee`, `import`, … |
| `object_id` | VARCHAR(100) | ID объекта |
| `action` | VARCHAR(50) | Действие (`rename`, `publish`, `archive`, `confirm`, `correction`, …) |
| `actor_id` | INTEGER → `users(id)` ON DELETE SET NULL | Кто совершил действие |
| `reason` | TEXT | Причина (для корректировок) |
| `prev_data` | JSONB | Предыдущие данные |
| `new_data` | JSONB | Новые данные |
| `created_at` | TIMESTAMPTZ | — |

---

### Прочие таблицы (без изменений)

Таблицы `announcements`, `document_folders`, `documents`, `incident_view_types`, `incident_types`, `incident_view_type_incident_types`, `incidents`, `urgency_levels`, `it_requests`, `ahch_requests`, `metrologist_requests`, `transport_requests`, `vehicles`, `organization_profile`, `calibration_schedule` — структура не изменилась. См. предыдущую версию спецификации или файлы `backend/sql/`.

---

## 4. Аутентификация и авторизация

**Аутентификация:** JWT Bearer Token в заголовке `Authorization: Bearer <token>`.

**JWT-payload (`AuthPayload`):**
```ts
{
  userId: number;
  role: string;
  authVersion: number;     // сравнивается с users.auth_version при каждом запросе
  permissions: RolePermissions;
}
```

При каждом запросе `requireAuth` дополнительно проверяет в БД:
- `users.is_active` — аккаунт не заблокирован
- `users.auth_version` — сессия не отозвана (инкрементируется при сбросе пароля)
- `users.must_change_password` — помещается в `req.user`

**Middleware-функции** (`auth.middleware.ts`):

| Функция | Описание |
|---------|---------|
| `requireAuth` | Проверяет JWT, проверяет `is_active` и `auth_version` в БД, добавляет `req.user` |
| `requirePasswordChanged` | 403 если `req.user.mustChangePassword === true` |
| `requireRoles(['role1', 'role2'])` | Проверяет `req.user.role` по списку (OR) |
| `requirePermission('flagName')` | Проверяет один булев флаг из `roles` |
| `requireAnyPermission(['f1', 'f2'])` | Хотя бы один флаг должен быть `true` |

**Временный пароль:**
- При создании сотрудника администратором генерируется временный пароль
- `must_change_password = TRUE` → пользователь при входе видит страницу смены пароля
- После смены пароля: `must_change_password = FALSE`, `auth_version += 1` (все старые сессии аннулируются)

**Привилегированные роли:**
- Регистрация через публичный `POST /api/auth/register` ограничена непривилегированными ролями
- Создание пользователей с любой ролью — только через `POST /api/users` (только для `canManageReferences`)

**RBAC-хелперы** (`rbac.middleware.ts`) — готовые проверки:
- `requireAdminForReferences` — `canManageReferences`
- `requireAdminOrQualityForDocuments` — `canManageDocuments`
- `requireQualityControlForIncidents` — `canViewIncidents`

---

## 5. REST API — полный справочник маршрутов

Базовый префикс всех маршрутов: `/api`

### Здоровье
| Метод | Путь | Доступ |
|-------|------|--------|
| GET | `/api/health` | Публичный |

### Аутентификация
| Метод | Путь | Доступ | Тело запроса |
|-------|------|--------|-------------|
| POST | `/api/auth/login` | Публичный | `{username, password}` |
| POST | `/api/auth/register` | Публичный | `{username, full_name, role, password}` |
| GET | `/api/auth/roles` | Публичный | — |
| GET | `/api/auth/me` | `requireAuth` | — |
| POST | `/api/auth/change-password` | `requireAuth` | `{currentPassword, newPassword}` |

### Пользователи
| Метод | Путь | Доступ | Описание |
|-------|------|--------|---------|
| GET | `/api/users` | `canManageReferences` | Список пользователей |
| POST | `/api/users` | `canManageReferences` | Создать пользователя с любой ролью |
| PUT | `/api/users/:id` | `canManageReferences` | Обновить пользователя |
| DELETE | `/api/users/:id` | `canManageReferences` | Удалить пользователя |

### Привязка Max-аккаунта
| Метод | Путь | Доступ |
|-------|------|--------|
| GET | `/api/users/me/max-link` | `requireAuth` |
| POST | `/api/users/me/max-link/start` | `requireAuth` |
| POST | `/api/users/me/max-link/verify` | `requireAuth` |
| DELETE | `/api/users/me/max-link` | `requireAuth` |
| PATCH | `/api/users/me/max-link/notifications` | `requireAuth` |

### Сотрудники
| Метод | Путь | Доступ | Описание |
|-------|------|--------|---------|
| GET | `/api/employees` | `canManageEmployees` | Список сотрудников с профилями и отделениями |
| POST | `/api/employees` | `canManageEmployees` | Создать сотрудника (генерирует логин и временный пароль) |
| PATCH | `/api/employees/:id` | `canManageEmployees` | Обновить профиль (отделения, должность, активность) |
| POST | `/api/employees/:id/reset-password` | `canManageEmployees` | Сброс пароля (генерирует новый временный) |
| POST | `/api/employees/import` | `canManageEmployees` | Пакетный импорт из Excel |
| GET | `/api/employees/departments` | `requireAuth` | Отделения с привязанными сотрудниками (для головной медсестры) |

### Допуск к журналам
| Метод | Путь | Доступ | Описание |
|-------|------|--------|---------|
| GET | `/api/journal-access/departments` | `canManageJournalAccess` | Список отделений с сотрудниками |
| GET | `/api/journal-access/departments/:deptId/employees` | `canManageJournalAccess` | Сотрудники отделения с флагом допуска |
| PATCH | `/api/journal-access/departments/:deptId/employees/:userId` | `canManageJournalAccess` | Выдать/отозвать допуск |

### Журналы
| Метод | Путь | Доступ | Описание |
|-------|------|--------|---------|
| GET | `/api/journals?scope=` | `requireAuth` + `requirePasswordChanged` | Список журналов (`scope`: `available`, `own`, `all`) |
| POST | `/api/journals` | `canManageOwnJournals` ИЛИ `canManageAllJournals` | Создать черновик журнала |
| GET | `/api/journals/:id` | `requireAuth` + `requirePasswordChanged` | Получить журнал с колонками |
| PATCH | `/api/journals/:id` | `canManageOwnJournals` ИЛИ `canManageAllJournals` | Переименовать журнал |
| PUT | `/api/journals/:id/columns` | `canManageOwnJournals` ИЛИ `canManageAllJournals` | Изменить колонки (только до публикации) |
| POST | `/api/journals/:id/publish` | `canManageOwnJournals` ИЛИ `canManageAllJournals` | Опубликовать журнал |
| POST | `/api/journals/:id/archive` | `canManageOwnJournals` ИЛИ `canManageAllJournals` | Архивировать журнал |
| POST | `/api/journals/:id/restore` | `canManageOwnJournals` ИЛИ `canManageAllJournals` | Восстановить из архива |

**Условия публикации:** минимум одна data-колонка, ровно одна confirmation-колонка, минимум одна строка.  
**После публикации схема колонок заморожена** (`first_published_at IS NOT NULL`).

### Строки журнала
| Метод | Путь | Доступ | Описание |
|-------|------|--------|---------|
| GET | `/api/journals/:id/rows` | `requireAuth` + `requirePasswordChanged` | Список строк с подтверждениями; пагинация `?page=&limit=` |
| POST | `/api/journals/:id/rows` | `canManageOwnJournals` ИЛИ `canManageAllJournals` | Добавить строку |
| PATCH | `/api/journals/:id/rows/:rowId` | `canManageOwnJournals` ИЛИ `canManageAllJournals` | Редактировать строку (только без активного подтверждения) |
| DELETE | `/api/journals/:id/rows/:rowId` | `canManageOwnJournals` ИЛИ `canManageAllJournals` | Мягкое удаление (нельзя удалить строку с историей подтверждений) |
| POST | `/api/journals/:id/rows/:rowId/copy` | `canManageOwnJournals` ИЛИ `canManageAllJournals` | Скопировать строку (1–365 копий, опционально сдвиг дат) |
| POST | `/api/journals/:id/rows/:rowId/confirm` | `requireAuth` + `requirePasswordChanged` | Подтвердить строку (требует пароль + опционально `editableValues`) |
| POST | `/api/journals/:id/rows/:rowId/corrections` | `canManageOwnJournals` ИЛИ `canManageAllJournals` | Корректировка подтверждённой строки (аннулирует подтверждение) |
| GET | `/api/journals/:id/rows/:rowId/history` | `canManageOwnJournals` ИЛИ `canManageAllJournals` | История ревизий и подтверждений |

**Логика `confirm` с `editableValues`:**
1. Проверяет пароль пользователя (bcrypt)
2. Если переданы `editableValues` — создаёт новую ревизию строки с обновлёнными editable-полями
3. Создаёт запись подтверждения, указывающую на актуальную ревизию
4. Поддерживает идемпотентность через `idempotencyKey`

### Объявления
| Метод | Путь | Доступ |
|-------|------|--------|
| GET | `/api/announcements` | Публичный |
| POST | `/api/announcements` | `canManageReferences` |
| PUT | `/api/announcements/:id` | `canManageReferences` |
| DELETE | `/api/announcements/:id` | `canManageReferences` |

### Отделения
| Метод | Путь | Доступ |
|-------|------|--------|
| GET | `/api/departments` | Публичный |
| POST | `/api/departments` | `canManageReferences` |
| PUT | `/api/departments/:id` | `canManageReferences` |
| DELETE | `/api/departments/:id` | `canManageReferences` |

### Уровни срочности
| Метод | Путь | Доступ |
|-------|------|--------|
| GET | `/api/urgency-levels` | Публичный |

### Нежелательные события (инциденты)
| Метод | Путь | Доступ |
|-------|------|--------|
| POST | `/api/incidents` | Публичный |
| GET | `/api/incidents` | `canViewIncidents` |
| GET | `/api/incident-types` | Публичный |
| POST | `/api/incident-types` | `canManageReferences` |
| PUT | `/api/incident-types/:id` | `canManageReferences` |
| DELETE | `/api/incident-types/:id` | `canManageReferences` |
| GET | `/api/incident-view-types` | Публичный |
| POST | `/api/incident-view-types` | `canManageReferences` |
| PUT | `/api/incident-view-types/:id` | `canManageReferences` |
| DELETE | `/api/incident-view-types/:id` | `canManageReferences` |
| GET | `/api/incident-view-types/:id/incident-types` | `canViewIncidents` |
| POST | `/api/incident-view-types/:id/incident-types` | `canManageReferences` |
| PUT | `/api/incident-view-types/:id/incident-types` | `canManageReferences` |
| DELETE | `/api/incident-view-types/:id/incident-types/:typeId` | `canManageReferences` |

### Заявки в ИТ
| Метод | Путь | Доступ |
|-------|------|--------|
| POST | `/api/it-requests` | Публичный |
| GET | `/api/it-requests/:id/public` | Публичный |
| GET | `/api/it-requests` | `canViewItRequests` ИЛИ `canManageItRequests` |
| PATCH | `/api/it-requests/:id/status` | `canViewItRequests` ИЛИ `canManageItRequests` |
| PATCH | `/api/it-requests/:id/comment` | `canManageItRequests` ИЛИ `canAccessAdminCabinet` |

### Заявки в АХЧ
| Метод | Путь | Доступ |
|-------|------|--------|
| POST | `/api/ahch-requests` | Публичный |
| GET | `/api/ahch-requests/:id/public` | Публичный |
| GET | `/api/ahch-requests` | `facility`, `administrator`, `chief_doctor` |
| PATCH | `/api/ahch-requests/:id/status` | `facility`, `administrator` |
| PATCH | `/api/ahch-requests/:id/comment` | `facility`, `administrator` |

### Заявки метрологу
| Метод | Путь | Доступ |
|-------|------|--------|
| POST | `/api/metrologist-requests` | Публичный |
| GET | `/api/metrologist-requests/:id/public` | Публичный |
| GET | `/api/metrologist-requests` | `metrologist`, `administrator`, `chief_doctor` |
| PATCH | `/api/metrologist-requests/:id/status` | `metrologist`, `administrator` |
| PATCH | `/api/metrologist-requests/:id/comment` | `metrologist`, `administrator` |

### Транспортные заявки
| Метод | Путь | Доступ |
|-------|------|--------|
| POST | `/api/transport-requests` | Публичный |
| GET | `/api/transport-requests/:id/public` | Публичный |
| GET | `/api/transport-requests` | `dispatcher`, `administrator`, `chief_doctor` |
| PATCH | `/api/transport-requests/:id/status` | `dispatcher`, `administrator` |
| PATCH | `/api/transport-requests/:id/comment` | `dispatcher`, `administrator` |
| PATCH | `/api/transport-requests/:id/vehicle` | `dispatcher` |

### Автомобили
| Метод | Путь | Доступ |
|-------|------|--------|
| GET | `/api/vehicles` | `dispatcher`, `administrator` |
| POST | `/api/vehicles` | `dispatcher`, `administrator` |
| DELETE | `/api/vehicles/:id` | `dispatcher`, `administrator` |

### Разделы документов
| Метод | Путь | Доступ |
|-------|------|--------|
| GET | `/api/document-folders` | Публичный |
| POST | `/api/document-folders` | `canManageDocuments` |
| PUT | `/api/document-folders/:id` | `canManageDocuments` |
| DELETE | `/api/document-folders/:id` | `canManageDocuments` |

### Документы
| Метод | Путь | Доступ | Формат |
|-------|------|--------|--------|
| GET | `/api/documents` | Публичный | — |
| POST | `/api/documents` | `canManageDocuments` | `multipart/form-data` |
| PUT | `/api/documents/:id` | `canManageDocuments` | `multipart/form-data` |
| DELETE | `/api/documents/:id` | `canManageDocuments` | — |

### Профиль организации
| Метод | Путь | Доступ |
|-------|------|--------|
| GET | `/api/organization` | Публичный |
| POST | `/api/organization/logo` | `canManageReferences` |
| DELETE | `/api/organization/logo` | `canManageReferences` |
| POST | `/api/organization/hero` | `canManageReferences` |
| DELETE | `/api/organization/hero` | `canManageReferences` |

### Аналитика
| Метод | Путь | Доступ |
|-------|------|--------|
| GET | `/api/analytics/requests` | `canAccessAdminCabinet` ИЛИ `canAccessCabinetChief` |

### График поверок МКС и ПИ

> ⚠️ Порядок регистрации маршрутов важен: `/all` должен быть зарегистрирован **до** `/:id`

| Метод | Путь | Доступ | Описание |
|-------|------|--------|---------|
| GET | `/api/calibration-schedule` | Публичный | Список всех записей |
| POST | `/api/calibration-schedule` | `metrologist`, `administrator` | Добавить одну запись |
| POST | `/api/calibration-schedule/import` | `metrologist`, `administrator` | Пакетный импорт `{items: [...]}` |
| PUT | `/api/calibration-schedule/:id` | `metrologist`, `administrator` | Редактировать запись |
| DELETE | `/api/calibration-schedule/all` | `metrologist`, `administrator` | Удалить все записи |
| DELETE | `/api/calibration-schedule/:id` | `metrologist`, `administrator` | Удалить одну запись |

---

## 6. Загрузка файлов

Файлы хранятся на диске в `backend/uploads/` и отдаются через Express как статика:

```
GET /uploads/documents/filename.pdf
GET /uploads/organization/logo.png
```

| Маршрут | Папка | Ограничения |
|---------|-------|------------|
| `POST /api/documents` | `uploads/documents/` | Любой тип |
| `POST /api/organization/logo` | `uploads/organization/` | JPEG, PNG, WebP, SVG; max 5 МБ |
| `POST /api/organization/hero` | `uploads/organization/` | JPEG, PNG, WebP, SVG; max 5 МБ |

Имя файла на диске: `{timestamp}_{random6chars}{ext}` (документы) или `{timestamp}{ext}` (организация).

---

## 7. Уведомления Max

Сервис `max-bot.service.ts` отправляет POST-запрос на `https://platform-api.max.ru/messages`.

**Flow привязки аккаунта:**
1. Пользователь получает свой Max ID через бота командой `CHECK ID`
2. Вводит ID в кабинете → сервер генерирует одноразовый код (TTL 10 мин) и отправляет его в Max
3. Пользователь вводит код в кабинете → `max_chat_id` сохраняется в `users`

**Уведомляемые события:**

| Событие | Роль-получатель |
|---------|----------------|
| Новая ИТ-заявка / смена статуса | `it_department` |
| Новая заявка метрологу / смена статуса | `metrologist` |
| Новая АХЧ-заявка / смена статуса | `facility` |
| Новая транспортная заявка / смена статуса | `dispatcher` |
| Новый инцидент | `quality_department` |

Уведомление получают все пользователи нужной роли, у которых `max_chat_id IS NOT NULL` и `max_notifications_enabled = TRUE`.

---

## 8. Переменные окружения

Файл `backend/.env`:

```env
PORT=4000
DB_USER=postgres
DB_HOST=localhost
DB_NAME=medportal
DB_PASSWORD=...
DB_PORT=5432
JWT_SECRET=...
JWT_EXPIRES_IN=1d
MAX_BOT_TOKEN=...
CORS_ORIGIN=https://your-domain.ru
JOURNAL_COPY_MAX_ROWS=365   # максимум копий за раз (по умолчанию 365)
```

---

## 8a. Модуль «Температурный лист» (миграция 028)

### Таблицы

- `patients` — карточки детей (ФИО, дата рождения). Отдельной исторической базы пациентов в портале не было; сущность добавлена для модуля.
- `temperature_sheets` — один лист на пару `(patient_id, department_id)`; поле `height_cm` хранится на листе и не меняет карточку пациента.
- `temperature_sheet_columns` — позиции 1–15; `temperature_band` ∈ `{above41,40_409,…,below35}` или NULL; без истории/версий.
- `temp_sheet_user_access` — выдача доступа сотрудникам (`is_active`).
- `roles.can_manage_temp_sheet` — роль-уровневый доступ менеджера модуля.

### API (`/api/temp-sheets…`)

| Метод | Путь | Кто | Назначение |
|-------|------|-----|------------|
| GET | `/temp-sheets/my-access` | auth | hasAccess / canEdit / canManageAccess |
| GET | `/temp-sheets/departments` | модуль | отделения в области доступа |
| GET/POST | `/temp-sheets/patients` | модуль / редактор | поиск / создание ребёнка |
| GET/POST | `/temp-sheets` | модуль / редактор | список / create-or-get |
| GET | `/temp-sheets/:id` | модуль | лист + 15 колонок |
| PATCH | `/temp-sheets/:id/header` | редактор | рост |
| PATCH | `/temp-sheets/:id/columns/:col` | редактор | частичное обновление полей |
| DELETE | `/temp-sheets/:id/columns/:col` | редактор | очистка колонки |
| DELETE | `/temp-sheets/:id/columns` | редактор | очистка всех 15 колонок |
| GET/PUT | `/temp-sheets/module-access` | canManageTempSheet | выдача/отзыв доступа |

**Права:** главная медсестра/админ (`can_manage_temp_sheet`) — полный доступ ко всем листам (просмотр, создание, заполнение, очистка, выгрузка) и управление доступом сотрудников. Сотрудники с `temp_sheet_user_access.is_active` — только в своих `employee_departments`. История заполнений не ведётся. PDF/Excel формируются на клиенте после авторизованного GET.

### SQL

Файл: `backend/sql/028_temperature_sheet.sql`. При старте сервера таблицы создаёт `ensureTempSheetTables()`.

---

## 9. Запуск и деплой

### Dev

```bash
cd backend
npm install
npm run dev      # ts-node-dev, hot reload
```

### Production

```bash
cd backend
npm run build    # компиляция TypeScript → dist/
node dist/server.js
# или через pm2:
pm2 start dist/server.js --name medportal-backend
```

### Схема БД

Схема создаётся автоматически при первом запуске сервера — `ensureAuthTables()` создаёт все таблицы и добавляет отсутствующие колонки. Вручную применять SQL-файлы не нужно.

### nginx (проксирование API и статики)

```nginx
location /api {
    proxy_pass http://localhost:4000;
}
location /uploads {
    proxy_pass http://localhost:4000;
}
```
