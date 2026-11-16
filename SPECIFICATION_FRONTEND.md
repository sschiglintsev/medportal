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
| `chart.js` + `react-chartjs-2` | — | Графики на странице аналитики |
| `sass` | — | SCSS-препроцессор |

---

## 2. Структура проекта

```
frontend/src/
├── App.tsx                          ← Корневой компонент: выбор кабинета по роли, роутинг
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
│   │   ├── max.service.ts
│   │   └── calibration-schedule.service.ts
│   ├── store/
│   │   └── app.store.ts             ← Zustand-стор
│   ├── utils/
│   │   ├── parseCalibrationExcel.ts ← Парсинг Excel для импорта графика поверок
│   │   └── calibrationSchedule.view.ts ← Сортировка и фильтрация графика поверок
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
│   ├── AdminOrganizationPage.tsx
│   ├── AdminIncidentTypesPage.tsx
│   ├── AdminReferenceIncidentTypesPage.tsx
│   └── AnalyticsPage.tsx
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

```
CalibrationSchedulePage.tsx
CalibrationSchedulePage.scss  ✅
```

---

## 3. Роутинг

Роутинг описан в `App.tsx` и `react-router-dom`.

| Путь | Компонент | Описание |
|------|-----------|---------|
| `/` | `PromoPage` | Главная промо-страница |
| `/documents` | `DocumentsPage` | Документы + график поверок |
| `/cabinet` | Кабинет по роли | Личный кабинет (выбирается по `user.role`) |

**Выбор кабинета по роли** (`App.tsx`):

| `user.role` | Кабинет |
|-------------|---------|
| `administrator` | `AdminCabinetPage` |
| `metrologist` | `MetrologistCabinetPage` |
| `facility` | `FacilityCabinetPage` |
| `it_department` | `ItDepartmentCabinetPage` |
| `quality_department` | `QualityControlCabinetPage` |
| `chief_doctor` | `ChiefCabinetPage` |
| `dispatcher` | `DispatcherCabinetPage` |

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

**Статус заявки** — выпадающий список в шапке, позволяет проверить статус по ID без авторизации через публичный эндпоинт `GET /api/{type}-requests/:id/public`.

---

### DocumentsPage (`/documents`)

Два таба (Ant Design `Tabs`):

**Таб 1 — Документы**
- Дерево разделов (`document_folders`) в сайдбаре
- Список файлов выбранного раздела
- Кнопка скачивания файла

**Таб 2 — График поверок МКС и ПИ**
- Таблица `CalibrationSchedulePublicTable` (компонент внутри файла)
- Фильтр по отделению (Select)
- Сортировка: по дате ввода, дате выпуска, дате поверок, отделению, типу; направление ↑ / ↓
- Данные загружаются из `GET /api/calibration-schedule` (публичный)
- Таблица компактная: `size="small"`, `font-size: 11px`, перенос строк (не `ellipsis`), без горизонтального скролла

---

## 5. Личные кабинеты

Все кабинеты используют `MainLayout` — боковое меню + контентная область.  
Каждый раздел — отдельный компонент-страница, рендерится через `switch` по активному пункту меню.

---

### AdminCabinetPage — Кабинет администратора

| Раздел | Компонент | Описание |
|--------|-----------|---------|
| Отделения | `AdminDepartmentsPage` | CRUD отделений |
| Виды НС | `AdminReferenceIncidentTypesPage` | Виды и типы инцидентов |
| Объявления | `AdminAnnouncementsPage` | CRUD объявлений |
| Документы | `AdminDocumentsPage` | CRUD разделов и файлов |
| ИТ-заявки | `AdminItRequestsPage` | Список + смена статуса + комментарий; индикатор просрочки |
| Заявки метрологу | `AdminMetrologistRequestsPage` | Список + смена статуса |
| АХЧ-заявки | `AdminAhchRequestsPage` | Список + смена статуса; индикатор просрочки |
| Транспорт | `AdminTransportRequestsPage` | Список + назначение авто |
| Автомобили | `AdminVehiclesPage` | CRUD автомобилей |
| График поверок | `CalibrationSchedulePage` | Полный режим (все колонки) |
| Инциденты | `IncidentsRegistryPanel` | Реестр нежелательных событий |
| Аналитика | `AnalyticsPage` | Графики по заявкам |
| Пользователи | `AdminUsersPage` | CRUD пользователей |
| Профиль организации | `AdminOrganizationPage` | Загрузка лого и hero |

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
- Сортировка: поле + направление (↑/↓) — находится вне Collapse
- **Загрузить Excel** — импорт через `parseCalibrationExcel.ts`
- **Выгрузить в Excel** — экспорт текущей отфильтрованной выборки через `xlsx`
- **Удалить все данные** — очистка таблицы (временная кнопка для первоначальной загрузки)
- **Добавить / Редактировать / Удалить** одну запись

**Режим `compact`** (метролог): отображаются только колонки — Дата действующей поверки, Дата следующей поверки, Номенклатура, Тип, Дата ввода в эксплуатацию.

**Полный режим** (администратор): все 12 колонок + действия.

**Индикатор просрочки в заявках ИТ и АХЧ:**  
Если заявка просрочена (`created_at + urgency_days < today`), в теге срочности отображается: `«Срочность — Просрочено (на N дн.)»`.

---

## 6. Компоненты

### Модальные формы заявок

Все формы используют Ant Design `Form`, `Modal`.  
После успешной отправки показывают номер созданной заявки.

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

**`http.ts`:** автоматически добавляет заголовок `Authorization: Bearer <token>` из `localStorage`.

Пример сервиса:

```ts
// calibration-schedule.service.ts
export const fetchCalibrationSchedule = () =>
  http.get<CalibrationScheduleItem[]>('/calibration-schedule').then(r => r.data);

