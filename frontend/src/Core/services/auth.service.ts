import axios from 'axios';

import type { AuthResponse, RoleOption } from '../types/common';

const authApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

type LoginPayload = {
  username: string;
  password: string;
};

type RegisterPayload = {
  username: string;
  fullName: string;
  role: string;
  password: string;
};

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await authApi.post<AuthResponse>('/auth/login', payload);
  return data;
}

export async function register(payload: RegisterPayload): Promise<void> {
  await authApi.post('/auth/register', payload);
}

export async function fetchRegistrationRoles(): Promise<RoleOption[]> {
  const { data } = await authApi.get<RoleOption[]>('/auth/roles');
  return data;
}
