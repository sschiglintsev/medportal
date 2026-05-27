import { http } from '../api/http';
import type { TransportRequest } from '../types/common';

export type CreateTransportRequestPayload = {
  department: string;
  initiator: string;
  submission_date: string;
  submission_time: string;
  route_from: string;
  route_to: string;
  purpose: string;
  passenger_count: number;
  special_notes?: string;
};

export type CreateTransportRequestResponse = {
  id: number;
  status: string;
  created_at: string;
};

export type PublicTransportRequest = TransportRequest;

export type TransportRequestStatus = 'new' | 'in_progress' | 'done' | 'cancelled';

type AuthHeader = { token: string };

export async function createTransportRequest(
  payload: CreateTransportRequestPayload,
): Promise<CreateTransportRequestResponse> {
  const { data } = await http.post<CreateTransportRequestResponse>('/transport-requests', payload);
  return data;
}

export async function fetchTransportRequestPublic(id: number): Promise<PublicTransportRequest> {
  const { data } = await http.get<PublicTransportRequest>(`/transport-requests/${id}/public`);
  return data;
}

export async function fetchTransportRequests(auth: AuthHeader): Promise<TransportRequest[]> {
  const { data } = await http.get<TransportRequest[]>('/transport-requests', {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  return data;
}

export async function updateTransportRequestStatus(
  id: number,
  status: TransportRequestStatus,
  auth: AuthHeader,
): Promise<void> {
  await http.patch(
    `/transport-requests/${id}/status`,
    { status },
    { headers: { Authorization: `Bearer ${auth.token}` } },
  );
}

export async function updateTransportRequestComment(
  id: number,
  comment: string,
  auth: AuthHeader,
): Promise<void> {
  await http.patch(
    `/transport-requests/${id}/comment`,
    { comment },
    { headers: { Authorization: `Bearer ${auth.token}` } },
  );
}
