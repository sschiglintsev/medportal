import type { EmployeeItem } from '../types/common';
import { http } from '../api/http';

export type EmployeesResponse = {
  total: number;
  page: number;
  limit: number;
  items: EmployeeItem[];
};

export type CreateEmployeePayload = {
  fullName: string;
  employeeCode?: string;
  departments: Array<{ departmentId: number; position: string }>;
};

export type CreateEmployeeResponse = {
  userId: number;
  username: string;
  employeeCode: string;
  credentials: { username: string; temporaryPassword: string };
};

export async function fetchEmployees(
  token: string,
  params: {
    q?: string;
    departmentId?: number;
    role?: string;
    active?: boolean;
    page?: number;
    limit?: number;
  } = {},
): Promise<EmployeesResponse> {
  const { data } = await http.get<EmployeesResponse>('/employees', {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
  return data;
}

export async function fetchEmployee(id: number, token: string): Promise<EmployeeItem> {
  const { data } = await http.get<EmployeeItem>(`/employees/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function createEmployee(
  payload: CreateEmployeePayload,
  token: string,
): Promise<CreateEmployeeResponse> {
  const { data } = await http.post<CreateEmployeeResponse>('/employees', payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function updateEmployee(
  id: number,
  payload: {
    fullName?: string;
    profileVersion?: number;
    departments?: Array<{ departmentId: number; position: string; isActive: boolean; deptVersion: number }>;
  },
  token: string,
): Promise<void> {
  await http.patch(`/employees/${id}`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function setEmployeeStatus(
  id: number,
  isActive: boolean,
  token: string,
): Promise<void> {
  await http.patch(`/employees/${id}/status`, { isActive }, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function resetEmployeePassword(
  id: number,
  token: string,
): Promise<{ temporaryPassword: string; expiresAt: string }> {
  const { data } = await http.post<{ temporaryPassword: string; expiresAt: string }>(
    `/employees/${id}/reset-password`,
    {},
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return data;
}

export async function exportEmployees(token: string): Promise<unknown[]> {
  const { data } = await http.get<unknown[]>('/employees/export', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export type ImportPreviewPayload = {
  sourceSheet: string;
  items: Array<{
    sourceRow: number;
    fullName: string;
    departmentName: string;
    position: string;
    employeeCode?: string;
  }>;
};

export type ImportPreviewResponse = {
  batchId: string;
  previewVersion: number;
  canCommit: boolean;
  expiresAt: string;
  summary: {
    newUsers: number;
    newMemberships: number;
    unchanged: number;
    conflicts: number;
    errors: number;
  };
  rows: Array<{
    sourceRow: number;
    status: string;
    message?: string;
    fullName: string;
    departmentName: string;
    position: string;
    employeeCode?: string;
  }>;
};

export async function importPreview(
  payload: ImportPreviewPayload,
  token: string,
): Promise<ImportPreviewResponse> {
  const { data } = await http.post<ImportPreviewResponse>('/employees/import/preview', payload, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 30000,
  });
  return data;
}

export type ImportCommitResponse = {
  batchId: string;
  summary: { created: number; processed: number };
  newCredentials?: Array<{
    fullName: string;
    username: string;
    temporaryPassword: string;
    employeeCode: string;
    department: string;
    position: string;
  }>;
};

export async function importCommit(
  batchId: string,
  idempotencyKey: string,
  token: string,
): Promise<ImportCommitResponse> {
  const { data } = await http.post<ImportCommitResponse>(
    `/employees/import/${batchId}/commit`,
    { batchId, idempotencyKey },
    { headers: { Authorization: `Bearer ${token}` }, timeout: 60000 },
  );
  return data;
}
