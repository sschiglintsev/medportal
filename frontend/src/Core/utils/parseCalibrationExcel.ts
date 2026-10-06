import * as XLSX from 'xlsx';

import type { CalibrationSchedulePayload } from '../services/calibration-schedule.service';

const HEADER_ALIASES: Record<string, string[]> = {
  commissioning_date: ['дата ввода в эксплуатацию'],
  nomenclature: ['номенклатура (наименование)', 'номенклатура'],
  type: ['тип'],
  inventory_number: ['инвентарный номер'],
  serial_number: ['заводской номер'],
  manufacture_date: ['дата выпуска'],
  department: ['отделение'],
  quantity: ['количество'],
  verification_kind: ['поверка, мкс, пи', 'поверка мкс пи'],
  current_verification_date: ['дата действующей поверки, мкс или пи', 'дата действующей поверки'],
  next_verification_date: ['дата следующей поверки, мкс или пи', 'дата следующей поверки'],
  note: ['примечание'],
};

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toIsoDate(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

function excelSerialToIso(serial: number): string | null {
  const utc = new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000);
  if (Number.isNaN(utc.getTime())) return null;
  return utc.toISOString().slice(0, 10);
}

export function parseExcelDate(value: unknown): string | null {
  if (value == null || value === '') return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value >= 1900 && value <= 2100 && Number.isInteger(value)) {
      return toIsoDate(value, 1, 1);
    }
    if (value > 20000) {
      return excelSerialToIso(value);
    }
    return null;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d{4}$/.test(raw)) {
    return toIsoDate(Number(raw), 1, 1);
  }

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return toIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const dmy = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dmy) return toIsoDate(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));

  const mdy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mdy) {
    let year = Number(mdy[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    return toIsoDate(year, Number(mdy[1]), Number(mdy[2]));
  }

  const monYear = raw.match(/^([A-Za-z]{3})-(\d{2})$/);
  if (monYear) {
    const month = MONTHS[monYear[1].toLowerCase()];
    if (!month) return null;
    const year = 2000 + Number(monYear[2]);
    return toIsoDate(year, month, 1);
  }

  return null;
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function buildHeaderMap(headerRow: unknown[]): Map<string, number> {
  const map = new Map<string, number>();
  headerRow.forEach((cell, index) => {
    const key = normalizeHeader(cell);
    if (key) map.set(key, index);
  });
  return map;
}

function findColumn(headerMap: Map<string, number>, aliases: string[]): number | null {
  for (const alias of aliases) {
    const index = headerMap.get(alias);
    if (index != null) return index;
  }
  return null;
}

function cell(row: unknown[], index: number | null): unknown {
  if (index == null) return '';
  return row[index];
}

function parseQuantity(value: unknown): number | null {
  if (value == null || value === '') return null;
  const num = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(num)) return null;
  return Math.trunc(num);
}

function parseText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text === '' ? null : text;
}

function parseCode(value: unknown): string | null {
  if (value == null || value === '') return null;
  const text = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t\r\n]+/g, ' ')
    .trim();
  return text === '' ? null : text;
}

function firstNonEmpty(...values: unknown[]): unknown {
  for (const value of values) {
    if (value == null || value === '') continue;
    return value;
  }
  return '';
}

function parseSheet(rawRows: unknown[][], textRows: unknown[][]): CalibrationSchedulePayload[] {
  if (rawRows.length < 2) return [];
  const headerMap = buildHeaderMap(rawRows[0] ?? []);
  const nomenclatureIndex = findColumn(headerMap, HEADER_ALIASES.nomenclature);
  if (nomenclatureIndex == null) return [];

  const columns = {
    commissioning_date: findColumn(headerMap, HEADER_ALIASES.commissioning_date),
    type: findColumn(headerMap, HEADER_ALIASES.type),
    inventory_number: findColumn(headerMap, HEADER_ALIASES.inventory_number),
    serial_number: findColumn(headerMap, HEADER_ALIASES.serial_number),
    manufacture_date: findColumn(headerMap, HEADER_ALIASES.manufacture_date),
    department: findColumn(headerMap, HEADER_ALIASES.department),
    quantity: findColumn(headerMap, HEADER_ALIASES.quantity),
    verification_kind: findColumn(headerMap, HEADER_ALIASES.verification_kind),
    current_verification_date: findColumn(headerMap, HEADER_ALIASES.current_verification_date),
    next_verification_date: findColumn(headerMap, HEADER_ALIASES.next_verification_date),
    note: findColumn(headerMap, HEADER_ALIASES.note),
  };

  const items: CalibrationSchedulePayload[] = [];
  for (let i = 1; i < rawRows.length; i += 1) {
    const row = rawRows[i] ?? [];
    const textRow = textRows[i] ?? [];
    const nomenclature = parseText(cell(row, nomenclatureIndex));
    if (!nomenclature) continue;
    items.push({
      commissioning_date: parseExcelDate(cell(row, columns.commissioning_date)),
      nomenclature,
      type: parseText(cell(row, columns.type)),
      inventory_number: parseCode(firstNonEmpty(cell(textRow, columns.inventory_number), cell(row, columns.inventory_number))),
      serial_number: parseCode(firstNonEmpty(cell(textRow, columns.serial_number), cell(row, columns.serial_number))),
      manufacture_date: parseExcelDate(cell(row, columns.manufacture_date)),
      department: parseText(cell(row, columns.department)),
      quantity: parseQuantity(cell(row, columns.quantity)),
      verification_kind: parseText(cell(row, columns.verification_kind)),
      current_verification_date: parseExcelDate(cell(row, columns.current_verification_date)),
      next_verification_date: parseExcelDate(cell(row, columns.next_verification_date)),
      note: parseText(cell(row, columns.note)),
    });
  }
  return items;
}

export function parseCalibrationExcel(file: ArrayBuffer): CalibrationSchedulePayload[] {
  const workbook = XLSX.read(file, { type: 'array', cellDates: false });
  const items: CalibrationSchedulePayload[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true }) as unknown[][];
    const textRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }) as unknown[][];
    items.push(...parseSheet(rawRows, textRows));
  }
  return items;
}
