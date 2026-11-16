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
│   │   ├── auth.middleware.ts      ← requireAuth, requireRoles, requirePermission, requireAnyPermission
│   │   ├── rbac.middleware.ts      ← Готовые RBAC-проверки для конкретных разделов
│   │   └── error.middleware.ts     ← Глобальный обработчик ошибок
│   └── services/
│       ├── role.service.ts         ← Инициализация и получение прав по роли
│       └── max-bot.service.ts      ← Отправка уведомлений через Bot API Max
├── sql/                            ← SQL-миграции (023 файла, пронумерованные)
├── uploads/
│   ├── documents/                  ← Загруженные файлы документов
│   └── organization/               ← Логотип и hero-изображение
└── .env
```

**Соглашения по коду:**
- Только параметризованные SQL-запросы — `$1, $2, ...`; никаких шаблонных строк
- После `pool.connect()` всегда вызывать `client.release()` (или использовать `withDbClient()`)
- Все маршруты начинаются с `/api`

---

## 3. База данных

### Применение миграций

```bash
psql -U postgres -d medportal -f backend/sql/001_create_users.sql
# ... повторить для каждого файла по порядку до 023
```

Новые изменения схемы — отдельным пронумерованным файлом.

---

### `users` — Пользователи системы

| Колонка | Тип | Описание |
|---------|-----|---------|
| `id` | SERIAL PK | — |
| `username` | VARCHAR(100) UNIQUE NOT NULL | Логин |
| `full_name` | VARCHAR(255) NOT NULL | ФИО |
| `role` | VARCHAR(100) → `roles(value)` | Роль (FK) |
| `password_hash` | TEXT NOT NULL | Bcrypt-хеш пароля |
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
| `is_active` | BOOLEAN | Активна ли роль |
| `created_at` | TIMESTAMP | — |

**Предустановленные роли:**

| `value` | `title` |
|---------|---------|
| `administrator` | Администратор |
| `chief_doctor` | Главный врач |
| `quality_department` | Контроль качества (Отдел качества) |
| `it_department` | ИТ отдел |
| `facility` | АХЧ |
| `metrologist` | Метролог |
| `dispatcher` | Диспетчер |
| `employee` | Сотрудник |
| `hr_department` | Отдел кадров |
| `planning_department` | Планово-экономический отдел |
| `trade_union` | Профсоюз |
| `epidemiologist` | Эпидемиолог |
| `administration` | Администрация |

---

### `departments` — Отделения больницы

| Колонка | Тип | Описание |
|---------|-----|---------|
| `id` | SERIAL PK | — |
| `name` | VARCHAR(255) UNIQUE NOT NULL | Название отделения |
| `care_type` | VARCHAR(50) | `'Стационар'` или `'Поликлиника'` |
| `created_at` | TIMESTAMP | — |

---

### `announcements` — Объявления

| Колонка | Тип | Описание |
|---------|-----|---------|
| `id` | SERIAL PK | — |
| `title` | VARCHAR(255) NOT NULL | Заголовок |
| `description` | TEXT NOT NULL | Краткое описание |
| `full_description` | TEXT | Полный текст |
| `image_url` | TEXT | Путь к изображению |
| `published_date` | DATE NOT NULL | Дата публикации |
| `created_at` | TIMESTAMP | — |
| `updated_at` | TIMESTAMP | — |

---

### `document_folders` — Разделы документов

| Колонка | Тип | Описание |
|---------|-----|---------|
| `id` | SERIAL PK | — |
| `name` | VARCHAR(255) NOT NULL | Название раздела |
| `parent_id` | INTEGER → `document_folders(id)` ON DELETE CASCADE | Родительский раздел (nullable) |
| `sort_order` | INTEGER NOT NULL DEFAULT 0 | Порядок сортировки |
| `created_at` | TIMESTAMP | — |

---

### `documents` — Файлы документов

| Колонка | Тип | Описание |
|---------|-----|---------|
| `id` | SERIAL PK | — |
| `folder_id` | INTEGER → `document_folders(id)` ON DELETE SET NULL | Раздел (nullable) |
| `title` | VARCHAR(255) NOT NULL | Название |
| `description` | TEXT | Описание |
| `file_url` | TEXT NOT NULL | Путь к файлу на диске |
| `original_filename` | VARCHAR(500) | Оригинальное имя файла |
| `sort_order` | INTEGER NOT NULL DEFAULT 0 | Порядок |
| `created_at` | TIMESTAMP | — |
| `updated_at` | TIMESTAMP | — |

---

### `incident_view_types` — Виды нежелательных событий

| Колонка | Тип | Описание |
|---------|-----|---------|
| `id` | SERIAL PK | — |
| `name` | VARCHAR(255) UNIQUE NOT NULL | Название вида |
| `care_type` | VARCHAR(50) NOT NULL | `'Стационар'` или `'Поликлиника'` |
| `created_at` | TIMESTAMP | — |

---

### `incident_types` — Типы нежелательных событий

| Колонка | Тип | Описание |
|---------|-----|---------|
| `id` | SERIAL PK | — |
| `name` | VARCHAR(255) UNIQUE NOT NULL | Название типа |
| `created_at` | TIMESTAMP | — |

---

### `incident_view_type_incident_types` — M:M связь видов и типов

| Колонка | Тип |
|---------|-----|
| `incident_view_type_id` | INTEGER → `incident_view_types(id)` ON DELETE CASCADE |
| `incident_type_id` | INTEGER → `incident_types(id)` ON DELETE CASCADE |
| PK | `(incident_view_type_id, incident_type_id)` |

---

### `incidents` — Нежелательные события (инциденты)

| Колонка | Тип | Описание |
|---------|-----|---------|
| `id` | SERIAL PK | — |
| `incident_date` | DATE NOT NULL | Дата события |
| `incident_time` | TIME NOT NULL | Время события |
| `place` | VARCHAR(255) | Место |
| `patient_fio` | VARCHAR(255) NOT NULL | ФИО пациента |
| `patient_birth_date` | DATE NOT NULL | Дата рождения пациента |
| `circumstances` | TEXT NOT NULL | Обстоятельства |
| `employee_fio` | VARCHAR(255) NOT NULL | ФИО сотрудника |
| `employee_position` | VARCHAR(255) NOT NULL | Должность |
| `legal_presence` | VARCHAR(100) NOT NULL | Юридическое присутствие |
| `department_id` | INTEGER → `departments(id)` ON DELETE RESTRICT | Отделение |
| `incident_view_type_id` | INTEGER → `incident_view_types(id)` ON DELETE SET NULL | Вид события |
| `incident_type_id` | INTEGER → `incident_types(id)` ON DELETE RESTRICT | Тип события |
| `consequences` | TEXT NOT NULL | Последствия |
| `severity_level` | VARCHAR(20) | Степень тяжести |
| `status` | VARCHAR(50) DEFAULT `'new'` | Статус |
| `created_at` | TIMESTAMP | — |

---

### `urgency_levels` — Уровни срочности заявок

| Колонка | Тип | Описание |
|---------|-----|---------|
| `id` | SERIAL PK | — |
| `name` | VARCHAR(50) NOT NULL | Название («1 день», «Неделя», …) |
| `days` | INTEGER NOT NULL | Количество дней на выполнение |

Предустановленные значения: 1 день, 2 дня, 3 дня, Неделя (7), Две недели (14), Месяц (30).

---

### `it_requests` — Заявки в ИТ

| Колонка | Тип | Описание |
|---------|-----|---------|
| `id` | SERIAL PK | — |
| `full_name` | VARCHAR(255) NOT NULL | ФИО заявителя |
| `phone` | VARCHAR(50) NOT NULL | Телефон |
| `department` | VARCHAR(255) NOT NULL | Отделение (свободный текст) |
| `location` | VARCHAR(255) NOT NULL | Кабинет/место |
| `request_text` | TEXT NOT NULL | Текст заявки |
| `remote_access_id` | VARCHAR(100) | ID удалённого доступа |
| `urgency_id` | INTEGER → `urgency_levels(id)` | Срочность |
| `status` | VARCHAR(50) DEFAULT `'new'` | Статус |
| `comment` | TEXT | Комментарий исполнителя |
| `created_at` | TIMESTAMP | — |

---

### `ahch_requests` — Заявки в АХЧ

| Колонка | Тип | Описание |
|---------|-----|---------|
| `id` | SERIAL PK | — |
| `address` | VARCHAR(500) NOT NULL | Адрес/место |
| `department` | VARCHAR(255) NOT NULL | Отделение (свободный текст) |
| `request_text` | TEXT NOT NULL | Текст заявки |
| `employee_phone` | VARCHAR(50) NOT NULL | Телефон |
| `urgency_id` | INTEGER → `urgency_levels(id)` | Срочность |
| `status` | VARCHAR(50) DEFAULT `'new'` | Статус |
| `comment` | TEXT | Комментарий |
| `created_at` | TIMESTAMP | — |

---

### `metrologist_requests` — Заявки метрологу

| Колонка | Тип | Описание |
|---------|-----|---------|
| `id` | SERIAL PK | — |
| `full_name` | VARCHAR(255) NOT NULL | ФИО заявителя |
| `phone` | VARCHAR(50) NOT NULL | Телефон |
| `department` | VARCHAR(255) NOT NULL | Отделение |
| `location` | VARCHAR(255) NOT NULL | Место |
| `request_text` | TEXT NOT NULL | Текст заявки |
| `status` | VARCHAR(50) DEFAULT `'new'` | Статус |
| `comment` | TEXT | Комментарий |
| `created_at` | TIMESTAMP | — |

---

### `transport_requests` — Транспортные заявки

| Колонка | Тип | Описание |
|---------|-----|---------|
| `id` | SERIAL PK | — |
| `department` | VARCHAR(255) NOT NULL | Отделение |
| `initiator` | VARCHAR(255) NOT NULL | Инициатор |
| `position` | VARCHAR(255) | Должность |
| `phone` | VARCHAR(50) | Телефон |
| `submission_date` | DATE NOT NULL | Дата подачи |
| `submission_time` | TIME NOT NULL | Время подачи |
| `route_from` | VARCHAR(255) NOT NULL | Откуда |
| `route_to` | VARCHAR(255) NOT NULL | Куда |
| `purpose` | TEXT NOT NULL | Цель |
| `passenger_count` | INTEGER NOT NULL | Число пассажиров |
| `special_notes` | TEXT | Особые пожелания |
| `vehicle_id` | INTEGER → `vehicles(id)` | Назначенный автомобиль |
| `status` | VARCHAR(50) DEFAULT `'new'` | Статус |
| `comment` | TEXT | Комментарий |
| `created_at` | TIMESTAMP | — |

---

### `vehicles` — Автомобили

| Колонка | Тип | Описание |
|---------|-----|---------|
| `id` | SERIAL PK | — |
| `make` | VARCHAR NOT NULL | Марка |
| `model` | VARCHAR NOT NULL | Модель |
| `license_plate` | VARCHAR NOT NULL | Гос. номер |
| `driver` | VARCHAR | Водитель |
| `created_at` | TIMESTAMP | — |

---

### `organization_profile` — Профиль организации

Singleton-таблица (всегда одна строка, `id = 1`).

| Колонка | Тип | Описание |
|---------|-----|---------|
| `id` | INTEGER PK DEFAULT 1 | Всегда `1` |
| `logo_url` | TEXT | Путь к логотипу |
| `hero_image_url` | TEXT | Путь к hero-изображению |
| `updated_at` | TIMESTAMP | — |

---

### `calibration_schedule` — График поверок МКС и ПИ

| Колонка | Тип | Описание |
|---------|-----|---------|
| `id` | SERIAL PK | — |
| `commissioning_date` | DATE | Дата ввода в эксплуатацию |
| `nomenclature` | TEXT NOT NULL | Номенклатура (наименование) прибора |
| `name` | TEXT | Дополнительное название |
| `type` | TEXT | Тип прибора |
| `inventory_number` | TEXT | Инвентарный номер |
| `serial_number` | TEXT | Заводской номер |
| `manufacture_date` | DATE | Дата выпуска |
| `department_id` | INTEGER → `departments(id)` ON DELETE SET NULL | Отделение |
| `quantity` | INTEGER | Количество |
| `verification_kind` | TEXT | Поверка / МКС / ПИ |
| `current_verification_date` | DATE | Дата действующей поверки |
| `next_verification_date` | DATE | Дата следующей поверки |
| `note` | TEXT | Примечание |
| `created_at` | TIMESTAMP | — |

Индексы: `department_id`, `next_verification_date`.

---

## 4. Аутентификация и авторизация

**Аутентификация:** JWT Bearer Token в заголовке `Authorization: Bearer <token>`.

**Middleware-функции** (`auth.middleware.ts`):

| Функция | Описание |
|---------|---------|
| `requireAuth` | Проверяет валидность JWT, добавляет `req.user` |
| `requireRoles(['role1', 'role2'])` | Проверяет `req.user.role` по списку (OR) |
| `requirePermission('flagName')` | Проверяет один булев флаг из `roles` |
| `requireAnyPermission(['f1', 'f2'])` | Хотя бы один флаг должен быть `true` |

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

### Пользователи
| Метод | Путь | Доступ |
|-------|------|--------|
| GET | `/api/users` | `canManageReferences` |
| PUT | `/api/users/:id` | `canManageReferences` |
| DELETE | `/api/users/:id` | `canManageReferences` |

### Привязка Max-аккаунта
| Метод | Путь | Доступ |
|-------|------|--------|
| GET | `/api/users/me/max-link` | `requireAuth` |
| POST | `/api/users/me/max-link/start` | `requireAuth` |
| POST | `/api/users/me/max-link/verify` | `requireAuth` |
| DELETE | `/api/users/me/max-link` | `requireAuth` |
| PATCH | `/api/users/me/max-link/notifications` | `requireAuth` |

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
```

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

### Применение миграций

```bash
psql -U postgres -d medportal -f backend/sql/001_create_users.sql
psql -U postgres -d medportal -f backend/sql/002_create_announcements.sql
# ... до 023_calibration_schedule.sql
```

### nginx (проксирование API и статики)

```nginx
location /api {
    proxy_pass http://localhost:4000;
}
location /uploads {
    proxy_pass http://localhost:4000;
}
```
