import { http } from '../api/http';
import type { ItRequest } from '../types/common';

export type CreateItRequestPayload = {
  full_name: string;
  phone: string;
  department: string;
  location: string;
  request_text: string;
};

export async function createItRequest(payload: CreateItRequestPayload): Promise<void> {
  await http.post('/it-requests', payload);
}

type AuthHeader = {
  token: string;
};

export async function fetchItRequests(auth: AuthHeader): Promise<ItRequest[]> {
  const { data } = await http.get<ItRequest[]>('/it-requests', {
    headers: {
      Authorization: `Bearer ${auth.token}`,
    },
  });
  return data;
}
