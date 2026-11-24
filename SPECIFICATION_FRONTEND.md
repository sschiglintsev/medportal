# Спецификация Frontend — medPortal

Внутренний веб-портал ГБУЗ РБ ГДКБ №17 (г. Уфа).

---

## Содержание

1. [Технологический стек](#1-технологический-стек)
2. [Структура проекта](#2-структура-проекта)
3. [Роутинг](#3-роутинг)
4. [Публичная часть (промо-сайт)](#4-публичная-часть-промо-сайт)
5. [Личные кабинеты](#5-личные-кабинеты)
6. [Компоненты](#6-компоненты)
7. [Сервисы API](#7-сервисы-api)
8. [TypeScript-типы](#8-typescript-типы)
9. [Глобальное состояние Zustand](#9-глобальное-состояние-zustand)
10. [Утилиты](#10-утилиты)
11. [Стили](#11-стили)
12. [Переменные окружения](#12-переменные-окружения)
13. [Сборка и деплой](#13-сборка-и-деплой)

---

## 1. Технологический стек

| Пакет | Версия | Назначение |
|-------|--------|-----------|
| `react` + `react-dom` | 18 | UI-фреймворк |
| `typescript` | 5 | Статическая типизация |
| `vite` | 5 | Сборщик |
| `antd` | 5 | UI-компоненты (Ant Design) |
| `@ant-design/icons` | — | Иконки |
| `zustand` | 4 | Глобальное состояние |
| `axios` | — | HTTP-клиент |
| `react-router-dom` | 7 | Клиентский роутинг |
| `dayjs` | — | Даты (используется Ant Design DatePicker) |
| `xlsx` | — | Импорт и экспорт Excel |
| `jspdf` + `html2canvas` | — | Скачивание PDF температурного листа (A4 landscape) |
| `chart.js` + `react-chartjs-2` | — | Графики на странице аналитики |
| `sass` | — | SCSS-препроцессор |

---

## 2. Структура проекта

```
frontend/src/
├── App.tsx                          ← Корневой компонент: выбор кабинета по роли,
│                                       роутинг, gate смены пароля
├── main.tsx                         ← Точка входа: BrowserRouter, Ant Design ConfigProvider
│
├── Core/
│   ├── api/
│   │   └── http.ts                  ← Настроенный Axios instance (baseURL, Authorization)
│   ├── types/
│   │   └── common.ts                ← Все TypeScript-типы проекта
│   ├── services/                    ← Функции вызова API (по одному файлу на модуль)
│   │   ├── auth.service.ts
│   │   ├── announcement.service.ts
│   │   ├── document.service.ts
│   │   ├── document-folder.service.ts
│   │   ├── departments.service.ts
│   │   ├── incidents.service.ts
│   │   ├── it-request.service.ts
│   │   ├── ahch-request.service.ts
│   │   ├── metrologist-request.service.ts
│   │   ├── transport-request.service.ts
│   │   ├── vehicle.service.ts
│   │   ├── urgency.service.ts
│   │   ├── analytics.service.ts
│   │   ├── organization.service.ts
│   │   ├── user.service.ts
│   │   ├── employee.service.ts          ← Управление сотрудниками
│   │   ├── journal-access.service.ts    ← Допуск к журналам
│   │   ├── journal.service.ts           ← Журналы, строки, подтверждения
│   │   ├── max.service.ts
│   │   └── calibration-schedule.service.ts
│   ├── store/
│   │   └── app.store.ts             ← Zustand-стор
│   ├── utils/
│   │   ├── parseCalibrationExcel.ts ← Парсинг Excel для импорта графика поверок
│   │   ├── calibrationSchedule.view.ts ← Сортировка и фильтрация графика поверок
│   │   ├── parseEmployeesExcel.ts   ← Парсинг Excel для импорта сотрудников
│   │   └── exportEmployeeCredentials.ts ← Экспорт логинов и паролей в Excel
│   ├── hooks/                       ← Кастомные React-хуки
│   ├── cabinetAccess.ts             ← Утилита userHasCabinetAccess()
│   └── date.utils.ts                ← formatDate, formatDateTime, formatTime
│
├── pages/
│   ├── Promo/
│   │   ├── PromoPage.tsx            ← Главная страница
│   │   ├── PromoPage.scss
│   │   ├── DocumentsPage.tsx        ← /documents: документы + график поверок
│   │   └── DocumentsPage.scss
│   ├── AdminCabinetPage.tsx         ← Кабинет администратора
│   ├── MetrologistCabinetPage.tsx
│   ├── FacilityCabinetPage.tsx
│   ├── ItDepartmentCabinetPage.tsx
│   ├── QualityControlCabinetPage.tsx
│   ├── ChiefCabinetPage.tsx
│   ├── DispatcherCabinetPage.tsx
│   ├── EmployeeCabinetPage.tsx      ← Кабинет сотрудника
│   ├── EmployeeCabinetPage.scss
│   ├── HeadNurseCabinetPage.tsx     ← Кабинет главной медсестры
│   ├── HeadNurseCabinetPage.scss
│   ├── TempSheetsPage.tsx           ← Температурный лист (список/просмотр)
│   ├── TempSheetEditorPage.tsx      ← Заполнение таблицы
│   ├── TempSheetAccessPage.tsx      ← Выдача доступа сотрудникам
│   ├── TempSheetsPage.scss
│   ├── ChangePasswordPage.tsx       ← Экран обязательной смены пароля
│   ├── ChangePasswordPage.scss
│   ├── CalibrationSchedulePage.tsx  ← График поверок (кабинет метролога и админа)
│   ├── CalibrationSchedulePage.scss
│   ├── AdminDepartmentsPage.tsx
│   ├── AdminAnnouncementsPage.tsx
│   ├── AdminDocumentsPage.tsx
│   ├── AdminItRequestsPage.tsx
│   ├── AdminAhchRequestsPage.tsx
│   ├── AdminMetrologistRequestsPage.tsx
│   ├── AdminTransportRequestsPage.tsx
│   ├── AdminVehiclesPage.tsx
│   ├── AdminUsersPage.tsx
│   ├── AdminUsersPage.scss
│   ├── AdminEmployeesPage.tsx       ← Управление сотрудниками
│   ├── AdminEmployeesPage.scss
│   ├── AdminOrganizationPage.tsx
│   ├── AdminIncidentTypesPage.tsx
│   ├── AdminReferenceIncidentTypesPage.tsx
│   ├── AnalyticsPage.tsx
│   ├── EmployeeJournalsPage.tsx     ← Просмотр и подтверждение строк журналов
│   ├── EmployeeJournalsPage.scss
│   ├── ManagedJournalsPage.tsx      ← Управление журналами (главная медсестра / админ)
│   ├── ManagedJournalsPage.scss
│   ├── DepartmentJournalAccessPage.tsx ← Настройка допуска сотрудников к журналам
│   └── DepartmentJournalAccessPage.scss
│
├── components/
│   ├── Header/
│   ├── Footer/
│   ├── HeroSection/
│   ├── NewsSection/
│   ├── DocumentsSection/
│   ├── IncidentReportModal/
│   ├── ItRequestModal/
│   ├── AhchRequestModal/
│   ├── MetrologistRequestModal/
│   ├── TransportRequestModal/
│   ├── IncidentsRegistryPanel/
│   └── MaxLinkCard/
│
├── layouts/
│   └── MainLayout.tsx               ← Лейаут кабинета: sidebar Menu + content area
│
└── styles/
    ├── variables.scss               ← Переменные: цвета, размеры, радиусы, тени
    ├── reset.scss
    └── global.scss
```

**Соглашение по SCSS:** у каждого компонента/страницы рядом лежит `.scss`-файл (не `.module.scss`).

---

## 3. Роутинг

Роутинг описан в `App.tsx` и `react-router-dom`.

| Путь | Компонент | Описание |
|------|-----------|---------|
| `/` | `PromoPage` | Главная промо-страница |
| `/documents` | `DocumentsPage` | Документы + график поверок |
| `/cabinet` | Кабинет по роли | Личный кабинет (выбирается по `user.role`) |

**Gate смены пароля** — приоритет над всем: если `user.mustChangePassword === true`, рендерится `ChangePasswordPage` независимо от роли и маршрута.

**Выбор кабинета по роли** (`App.tsx`):

| `user.role` | Кабинет |
|-------------|---------|
| `administrator` | `AdminCabinetPage` |
| `head_nurse` | `HeadNurseCabinetPage` |
| `employee` | `EmployeeCabinetPage` |
| `metrologist` | `MetrologistCabinetPage` |
| `facility` | `FacilityCabinetPage` |
| `it_department` | `ItDepartmentCabinetPage` |
| `quality_department` | `QualityControlCabinetPage` |
| `chief_doctor` | `ChiefCabinetPage` |
| `dispatcher` | `DispatcherCabinetPage` |
| Любая роль с `canAccessCabinet` | `EmployeeCabinetPage` |

Переключение между промо и кабинетом управляется полем `portalView` в Zustand-сторе.

---

## 4. Публичная часть (промо-сайт)

### PromoPage

Главная страница. Секции:
- `HeroSection` — hero-изображение, лого, название организации, кнопки действий
- `NewsSection` — список объявлений
- `DocumentsSection` — последние документы

**Кнопки заявок** (открывают модальные окна):
- Нежелательное событие → `IncidentReportModal`
- Заявка в ИТ → `ItRequestModal`
- Заявка в АХЧ → `AhchRequestModal`
- Заявка метрологу → `MetrologistRequestModal`
- Транспортная заявка → `TransportRequestModal`

После отправки заявки пользователю показывается ID заявки для отслеживания статуса.

**Статус заявки** — выпадающий список в шапке, позволяет проверить статус по ID без авторизации.

---

### DocumentsPage (`/documents`)

Два таба (Ant Design `Tabs`):

**Таб 1 — Документы**
- Дерево разделов (`document_folders`) в сайдбаре
- Список файлов выбранного раздела

**Таб 2 — График поверок МКС и ПИ**
- Таблица `CalibrationSchedulePublicTable`
- Фильтр по отделению (Select)
- Сортировка по полям
- `tableLayout="fixed"`, без горизонтального скролла

---

## 5. Личные кабинеты

Все кабинеты используют `MainLayout` — боковое меню + контентная область.  
Каждый раздел — отдельный компонент-страница, рендерится через `switch` по активному пункту меню.

---

### ChangePasswordPage — Смена пароля

Показывается вместо любого кабинета, если `user.mustChangePassword === true`.

- Поле «Текущий пароль» и «Новый пароль» (повтор)
- Вызов `POST /api/auth/change-password`
- После успеха обновляет токен в сторе и снимает флаг `mustChangePassword`

---

### EmployeeCabinetPage — Кабинет сотрудника

| Раздел | Компонент | Описание |
|--------|-----------|---------|
| Журналы | `EmployeeJournalsPage` | Просмотр и подтверждение строк |

---

### HeadNurseCabinetPage — Кабинет главной медсестры

| Раздел | Компонент | Описание |
|--------|-----------|---------|
| Журналы | `ManagedJournalsPage` | Создание и управление журналами |
| Допуск | `DepartmentJournalAccessPage` | Выдача/отзыв допуска сотрудникам |

---

### AdminCabinetPage — Кабинет администратора

| Раздел | Компонент | Описание |
|--------|-----------|---------|
| Отделения | `AdminDepartmentsPage` | CRUD отделений |
| Виды НС | `AdminReferenceIncidentTypesPage` | Виды и типы инцидентов |
| Объявления | `AdminAnnouncementsPage` | CRUD объявлений |
| Документы | `AdminDocumentsPage` | CRUD разделов и файлов |
| ИТ-заявки | `AdminItRequestsPage` | Список + смена статуса + комментарий |
| Заявки метрологу | `AdminMetrologistRequestsPage` | Список + смена статуса |
| АХЧ-заявки | `AdminAhchRequestsPage` | Список + смена статуса |
| Транспорт | `AdminTransportRequestsPage` | Список + назначение авто |
| Автомобили | `AdminVehiclesPage` | CRUD автомобилей |
| График поверок | `CalibrationSchedulePage` | Полный режим (все колонки) |
| Инциденты | `IncidentsRegistryPanel` | Реестр нежелательных событий |
| Аналитика | `AnalyticsPage` | Графики по заявкам |
| Пользователи | `AdminUsersPage` | CRUD пользователей + создание с любой ролью |
| Сотрудники | `AdminEmployeesPage` | Управление сотрудниками |
| Профиль организации | `AdminOrganizationPage` | Загрузка лого и hero |

---

### AdminUsersPage — Пользователи

- Таблица всех пользователей: ФИО, логин, роль, дата создания
- **Создать пользователя** (кнопка + модальное окно): ФИО, логин, роль (все роли, без ограничений), пароль
- Блокировка / разблокировка аккаунта
- Удаление пользователя

---

### AdminEmployeesPage — Сотрудники

- Таблица сотрудников с колонками: ФИО, логин, роль, отделения/должности, статус (активен / заблокирован), `must_change_password`
- **Создать вручную** — форма: ФИО, отделение, должность; логин и временный пароль генерируются автоматически
- **Импорт из Excel** — двухшаговый визард:
  1. Загрузить файл → предпросмотр распознанных сотрудников
  2. Нажать «Импортировать» → создаёт аккаунты, возвращает логины/пароли
- **Экспортировать учётные данные** — скачать xlsx с логинами и временными паролями после импорта
- **Сбросить пароль** — генерирует новый временный пароль
- **Заблокировать / разблокировать** аккаунт
- Список отделений загружается напрямую через `fetchDepartments()` (не из Zustand-стора)

---

### ManagedJournalsPage — Журналы (главная медсестра / администратор)

Компонент объединяет три режима: список журналов, `JournalViewer` (просмотр), `JournalEditor` (редактирование).

#### Список журналов

- Таблица: Название, Отделение, Статус (Черновик / Опубликован / Архив), кол-во строк
- Кнопка **«Просмотр»** (👁) — только для опубликованных и архивных журналов → открывает `JournalViewer`
- Кнопка **«Редактировать»** → открывает `JournalEditor`
- Кнопка **«Опубликовать»** — для черновиков
- Кнопки **«В архив»** / **«Восстановить»**
- Кнопка **«Создать журнал»** → модальное окно: название + отделение

#### JournalViewer — read-only просмотр

- Шапка: «← Назад», название, статус, счётчик **«Подписано: X / Y»**, **«Экспорт в Excel»**
- Таблица: все data-колонки + колонка «Подтверждение»
  - Подписано: зелёный тег `✓ Подписано` + ФИО подписавшего + должность + дата/время
  - Не подписано: серый тег
- Подписанные строки подсвечены светло-зелёным фоном
- Нет кнопок редактирования

#### JournalEditor — редактор журнала

**Раздел «Колонки»** (только для черновиков):

- Список колонок: номер, название (Input), тип (Select: Текст / Дата / Подтверждение)
- Для `text` и `date` колонок — переключатель **«Вводит медсестра» / «Только просмотр»** (`is_editable_by_employee`)
  - `Вводит медсестра` (включён) — сотрудник заполняет поле в модалке подтверждения
  - `Только просмотр` (выключен) — поле read-only для сотрудника
- Кнопки: **«Добавить колонку»**, **«Загрузить из Excel»** (импортирует заголовки из первой строки xlsx), **«Сохранить колонки»**
- Предупреждение о несохранённых колонках

**Раздел «Строки»**:

- Таблица строк (нет горизонтального скролла, `tableLayout="fixed"`, текст переносится)
- Колонки действий: **✎ Редактировать**, **⧉ Копировать**, **🗑 Удалить** (Popconfirm)
- Кнопка **«Добавить строку»**
- Модальное окно добавления/редактирования: поля для каждой data-колонки (DatePicker для `date`, Input для `text`)
- Кнопка **«Экспорт в Excel»** — скачать все строки с подтверждениями

---

### EmployeeJournalsPage — Журналы сотрудника

- Фильтр по отделению (Select)
- Список доступных журналов (только опубликованные, только доступные отделения)
- Таблица строк открытого журнала (`tableLayout="fixed"`, без горизонтального скролла)
- Колонка «Подтверждение»:
  - Подписано: зелёный тег + ФИО + дата
  - Не подписано: кнопка **«Подтвердить выполнение»**

**Модальное окно подтверждения:**
- **Данные строки** (read-only): значения колонок с `is_editable_by_employee = false`
- **Заполните перед подтверждением**: поля ввода для колонок с `is_editable_by_employee = true` (DatePicker для `date`, Input для `text`), предзаполнены текущим значением строки
- Поле **«Введите действующий пароль»** (bcrypt-проверка на сервере)
- При подтверждении: editable-значения фиксируются в новой ревизии строки, создаётся запись подтверждения с ФИО и временем

---

### DepartmentJournalAccessPage — Допуск к журналам

- Список отделений (только те, к которым привязан владелец журналов)
- При выборе отделения — список сотрудников с чекбоксами «Допущен»
- Включение/отключение → `PATCH /api/journal-access/departments/:deptId/employees/:userId`

---

### MetrologistCabinetPage — Кабинет метролога

| Раздел | Компонент |
|--------|-----------|
| Заявки метрологу | `AdminMetrologistRequestsPage` |
| График поверок МКС и ПИ | `CalibrationSchedulePage compact` |
| Уведомления Max | `MaxLinkCard` |

---

### FacilityCabinetPage — Кабинет АХЧ

| Раздел | Компонент |
|--------|-----------|
| АХЧ-заявки | `AdminAhchRequestsPage` |
| Уведомления Max | `MaxLinkCard` |

---

### ItDepartmentCabinetPage — Кабинет ИТ-отдела

| Раздел | Компонент |
|--------|-----------|
| ИТ-заявки | `AdminItRequestsPage` |
| Уведомления Max | `MaxLinkCard` |

---

### QualityControlCabinetPage — Кабинет контроля качества

| Раздел | Компонент |
|--------|-----------|
| Инциденты | `IncidentsRegistryPanel` |
| Уведомления Max | `MaxLinkCard` |

---

### ChiefCabinetPage — Кабинет главного врача

| Раздел | Компонент |
|--------|-----------|
| ИТ-заявки | `AdminItRequestsPage` |
| АХЧ-заявки | `AdminAhchRequestsPage` |
| Заявки метрологу | `AdminMetrologistRequestsPage` |
| Транспорт | `AdminTransportRequestsPage` |
| Инциденты | `IncidentsRegistryPanel` |
| Аналитика | `AnalyticsPage` |

---

### DispatcherCabinetPage — Кабинет диспетчера

| Раздел | Компонент |
|--------|-----------|
| Транспортные заявки | `AdminTransportRequestsPage` |
| Автомобили | `AdminVehiclesPage` |
| Уведомления Max | `MaxLinkCard` |

---

### CalibrationSchedulePage — График поверок МКС и ПИ

Переиспользуемый компонент с пропом `compact?: boolean`.

**Функции:**
- Таблица записей графика поверок
- Фильтры по всем полям → свёрнуты в Ant Design `Collapse` («Фильтры»), кнопка «Сбросить»
- Сортировка: поле + направление (↑/↓)
- **Загрузить Excel** — импорт через `parseCalibrationExcel.ts`
- **Выгрузить в Excel** — экспорт текущей отфильтрованной выборки
- **Удалить все данные** — очистка таблицы
- **Добавить / Редактировать / Удалить** одну запись

**Режим `compact`** (метролог): только — Дата действующей поверки, Дата следующей поверки, Номенклатура, Тип, Дата ввода в эксплуатацию.

**Полный режим** (администратор): все 12 колонок + действия.

---

## 6. Компоненты

### Модальные формы заявок

| Компонент | Поля |
|-----------|------|
| `ItRequestModal` | ФИО, телефон, отделение, место, текст, срочность |
| `AhchRequestModal` | Адрес, отделение, текст, телефон, срочность |
| `MetrologistRequestModal` | ФИО, телефон, отделение, место, текст |
| `TransportRequestModal` | Отделение, инициатор, должность, телефон, дата, время, маршрут, цель, кол-во пассажиров |
| `IncidentReportModal` | Дата, время, место, пациент, сотрудник, вид НС, тип, отделение, обстоятельства, последствия |

### MaxLinkCard

Карточка привязки/отвязки Max-аккаунта.  
Шаги: ввести Max ID → ввести код подтверждения → управление уведомлениями.

### IncidentsRegistryPanel

Таблица инцидентов с фильтрами по дате, отделению, виду, типу, статусу.

---

## 7. Сервисы API

Все сервисы находятся в `src/Core/services/`.  
Используют настроенный Axios instance из `Core/api/http.ts`.

**`http.ts`:** автоматически добавляет заголовок `Authorization: Bearer <token>` из localStorage.

### `journal.service.ts`

| Функция | Эндпоинт | Описание |
|---------|---------|---------|
| `fetchJournals(token, scope)` | `GET /journals?scope=` | Список журналов |
| `fetchJournal(id, token)` | `GET /journals/:id` | Журнал с колонками |
| `createJournal(payload, token)` | `POST /journals` | Создать черновик |
| `updateJournal(id, payload, token)` | `PATCH /journals/:id` | Переименовать |
| `updateJournalColumns(id, columns, token)` | `PUT /journals/:id/columns` | Обновить колонки |
| `publishJournal(id, token)` | `POST /journals/:id/publish` | Опубликовать |
| `archiveJournal(id, token)` | `POST /journals/:id/archive` | Архивировать |
| `restoreJournal(id, token)` | `POST /journals/:id/restore` | Восстановить |
| `fetchJournalRows(journalId, token)` | `GET /journals/:id/rows` | Список строк |
| `addJournalRow(journalId, values, token)` | `POST /journals/:id/rows` | Добавить строку |
| `updateJournalRow(journalId, rowId, values, rev, token)` | `PATCH /journals/:id/rows/:rowId` | Редактировать строку |
| `deleteJournalRow(journalId, rowId, token)` | `DELETE /journals/:id/rows/:rowId` | Удалить строку |
| `copyJournalRow(journalId, rowId, payload, token)` | `POST /journals/:id/rows/:rowId/copy` | Скопировать строку |
| `confirmJournalRow(journalId, rowId, payload, token)` | `POST /journals/:id/rows/:rowId/confirm` | Подтвердить строку |
| `correctJournalRow(journalId, rowId, payload, token)` | `POST /journals/:id/rows/:rowId/corrections` | Корректировка |
| `fetchRowHistory(journalId, rowId, token)` | `GET /journals/:id/rows/:rowId/history` | История ревизий |

**`confirmJournalRow` payload:**
```ts
{
  expectedRevision: number;
  password: string;
  idempotencyKey?: string;
  editableValues?: Record<string, string | null>;  // значения editable-колонок
}
```

### `employee.service.ts`

Функции: `fetchEmployees`, `createEmployee`, `updateEmployee`, `resetEmployeePassword`, `importEmployees`.

### `journal-access.service.ts`

Функции: `fetchJournalDepartments`, `fetchDepartmentEmployees`, `updateEmployeeAccess`.

---

## 8. TypeScript-типы

Все типы определены в `src/Core/types/common.ts`.

### Базовые типы

| Тип | Описание |
|-----|---------|
| `Department` | `{id, name, care_type, created_at}` |
| `IncidentType` | `{id, name, created_at}` |
| `IncidentViewType` | `{id, name, care_type, incident_types[]}` |
| `Announcement` | Объявление со всеми полями |
| `DocumentFolder` | `{id, name, parent_id, sort_order, created_at}` |
| `PortalDocument` | `{id, folder_id, title, description, file_url, original_filename, ...}` |
| `UrgencyLevel` | `{id, name, days}` |
| `ItRequest` | Заявка ИТ с `urgency_name`, `urgency_days` |
| `AhchRequest` | Заявка АХЧ с `urgency_name`, `urgency_days` |
| `MetrologistRequest` | Заявка метрологу |
| `TransportRequest` | Транспортная заявка с полями автомобиля |
| `Vehicle` | `{id, make, model, license_plate, driver}` |
| `Incident` | Нежелательное событие со всеми полями |
| `CalibrationScheduleItem` | Запись графика поверок |
| `OrganizationProfile` | `{id, logo_url, hero_image_url, updated_at}` |

### Аутентификация и пользователи

| Тип | Описание |
|-----|---------|
| `User` | `{id, fullName, role, roleTitle, permissions, mustChangePassword?}` |
| `RolePermissions` | Объект с булевыми флагами разрешений (см. ниже) |
| `RoleOption` | `{id, title, value}` |
| `UserListItem` | `{id, username, full_name, role, role_title, created_at}` |
| `AuthResponse` | `{token, user}` |

**`RolePermissions`:**
```ts
{
  canAccessCabinet: boolean;
  canAccessAdminCabinet: boolean;
  canAccessQualityCabinet: boolean;
  canAccessCabinetChief: boolean;
  canManageReferences: boolean;
  canManageDocuments: boolean;
  canViewIncidents: boolean;
  canViewItRequests: boolean;
  canManageItRequests: boolean;
  canManageEmployees?: boolean;
  canManageOwnJournals?: boolean;
  canManageAllJournals?: boolean;
  canManageJournalAccess?: boolean;
}
```

### Сотрудники

| Тип | Описание |
|-----|---------|
| `EmployeeDepartmentAssignment` | `{id, name, position, is_active, dept_version?}` |
| `EmployeeItem` | `{id, username, full_name, role, role_title, is_active, employee_code, departments[], created_at, must_change_password?, profile_version?}` |
| `EmployeeCredentials` | `{username, temporaryPassword}` |

### Журналы

| Тип | Описание |
|-----|---------|
| `JournalColumnType` | `'text' \| 'date' \| 'confirmation'` |
| `JournalColumn` | `{id, journal_id, title, type, sort_order, is_editable_by_employee}` |
| `JournalStatus` | `'draft' \| 'published' \| 'archived'` |
| `Journal` | `{id, title, department_id, department_name, owner_user_id?, owner_name?, status, version, schema_version?, first_published_at, created_at, updated_at, row_count?, columns?}` |
| `JournalRowConfirmation` | `{id, signer_full_name, signer_position, confirmed_at, status}` |
| `JournalRow` | `{id, sort_order, current_revision, values, created_at, updated_at, confirmation_id?, signer_full_name?, signer_position?, confirmed_at?, confirmation_status?}` |
| `DepartmentAccessEmployee` | `{user_id, full_name, position, has_access, granted_at?, revoked_at?}` |

---

## 9. Глобальное состояние Zustand

Файл: `src/Core/store/app.store.ts`

| Поле | Тип | Описание |
|------|-----|---------|
| `token` | `string \| null` | JWT-токен (сохраняется в localStorage) |
| `user` | `User \| null` | Текущий пользователь (включая `mustChangePassword`) |
| `portalView` | `'promo' \| 'cabinet'` | Режим: промо-сайт или кабинет |
| `organization` | `OrganizationProfile \| null` | Данные организации (лого, hero) |

Используется минимально. Справочники загружаются в локальный стейт страниц.  
**Важно:** список отделений в `AdminEmployeesPage` загружается напрямую через `fetchDepartments()`, а не из стора — стор отделений заполняется только на `HomePage` через `useReferences()`.

---

## 9a. Температурный лист

- Меню: кабинет главной медсестры (`HeadNurseCabinetPage`), сотрудник (при выданном доступе), администратор.
- `TempSheetsPage` — список, поиск, фильтр отделения (менеджер), создание/открытие текущего листа ребёнка×отделение, просмотр с ломаной температуры, PDF/Excel/печать.
- `TempSheetEditorPage` — редактирование в таблице, автосохранение полей (очередь запросов вкладки), очистка ячейки/колонки/таблицы, 15 колонок + 19 строк по бланку.
- `TempSheetAccessPage` — выдача/отзыв доступа сотрудникам.
- Общая форма: `components/TempSheetForm` + `Core/utils/tempSheetForm.ts` / `tempSheetExport.ts`.
- Шаблон Word: `docs/templates/Температурный лист.docx` (в форме 15 колонок записей вместо 18 в исходнике).

---

## 10. Утилиты

### `parseCalibrationExcel.ts`

Парсит Excel-файл для импорта графика поверок. Поддерживаемые форматы дат: серийный номер Excel, только год, ISO, `DD.MM.YYYY`, `M/D/YY`, `Mon-YY`.

### `calibrationSchedule.view.ts`

- `CalibrationSortKey` — тип ключа сортировки
- `CALIBRATION_SORT_OPTIONS` — опции для Select
- `sortCalibrationItems(items, key, direction)` — сортировка

### `parseEmployeesExcel.ts`

Парсит Excel-файл для пакетного импорта сотрудников.  
Ожидает столбцы: ФИО, отделение, должность.  
Сопоставляет отделения по имени (нечувствительно к регистру, `ё` → `е`).

### `exportEmployeeCredentials.ts`

Формирует xlsx-файл с логинами и временными паролями созданных сотрудников.

### `date.utils.ts`

| Функция | Формат вывода |
|---------|--------------|
| `formatDate(date)` | `DD.MM.YYYY` |
| `formatDateTime(date)` | `DD.MM.YYYY HH:mm` |
| `formatTime(time)` | `HH:mm` |

---

## 11. Стили

### Соглашения

- Файл `.scss` рядом с компонентом/страницей (не `.module.scss`)
- Классы именуются по БЭМ: `.page-name__element--modifier`
- Импорт переменных в каждом scss-файле: `@use '../styles/variables' as *`

### Переменные (`variables.scss`)

| Переменная | HEX | Назначение |
|-----------|-----|-----------|
| `$color-primary` | `#4C4FEA` | Основной цвет (кнопки, иконки, ссылки) |
| `$color-accent` | `#B8E028` | Акцент |
| `$color-white` | `#FFFFFF` | Фон карточек |
| `$color-text` | `#1F2A37` | Основной текст |
| `$color-muted` | `#5B6472` | Вторичный текст |
| `$color-bg-soft` | `#F4F7FB` | Фон страниц |
| `$color-border` | `#D8DEEA` | Границы |

### Таблицы журналов

Все таблицы строк журналов (и `ManagedJournalsPage`, и `EmployeeJournalsPage`) используют:
- `tableLayout="fixed"` — колонки равномерно занимают ширину, нет горизонтального скролла
- `word-break: break-word; white-space: normal` — длинный текст переносится

### JournalViewer: подсветка подписанных строк

```scss
.journal-viewer__row--signed {
  background-color: #f6ffed;
  &:hover > td { background-color: #eaf7de !important; }
}
```

---

## 12. Переменные окружения

Файл `frontend/.env`:

```env
VITE_API_URL=http://localhost:4000/api
VITE_IS_SHOW_REGISTRATION=false
```

`VITE_IS_SHOW_REGISTRATION=true` — показывает форму регистрации на промо-сайте (только для непривилегированных ролей).

---

## 13. Сборка и деплой

### Dev

```bash
cd frontend
yarn install
yarn dev        # Vite dev server на :5173
```

### Production

```bash
cd frontend
yarn build      # собирает в frontend/dist/
```

### nginx (SPA)

```nginx
location / {
    root /path/to/frontend/dist;
    index index.html;
    try_files $uri $uri/ /index.html;
}
```
