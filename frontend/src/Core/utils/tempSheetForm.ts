import type { TemperatureBand, TempSheetColumnData } from '../types/common';
import { TEMP_BAND_LABELS, TEMP_BAND_ORDER } from '../types/common';

/** Строки бланка (19 шт.) в порядке шаблона. */
export type TempSheetRowKind =
  | 'stay_day'
  | 'observation_date'
  | 'observation_time'
  | 'temp_header'
  | 'temp_band'
  | 'respiratory_rate'
  | 'spo2'
  | 'weight_kg'
  | 'oral_fluid_ml'
  | 'parenteral_fluid_ml'
  | 'urine_volume_ml'
  | 'stool';

export type TempSheetRowDef = {
  key: string;
  label: string;
  kind: TempSheetRowKind;
  band?: TemperatureBand;
  field?: keyof TempSheetColumnData;
};

export const TEMP_SHEET_ROWS: TempSheetRowDef[] = [
  { key: 'stay_day', label: 'Сутки пребывания в стационаре, дневном стационаре', kind: 'stay_day', field: 'stay_day' },
  { key: 'date', label: 'Дата', kind: 'observation_date', field: 'observation_date' },
  { key: 'time', label: 'Время', kind: 'observation_time', field: 'observation_time' },
  { key: 'temp_header', label: 'Температура тела, (С°)', kind: 'temp_header' },
  ...TEMP_BAND_ORDER.map((band) => ({
    key: `band_${band}`,
    label: TEMP_BAND_LABELS[band],
    kind: 'temp_band' as const,
    band,
  })),
  { key: 'rr', label: 'Частота дыхания', kind: 'respiratory_rate', field: 'respiratory_rate' },
  { key: 'spo2', label: 'SpO2 , %', kind: 'spo2', field: 'spo2' },
  { key: 'weight', label: 'Масса тела (кг)', kind: 'weight_kg', field: 'weight_kg' },
  { key: 'oral', label: 'Выпито жидкости (мл)', kind: 'oral_fluid_ml', field: 'oral_fluid_ml' },
  { key: 'parenteral', label: 'Введено жидкостей (в мл) парентерально', kind: 'parenteral_fluid_ml', field: 'parenteral_fluid_ml' },
  { key: 'urine', label: 'Суточный объем мочи (мл)', kind: 'urine_volume_ml', field: 'urine_volume_ml' },
  { key: 'stool', label: 'Стул', kind: 'stool', field: 'stool' },
];

export const TEMP_SHEET_TITLE =
  'ЛИСТ РЕГИСТРАЦИИ ПОКАЗАТЕЛЕЙ ЖИЗНЕННО ВАЖНЫХ ФУНКЦИЙ ОРГАНИЗМА';

export const COLUMN_COUNT = 15;

export function emptyColumn(index: number): TempSheetColumnData {
  return {
    column_index: index,
    stay_day: null,
    observation_date: null,
    observation_time: null,
    temperature_band: null,
    respiratory_rate: null,
    spo2: null,
    weight_kg: null,
    oral_fluid_ml: null,
    parenteral_fluid_ml: null,
    urine_volume_ml: null,
    stool: null,
  };
}

export function normalizeColumns(columns?: TempSheetColumnData[]): TempSheetColumnData[] {
  const byIndex = new Map((columns ?? []).map((c) => [c.column_index, c]));
  const result: TempSheetColumnData[] = [];
  for (let i = 1; i <= COLUMN_COUNT; i++) {
    result.push(byIndex.get(i) ?? emptyColumn(i));
  }
  return result;
}

/** Возраст для шапки (только отображение). */
export function formatAge(birthDate: string | null | undefined): string {
  if (!birthDate) return '';
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return '';
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) years -= 1;
  if (years < 0) return '';
  if (years < 1) {
    let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
    if (now.getDate() < birth.getDate()) months -= 1;
    return months <= 0 ? 'менее мес.' : `${months} мес.`;
  }
  return `${years}`;
}

export function formatDateDisplay(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

export function formatTimeDisplay(time: string | null | undefined): string {
  if (!time) return '';
  return time.slice(0, 5);
}

/** Точки графика температуры: индекс колонки 0..14 → индекс диапазона 0..7. */
export function buildTempPoints(
  columns: TempSheetColumnData[],
): Array<{ col: number; bandIdx: number }> {
  const points: Array<{ col: number; bandIdx: number }> = [];
  for (let i = 0; i < columns.length; i++) {
    const band = columns[i]?.temperature_band;
    if (!band) continue;
    const bandIdx = TEMP_BAND_ORDER.indexOf(band);
    if (bandIdx >= 0) points.push({ col: i, bandIdx });
  }
  return points;
}

/** Сегменты ломаной: разрыв на пустых колонках. */
export function buildTempSegments(
  points: Array<{ col: number; bandIdx: number }>,
): Array<Array<{ col: number; bandIdx: number }>> {
  if (points.length === 0) return [];
  const sorted = [...points].sort((a, b) => a.col - b.col);
  const segments: Array<Array<{ col: number; bandIdx: number }>> = [];
  let current: Array<{ col: number; bandIdx: number }> = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].col === sorted[i - 1].col + 1) {
      current.push(sorted[i]);
    } else {
      segments.push(current);
      current = [sorted[i]];
    }
  }
  segments.push(current);
  return segments;
}

/** Нормализация десятичных: запятая → точка для хранения как текста как есть. */
export function normalizeDecimalInput(value: string): string {
  return value.replace(/\s/g, '').replace(',', '.');
}
