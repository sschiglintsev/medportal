import * as XLSX from 'xlsx';

/**
 * Поддерживаемые заголовки колонок.
 * Колонка ФИО поддерживает синоним FIO (явно задокументирован).
 */
const FIO_HEADERS = new Set(['фио', 'fio', 'ф.и.о.', 'full_name']);
const DEPT_HEADERS = new Set(['отделение', 'отдел', 'department']);
const POS_HEADERS = new Set(['должность', 'position', 'prof']);
const CODE_HEADERS = new Set(['код сотрудника', 'код', 'employee_code', 'code', 'emplcode']);

export type ParsedEmployeeRow = {
  sourceRow: number;
  fullName: string;
  departmentName: string;
  position: string;
  employeeCode?: string;
};

export type ParseEmployeesResult = {
  sheetNames: string[];
  rows: ParsedEmployeeRow[];
  errors: string[];
};

/**
 * Нормализует строку: убирает leading/trailing и повторяющиеся пробелы (включая NBSP).
 */
function normalizeStr(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/\u00a0/g, ' ')  // NBSP → обычный пробел
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Нормализует заголовок для сопоставления.
 */
function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Определяет тип колонки по заголовку.
 */
function detectColumnType(
  header: string,
): 'fio' | 'department' | 'position' | 'code' | null {
  const h = normalizeHeader(header);
  if (FIO_HEADERS.has(h)) return 'fio';
  if (DEPT_HEADERS.has(h)) return 'department';
  if (POS_HEADERS.has(h)) return 'position';
  if (CODE_HEADERS.has(h)) return 'code';
  return null;
}

/**
 * Парсит выбранный лист Excel-файла.
 * Возвращает нормализованные строки без ошибок.
 * Формулы и макросы не вычисляются — если ячейка содержит формулу, отклоняем строку.
 */
export function parseEmployeesSheet(
  workbook: XLSX.WorkBook,
  sheetName: string,
): ParseEmployeesResult {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return { sheetNames: workbook.SheetNames, rows: [], errors: [`Лист "${sheetName}" не найден`] };
  }

  // Читаем как массив массивов, raw=false для текстового представления
  const rawRows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '' });

  if (rawRows.length < 2) {
    return { sheetNames: workbook.SheetNames, rows: [], errors: ['Файл не содержит данных'] };
  }

  const headerRow = rawRows[0] as string[];
  const colMap: Record<string, number> = {};

  // Определяем позиции колонок
  for (let i = 0; i < headerRow.length; i++) {
    const type = detectColumnType(headerRow[i]);
    if (type && !(type in colMap)) {
      colMap[type] = i;
    }
  }

  const errors: string[] = [];

  if (!('fio' in colMap)) errors.push('Не найдена колонка ФИО (или FIO)');
  if (!('department' in colMap)) errors.push('Не найдена колонка Отделение');
  if (!('position' in colMap)) errors.push('Не найдена колонка Должность');

  if (errors.length > 0) {
    return { sheetNames: workbook.SheetNames, rows: [], errors };
  }

  const rows: ParsedEmployeeRow[] = [];
  const rowErrors: string[] = [];

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i] as string[];
    const excelRow = i + 1; // номер строки в Excel (1-based, +1 за заголовок)

    const fullName = normalizeStr(row[colMap.fio]);
    const departmentName = normalizeStr(row[colMap.department]);
    const position = normalizeStr(row[colMap.position]);
    const rawCode = 'code' in colMap ? row[colMap.code] : undefined;

    // Пропускаем пустые строки
    if (!fullName && !departmentName && !position) continue;

    // Проверяем на формулы (ячейки начинаются с =)
    const hasFormula = [fullName, departmentName, position].some((v) => v.startsWith('='));
    if (hasFormula) {
      rowErrors.push(`Строка ${excelRow}: ячейка содержит формулу — отклонено`);
      continue;
    }

    if (!fullName) {
      rowErrors.push(`Строка ${excelRow}: пустое ФИО`);
      continue;
    }
    if (!departmentName) {
      rowErrors.push(`Строка ${excelRow}: пустое отделение`);
      continue;
    }
    if (!position) {
      rowErrors.push(`Строка ${excelRow}: пустая должность`);
      continue;
    }

    // Код сотрудника — читаем как текст, сохраняем ведущие нули
    const employeeCode = rawCode !== undefined ? normalizeStr(rawCode) || undefined : undefined;

    rows.push({
      sourceRow: excelRow,
      fullName,
      departmentName,
      position,
      employeeCode,
    });
  }

  return {
    sheetNames: workbook.SheetNames,
    rows,
    errors: [...errors, ...rowErrors],
  };
}

/**
 * Читает ArrayBuffer Excel-файла и возвращает имена листов.
 * Не вычисляет формулы.
 */
export function readEmployeesExcel(buffer: ArrayBuffer): XLSX.WorkBook {
  return XLSX.read(buffer, {
    type: 'array',
    cellFormula: false,
    cellDates: false,
    raw: false,
  });
}
