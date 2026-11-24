import { http } from '../api/http';
import type {
  Patient,
  TempSheet,
  TempSheetAccessUser,
  TempSheetColumnData,
} from '../types/common';

export type TempSheetMyAccess = {
  hasAccess: boolean;
  role: 'manager' | 'employee';
  canEdit: boolean;
  canManageAccess: boolean;
};

export type TempSheetListResponse = {
  items: TempSheet[];
  total: number;
  page: number;
  limit: number;
};

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function fetchTempSheetMyAccess(token: string): Promise<TempSheetMyAccess> {
  const { data } = await http.get<TempSheetMyAccess>('/temp-sheets/my-access', {
    headers: authHeaders(token),
  });
  return data;
}

export async function fetchTempSheetDepartments(
  token: string,
): Promise<Array<{ id: number; name: string }>> {
  const { data } = await http.get<Array<{ id: number; name: string }>>(
    '/temp-sheets/departments',
    { headers: authHeaders(token) },
  );
  return data;
}

export async function searchTempSheetPatients(token: string, q: string): Promise<Patient[]> {
  const { data } = await http.get<Patient[]>('/temp-sheets/patients', {
    headers: authHeaders(token),
    params: { q },
  });
  return data;
}

export async function createTempSheetPatient(
  token: string,
  payload: { full_name: string; birth_date?: string | null },
): Promise<Patient> {
  const { data } = await http.post<Patient>('/temp-sheets/patients', payload, {
    headers: authHeaders(token),
  });
  return data;
}

export async function fetchTempSheets(
  token: string,
  params: { q?: string; departmentId?: number; page?: number; limit?: number },
): Promise<TempSheetListResponse> {
  const { data } = await http.get<TempSheetListResponse>('/temp-sheets', {
    headers: authHeaders(token),
    params,
  });
  return data;
}

export async function createOrGetTempSheet(
  token: string,
  payload: { patient_id: number; department_id: number; height_cm?: number | null },
): Promise<Pick<TempSheet, 'id' | 'patient_id' | 'department_id' | 'height_cm' | 'created_at' | 'updated_at'>> {
  const { data } = await http.post('/temp-sheets', payload, {
    headers: authHeaders(token),
  });
  return data;
}

export async function fetchTempSheet(token: string, id: number): Promise<TempSheet & { can_edit?: boolean }> {
  const { data } = await http.get(`/temp-sheets/${id}`, {
    headers: authHeaders(token),
  });
  return data;
}

export async function updateTempSheetHeader(
  token: string,
  id: number,
  height_cm: number | null,
): Promise<void> {
  await http.patch(
    `/temp-sheets/${id}/header`,
    { height_cm },
    { headers: authHeaders(token) },
  );
}

export async function updateTempSheetColumn(
  token: string,
  sheetId: number,
  col: number,
  fields: Partial<TempSheetColumnData>,
): Promise<void> {
  await http.patch(`/temp-sheets/${sheetId}/columns/${col}`, fields, {
    headers: authHeaders(token),
  });
}

export async function clearTempSheetColumn(
  token: string,
  sheetId: number,
  col: number,
): Promise<void> {
  await http.delete(`/temp-sheets/${sheetId}/columns/${col}`, {
    headers: authHeaders(token),
  });
}

export async function clearTempSheetAllColumns(token: string, sheetId: number): Promise<void> {
  await http.delete(`/temp-sheets/${sheetId}/columns`, {
    headers: authHeaders(token),
  });
}

export async function fetchTempSheetModuleAccess(token: string): Promise<TempSheetAccessUser[]> {
  const { data } = await http.get<TempSheetAccessUser[]>('/temp-sheets/module-access', {
    headers: authHeaders(token),
  });
  return data;
}

export async function updateTempSheetModuleAccess(
  token: string,
  payload: { grantUserIds: number[]; revokeUserIds: number[] },
): Promise<void> {
  await http.put('/temp-sheets/module-access', payload, {
    headers: authHeaders(token),
  });
}
