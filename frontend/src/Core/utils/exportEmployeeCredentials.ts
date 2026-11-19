import * as XLSX from 'xlsx';

export type EmployeeCredentialRow = {
  fullName: string;
  employeeCode: string;
  departments: string; // "Отделение — Должность; ..."
  username: string;
  temporaryPassword: string;
};

/**
 * Формирует Excel-книгу с двумя листами:
 * 1. «Доступы» — сводная таблица
 * 2. «Карточки для выдачи» — блоки для печати по одному на сотрудника
 *
 * Пароли хранятся только в памяти текущего вызова.
 * Файл не пишется на диск и не сохраняется в localStorage.
 */
export function buildCredentialsWorkbook(
  credentials: EmployeeCredentialRow[],
  portalUrl: string,
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // ── Лист 1: Доступы ────────────────────────────────────────
  const accessData: string[][] = [
    ['ФИО', 'Код сотрудника', 'Отделения и должности', 'Логин', 'Временный пароль'],
    ...credentials.map((c) => [c.fullName, c.employeeCode, c.departments, c.username, c.temporaryPassword]),
  ];
  const accessSheet = XLSX.utils.aoa_to_sheet(accessData);
  accessSheet['!cols'] = [
    { wch: 30 }, { wch: 15 }, { wch: 40 }, { wch: 20 }, { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, accessSheet, 'Доступы');

  // ── Лист 2: Карточки для выдачи ───────────────────────────
  const cardRows: string[][] = [];
  for (const c of credentials) {
    cardRows.push([`ФИО:`, c.fullName]);
    cardRows.push([`Код сотрудника:`, c.employeeCode]);
    cardRows.push([`Место работы:`, c.departments]);
    cardRows.push([`Портал:`, portalUrl]);
    cardRows.push([`Логин:`, c.username]);
    cardRows.push([`Временный пароль:`, c.temporaryPassword]);
    cardRows.push([`Инструкция:`, 'При первом входе система потребует смену пароля (минимум 15 символов)']);
    cardRows.push(['', '']); // разделитель
  }

  const cardSheet = XLSX.utils.aoa_to_sheet(cardRows);
  cardSheet['!cols'] = [{ wch: 22 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(wb, cardSheet, 'Карточки для выдачи');

  return wb;
}

/**
 * Скачивает книгу как .xlsx файл через браузер.
 */
export function downloadCredentialsXlsx(wb: XLSX.WorkBook, filename = 'credentials.xlsx'): void {
  XLSX.writeFile(wb, filename);
}