export const importCalibrationSchedule = (items: CalibrationSchedulePayload[]) =>
  http.post('/calibration-schedule/import', { items }, { timeout: 60000 });

export const clearCalibrationSchedule = () =>
  http.delete('/calibration-schedule/all');
```

---

## 8. TypeScript-типы

Все типы определены в `src/Core/types/common.ts`.

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
| `User` | `{id, fullName, role, roleTitle, permissions}` |
| `RolePermissions` | Объект с булевыми флагами разрешений |
| `RoleOption` | `{id, title, value}` |
| `UserListItem` | Пользователь для таблицы управления |
| `OrganizationProfile` | `{id, logo_url, hero_image_url, updated_at}` |
| `AuthResponse` | `{token, user}` |

---

## 9. Глобальное состояние Zustand

Файл: `src/Core/store/app.store.ts`

| Поле | Тип | Описание |
|------|-----|---------|
| `token` | `string \| null` | JWT-токен (сохраняется в localStorage) |
| `user` | `User \| null` | Текущий пользователь |
| `portalView` | `'promo' \| 'cabinet'` | Режим: промо-сайт или кабинет |
| `organization` | `OrganizationProfile \| null` | Данные организации (лого, hero) |

Используется минимально. Справочники (отделения, типы инцидентов) загружаются в локальный стейт страниц.

---

## 10. Утилиты

### `parseCalibrationExcel.ts`

Парсит Excel-файл (`.xlsx`) для импорта графика поверок.

**Поддерживаемые форматы дат:**
- Серийный Excel-номер (число > 20000)
- Только год: `2024` → `2024-01-01`
- ISO: `2024-05-15`
- `DD.MM.YYYY`
- `M/D/YY` (US-формат, который генерирует библиотека `xlsx`)
- `Mon-YY` (например, `Aug-26`)

**Защита ведущих нулей:**  
Инвентарные и заводские номера читаются через `raw: false` (форматированный текст), что сохраняет `"03292"` вместо `3292`.

**Сопоставление отделений:**  
По имени, нечувствительно к регистру, `ё` → `е`, лишние пробелы убираются. Если отделение не найдено — поле `department_id` остаётся `null`.

---

### `calibrationSchedule.view.ts`

Утилиты для отображения графика поверок в таблице.

- `CalibrationSortKey` — тип ключа сортировки (6 вариантов)
- `CALIBRATION_SORT_OPTIONS` — массив опций для Select
- `sortCalibrationItems(items, key, direction)` — сортировка с `String.localeCompare({numeric: true})`

---

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

### Таблица графика поверок на промо (`.docs-page__schedule-table`)

```scss
.docs-page__schedule-table {
  font-size: 11px;

  .ant-table-cell {
    padding: 6px 5px;
    white-space: normal;
    word-break: break-word;
    overflow-wrap: anywhere;
  }
}
```

Таблица использует `tableLayout="fixed"` и не имеет горизонтального скролла.

### Фильтры графика поверок (`.calibration-schedule-page__filters`)

```scss
.calibration-schedule-page__filters {
  display: grid;
  grid-template-columns: repeat(auto-fill, 200px);
  gap: 8px;

  > * { width: 100%; }
}
```

---

## 12. Переменные окружения

Файл `frontend/.env`:

```env
VITE_API_URL=http://localhost:4000/api
VITE_IS_SHOW_REGISTRATION=false
```

`VITE_IS_SHOW_REGISTRATION=true` — показывает кнопку/форму регистрации на промо-сайте.

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
