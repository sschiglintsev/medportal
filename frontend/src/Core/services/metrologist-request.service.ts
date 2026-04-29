import { http } from '../api/http';
import type { MetrologistRequest } from '../types/common';

export type CreateMetrologistRequestPayload = {
  full_name: string;
  phone: string;
  department: string;
  location: string;
  request_text: string;
};

export type CreateMetrologistRequestResponse = {
  id: number;
  status: string;
  created_at: string;
};

export async function createMetrologistRequest(
  payload: CreateMetrologistRequestPayload,
): Promise<CreateMetrologistRequestResponse> {
  const { data } = await http.post<CreateMetrologistRequestResponse>('/metrologist-requests', payload);
  return data;
}

type AuthHeader = {
  token: string;
};

export async function fetchMetrologistRequests(auth: AuthHeader): Promise<MetrologistRequest[]> {
  const { data } = await http.get<MetrologistRequest[]>('/metrologist-requests', {
    headers: {
      Authorization: `Bearer ${auth.token}`,
    },
  });
  return data;
}

export type PublicMetrologistRequest = Pick<
  MetrologistRequest,
  'id' | 'full_name' | 'department' | 'location' | 'request_text' | 'status' | 'comment' | 'created_at'
>;

export type MetrologistRequestStatus = 'new' | 'in_progress' | 'done' | 'cancelled';

export async function updateMetrologistRequestStatus(
  id: number,
  status: MetrologistRequestStatus,
  auth: AuthHeader,
): Promise<void> {
  await http.patch(
    `/metrologist-requests/${id}/status`,
    { status },
    { headers: { Authorization: `Bearer ${auth.token}` } },
  );
}

export async function updateMetrologistRequestComment(
  id: number,
  comment: string,
  auth: AuthHeader,
): Promise<void> {
  await http.patch(
    `/metrologist-requests/${id}/comment`,
    { comment },
    { headers: { Authorization: `Bearer ${auth.token}` } },
  );
}

export async function fetchMetrologistRequestPublic(id: number): Promise<PublicMetrologistRequest> {
  const { data } = await http.get<PublicMetrologistRequest>(`/metrologist-requests/${id}/public`);
  return data;
}
