import { http } from '../api/http';
import type { CalibrationScheduleItem } from '../types/common';

type AuthHeader = { token: string };

export type CalibrationSchedulePayload = {
  commissioning_date?: string | null;
  nomenclature: string;
  type?: string | null;
  inventory_number?: string | null;
  serial_number?: string | null;
  manufacture_date?: string | null;
  department_id?: number | null;
  department?: string | null;
  quantity?: number | null;
  verification_kind?: string | null;
  current_verification_date?: string | null;
  next_verification_date?: string | null;
  note?: string | null;
};

export async function fetchCalibrationSchedule(): Promise<CalibrationScheduleItem[]> {
  const { data } = await http.get<CalibrationScheduleItem[]>('/calibration-schedule');
  return data;
}

export async function createCalibrationItem(
  payload: CalibrationSchedulePayload,
  auth: AuthHeader,
): Promise<CalibrationScheduleItem> {
  const { data } = await http.post<CalibrationScheduleItem>('/calibration-schedule', payload, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  return data;
}

export async function updateCalibrationItem(
  id: number,
  payload: CalibrationSchedulePayload,
  auth: AuthHeader,
): Promise<CalibrationScheduleItem> {
  const { data } = await http.put<CalibrationScheduleItem>(`/calibration-schedule/${id}`, payload, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  return data;
}

export async function deleteCalibrationItem(id: number, auth: AuthHeader): Promise<void> {
  await http.delete(`/calibration-schedule/${id}`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
}

export async function clearCalibrationSchedule(auth: AuthHeader): Promise<{ deleted: number }> {
  const { data } = await http.delete<{ deleted: number }>('/calibration-schedule/all', {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  return data;
}

export async function importCalibrationSchedule(
  items: CalibrationSchedulePayload[],
  auth: AuthHeader,
): Promise<{ imported: number }> {
  const { data } = await http.post<{ imported: number }>(
    '/calibration-schedule/import',
    { items },
    {
      headers: { Authorization: `Bearer ${auth.token}` },
      timeout: 60000,
    },
  );
  return data;
}
