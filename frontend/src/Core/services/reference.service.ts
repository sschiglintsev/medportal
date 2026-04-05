import { http } from '../api/http';
import type { Department, IncidentType } from '../types/common';

export async function fetchDepartments(): Promise<Department[]> {
  const { data } = await http.get<Department[]>('/departments');
  return data;
}

export async function fetchIncidentTypes(): Promise<IncidentType[]> {
  const { data } = await http.get<IncidentType[]>('/incident-types');
  return data;
}
