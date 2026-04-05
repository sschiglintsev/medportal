import axios from 'axios';

import type { Department, Incident, IncidentType } from '../types/common';

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
  incident_type_id: number;
  consequences: string;
};

export type CreateIncidentResponse = {
  id: number;
  status: string;
  created_at: string;
};

type CreateNamedReferencePayload = {
  name: string;
};

export async function fetchDepartments(): Promise<Department[]> {
  const { data } = await incidentApi.get<Department[]>('/departments');
  return data;
}

export async function fetchIncidentTypes(): Promise<IncidentType[]> {
  const { data } = await incidentApi.get<IncidentType[]>('/incident-types');
  return data;
}

type AuthHeader = {
  token: string;
};

export async function createDepartment(
  payload: CreateNamedReferencePayload,
  auth: AuthHeader,
): Promise<Department> {
  const { data } = await incidentApi.post<Department>('/departments', payload, {
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
