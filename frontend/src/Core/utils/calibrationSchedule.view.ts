import type { CalibrationScheduleItem } from '../types/common';

export type CalibrationSortKey =
  | 'commissioning_date'
  | 'manufacture_date'
  | 'current_verification_date'
  | 'next_verification_date'
  | 'department_name'
  | 'type';

export const CALIBRATION_SORT_OPTIONS: { value: CalibrationSortKey; label: string }[] = [
  { value: 'commissioning_date', label: 'Дате ввода в эксплуатацию' },
  { value: 'manufacture_date', label: 'Дате выпуска' },
  { value: 'current_verification_date', label: 'Дате действующей поверки' },
  { value: 'next_verification_date', label: 'Дате следующей поверки' },
  { value: 'department_name', label: 'Отделению' },
  { value: 'type', label: 'Типу' },
];

export function sortCalibrationItems(
  items: CalibrationScheduleItem[],
  sortKey: CalibrationSortKey | null,
  direction: 'asc' | 'desc',
): CalibrationScheduleItem[] {
  if (!sortKey) return items;
  const sign = direction === 'desc' ? -1 : 1;
  return [...items].sort((left, right) => {
    const a = left[sortKey];
    const b = right[sortKey];
    if (a == null || a === '') return b == null || b === '' ? 0 : 1;
    if (b == null || b === '') return -1;
    return String(a).localeCompare(String(b), 'ru', { numeric: true, sensitivity: 'base' }) * sign;
  });
}
