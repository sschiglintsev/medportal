import axios from 'axios';

import type { Department, Incident, IncidentType, IncidentViewType } from '../types/common';

const incidentApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export type CreateIncidentPayload = {
  incident_date: string;
  incident_time: string;
  place: string;
  patient_fio: string;
  patient_birth_date: string;
  circumstances: string;
  employee_fio: string;
  employee_position: string;
  legal_presence: string;
  department_id: number;
  incident_view_type_id?: number;
  incident_type_id: number;
  consequences: string;
  severity_level?: string;
};

export type CreateIncidentResponse = {
  id: number;
  status: string;
  created_at: string;
};

type CreateNamedReferencePayload = {
  name: string;
};

type CreateDepartmentPayload = {
  name: string;
  care_type?: string;
};

type CreateIncidentViewTypePayload = {
  name: string;
  care_type: string;
};

export async function fetchDepartments(): Promise<Department[]> {
  const { data } = await incidentApi.get<Department[]>('/departments');
  return data;
}

export async function fetchIncidentTypes(): Promise<IncidentType[]> {
  const { data } = await incidentApi.get<IncidentType[]>('/incident-types');
  return data;
}

export async function fetchIncidentViewTypesPublic(): Promise<IncidentViewType[]> {
  const { data } = await incidentApi.get<IncidentViewType[]>('/incident-view-types');
  return data;
}

type AuthHeader = {
  token: string;
};

export async function createDepartment(
  payload: CreateDepartmentPayload,
  auth: AuthHeader,
): Promise<Department> {
  const { data } = await incidentApi.post<Department>('/departments', payload, {
    headers: {
      Authorization: `Bearer ${auth.token}`,
    },
  });
  return data;
}

export async function fetchIncidentViewTypes(auth: AuthHeader): Promise<IncidentViewType[]> {
  const { data } = await incidentApi.get<IncidentViewType[]>('/incident-view-types', {
    headers: {
      Authorization: `Bearer ${auth.token}`,
    },
  });
  return data;
}

export async function createIncidentViewType(
  payload: CreateIncidentViewTypePayload,
  auth: AuthHeader,
): Promise<IncidentViewType> {
  const { data } = await incidentApi.post<IncidentViewType>('/incident-view-types', payload, {
    headers: {
      Authorization: `Bearer ${auth.token}`,
    },
  });
  return data;
}

export async function createIncidentType(
  payload: CreateNamedReferencePayload,
  auth: AuthHeader,
): Promise<IncidentType> {
  const { data } = await incidentApi.post<IncidentType>('/incident-types', payload, {
    headers: {
      Authorization: `Bearer ${auth.token}`,
    },
  });
  return data;
}

export async function updateDepartment(
  id: number,
  payload: CreateDepartmentPayload,
  auth: AuthHeader,
): Promise<Department> {
  const { data } = await incidentApi.put<Department>(`/departments/${id}`, payload, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  return data;
}

export async function deleteDepartment(id: number, auth: AuthHeader): Promise<void> {
  await incidentApi.delete(`/departments/${id}`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
}

export async function updateIncidentType(
  id: number,
  payload: CreateNamedReferencePayload,
  auth: AuthHeader,
): Promise<IncidentType> {
  const { data } = await incidentApi.put<IncidentType>(`/incident-types/${id}`, payload, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  return data;
}

export async function deleteIncidentType(id: number, auth: AuthHeader): Promise<void> {
  await incidentApi.delete(`/incident-types/${id}`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
}

export async function updateIncidentViewType(
  id: number,
  payload: CreateIncidentViewTypePayload,
  auth: AuthHeader,
): Promise<IncidentViewType> {
  const { data } = await incidentApi.put<IncidentViewType>(`/incident-view-types/${id}`, payload, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  return data;
}

export async function deleteIncidentViewType(id: number, auth: AuthHeader): Promise<void> {
  await incidentApi.delete(`/incident-view-types/${id}`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
}

export async function fetchLinkedIncidentTypes(viewTypeId: number, auth: AuthHeader): Promise<IncidentType[]> {
  const { data } = await incidentApi.get<IncidentType[]>(`/incident-view-types/${viewTypeId}/incident-types`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  return data;
}

export async function addIncidentTypeToViewType(
  viewTypeId: number,
  incidentTypeId: number,
  auth: AuthHeader,
): Promise<void> {
  await incidentApi.post(
    `/incident-view-types/${viewTypeId}/incident-types`,
    { incident_type_id: incidentTypeId },
    { headers: { Authorization: `Bearer ${auth.token}` } },
  );
}

export async function removeIncidentTypeFromViewType(
  viewTypeId: number,
  incidentTypeId: number,
  auth: AuthHeader,
): Promise<void> {
  await incidentApi.delete(`/incident-view-types/${viewTypeId}/incident-types/${incidentTypeId}`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
}

export async function syncIncidentTypesForViewType(
  viewTypeId: number,
  incidentTypeIds: number[],
  auth: AuthHeader,
): Promise<void> {
  await incidentApi.put(
    `/incident-view-types/${viewTypeId}/incident-types`,
    { incident_type_ids: incidentTypeIds },
    { headers: { Authorization: `Bearer ${auth.token}` } },
  );
}

export async function createIncident(
  payload: CreateIncidentPayload,
): Promise<CreateIncidentResponse> {
  const { data } = await incidentApi.post<CreateIncidentResponse>('/incidents', payload);
  return data;
}

export async function fetchIncidents(auth: AuthHeader): Promise<Incident[]> {
  const { data } = await incidentApi.get<Incident[]>('/incidents', {
    headers: {
      Authorization: `Bearer ${auth.token}`,
    },
  });
  return data;
}
