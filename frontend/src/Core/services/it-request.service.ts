import { http } from '../api/http';
import type { ItRequest } from '../types/common';

export type PublicItRequest = Pick<ItRequest, 'id' | 'full_name' | 'department' | 'location' | 'request_text' | 'status' | 'comment' | 'created_at'>;

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

export type ItRequestStatus = 'new' | 'in_progress' | 'done' | 'cancelled';

export async function updateItRequestComment(
  id: number,
  comment: string,
  auth: AuthHeader,
): Promise<void> {
  await http.patch(
    `/it-requests/${id}/comment`,
    { comment },
    { headers: { Authorization: `Bearer ${auth.token}` } },
  );
}

export async function fetchItRequestPublic(id: number): Promise<PublicItRequest> {
  const { data } = await http.get<PublicItRequest>(`/it-requests/${id}/public`);
  return data;
}

export async function updateItRequestStatus(
  id: number,
  status: ItRequestStatus,
  auth: AuthHeader,
): Promise<void> {
  await http.patch(
    `/it-requests/${id}/status`,
    { status },
    { headers: { Authorization: `Bearer ${auth.token}` } },
  );
}
