import { http } from '../api/http';

export type MaxLinkStatus = {
  linked: boolean;
  maxUserId: string | null;
  verifiedAt: string | null;
  notificationsEnabled: boolean;
};

type AuthHeader = { token: string };

export async function fetchMaxLinkStatus(auth: AuthHeader): Promise<MaxLinkStatus> {
  const { data } = await http.get<MaxLinkStatus>('/users/me/max-link', {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  return data;
}

export async function startMaxLink(auth: AuthHeader, maxUserId: string): Promise<void> {
  await http.post(
    '/users/me/max-link/start',
    { maxUserId },
    { headers: { Authorization: `Bearer ${auth.token}` } },
  );
}

export async function verifyMaxLink(auth: AuthHeader, code: string): Promise<void> {
  await http.post(
    '/users/me/max-link/verify',
    { code },
    { headers: { Authorization: `Bearer ${auth.token}` } },
  );
}

export async function unlinkMax(auth: AuthHeader): Promise<void> {
  await http.delete('/users/me/max-link', {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
}

export async function toggleMaxNotifications(auth: AuthHeader, enabled: boolean): Promise<void> {
  await http.patch(
    '/users/me/max-link/notifications',
    { enabled },
    { headers: { Authorization: `Bearer ${auth.token}` } },
  );
}
