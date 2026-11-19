import type { DepartmentAccessEmployee } from '../types/common';
import { http } from '../api/http';

export async function fetchJournalDepartments(
  token: string,
): Promise<Array<{ id: number; name: string; care_type: string | null }>> {
  const { data } = await http.get('/journal-departments', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data as Array<{ id: number; name: string; care_type: string | null }>;
}

export type DepartmentAccessResponse = {
  departmentId: number;
  accessVersion: number;
  employees: DepartmentAccessEmployee[];
};

export async function fetchDepartmentAccess(
  departmentId: number,
  token: string,
): Promise<DepartmentAccessResponse> {
  const { data } = await http.get<DepartmentAccessResponse>(
    `/journal-departments/${departmentId}/access`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return data;
}

export async function updateDepartmentAccess(
  departmentId: number,
  payload: { expectedVersion: number; grantUserIds: number[]; revokeUserIds: number[] },
  token: string,
): Promise<void> {
  await http.put(`/journal-departments/${departmentId}/access`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
