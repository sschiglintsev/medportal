import { http } from '../api/http';
import type { AhchRequest } from '../types/common';

export type CreateAhchRequestPayload = {
  address: string;
  department: string;
  request_text: string;
  employee_phone: string;
};

export type CreateAhchRequestResponse = {
  id: number;
  status: string;
  created_at: string;
};

export async function createAhchRequest(
  payload: CreateAhchRequestPayload,
): Promise<CreateAhchRequestResponse> {
  const { data } = await http.post<CreateAhchRequestResponse>('/ahch-requests', payload);
  return data;
}

type AuthHeader = {
  token: string;
};

export async function fetchAhchRequests(auth: AuthHeader): Promise<AhchRequest[]> {
  const { data } = await http.get<AhchRequest[]>('/ahch-requests', {
    headers: {
      Authorization: `Bearer ${auth.token}`,
    },
  });
  return data;
}

export type PublicAhchRequest = Pick<
  AhchRequest,
  'id' | 'address' | 'department' | 'request_text' | 'status' | 'comment' | 'created_at'
>;

export type AhchRequestStatus = 'new' | 'in_progress' | 'done' | 'cancelled';

export async function updateAhchRequestStatus(
  id: number,
  status: AhchRequestStatus,
  auth: AuthHeader,
): Promise<void> {
  await http.patch(
    `/ahch-requests/${id}/status`,
    { status },
    { headers: { Authorization: `Bearer ${auth.token}` } },
  );
}

export async function updateAhchRequestComment(id: number, comment: string, auth: AuthHeader): Promise<void> {
  await http.patch(
    `/ahch-requests/${id}/comment`,
    { comment },
    { headers: { Authorization: `Bearer ${auth.token}` } },
  );
}

export async function fetchAhchRequestPublic(id: number): Promise<PublicAhchRequest> {
  const { data } = await http.get<PublicAhchRequest>(`/ahch-requests/${id}/public`);
  return data;
}
