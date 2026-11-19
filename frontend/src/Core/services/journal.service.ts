import type { Journal, JournalColumn, JournalRow } from '../types/common';
import { http } from '../api/http';

export type JournalsResponse = Journal[];

export async function fetchJournals(
  token: string,
  scope: 'available' | 'own' | 'all' = 'available',
): Promise<Journal[]> {
  const { data } = await http.get<Journal[]>('/journals', {
    headers: { Authorization: `Bearer ${token}` },
    params: { scope },
  });
  return data;
}

export async function fetchJournal(id: number, token: string): Promise<Journal> {
  const { data } = await http.get<Journal>(`/journals/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function createJournal(
  payload: { title: string; departmentId: number; columns: Array<{ title: string; type: string; sort_order: number }> },
  token: string,
): Promise<{ id: number }> {
  const { data } = await http.post<{ id: number }>('/journals', payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function updateJournal(
  id: number,
  payload: { title: string; expectedVersion: number },
  token: string,
): Promise<void> {
  await http.patch(`/journals/${id}`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updateJournalColumns(
  id: number,
  columns: Omit<JournalColumn, 'journal_id'>[],
  token: string,
): Promise<void> {
  await http.put(`/journals/${id}/columns`, { columns }, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function publishJournal(id: number, token: string): Promise<void> {
  await http.post(`/journals/${id}/publish`, {}, { headers: { Authorization: `Bearer ${token}` } });
}

export async function archiveJournal(id: number, token: string): Promise<void> {
  await http.post(`/journals/${id}/archive`, {}, { headers: { Authorization: `Bearer ${token}` } });
}

export async function restoreJournal(id: number, token: string): Promise<void> {
  await http.post(`/journals/${id}/restore`, {}, { headers: { Authorization: `Bearer ${token}` } });
}

// Строки

export type RowsResponse = { total: number; page: number; limit: number; rows: JournalRow[] };

export async function fetchJournalRows(
  journalId: number,
  token: string,
  page = 1,
  limit = 100,
): Promise<RowsResponse> {
  const { data } = await http.get<RowsResponse>(`/journals/${journalId}/rows`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { page, limit },
  });
  return data;
}

export async function addJournalRow(
  journalId: number,
  values: Record<string, string | null>,
  token: string,
): Promise<{ id: number }> {
  const { data } = await http.post<{ id: number }>(`/journals/${journalId}/rows`, { values }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function updateJournalRow(
  journalId: number,
  rowId: number,
  values: Record<string, string | null>,
  expectedRevision: number,
  token: string,
): Promise<void> {
  await http.patch(`/journals/${journalId}/rows/${rowId}`, { values, expectedRevision }, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function deleteJournalRow(
  journalId: number,
  rowId: number,
  token: string,
): Promise<void> {
  await http.delete(`/journals/${journalId}/rows/${rowId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function copyJournalRow(
  journalId: number,
  rowId: number,
  payload: { count: number; dateColumnId?: string; stepDays?: number; expectedRevision: number; idempotencyKey?: string },
  token: string,
): Promise<void> {
  await http.post(`/journals/${journalId}/rows/${rowId}/copy`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function confirmJournalRow(
  journalId: number,
  rowId: number,
  payload: {
    expectedRevision: number;
    password: string;
    idempotencyKey?: string;
    /** Значения для колонок с is_editable_by_employee=true */
    editableValues?: Record<string, string | null>;
  },
  token: string,
): Promise<void> {
  await http.post(`/journals/${journalId}/rows/${rowId}/confirm`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function correctJournalRow(
  journalId: number,
  rowId: number,
  payload: { values: Record<string, string | null>; reason: string; expectedRevision: number },
  token: string,
): Promise<void> {
  await http.post(`/journals/${journalId}/rows/${rowId}/corrections`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function fetchRowHistory(
  journalId: number,
  rowId: number,
  token: string,
): Promise<unknown> {
  const { data } = await http.get(`/journals/${journalId}/rows/${rowId}/history`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}
