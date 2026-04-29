import { http } from '../api/http';
import type { Announcement } from '../types/common';

export type AnnouncementPayload = {
  title: string;
  description: string;
  full_description: string;
  published_date: string;
  image_url?: string;
};

type AuthHeader = {
  token: string;
};

export async function fetchAnnouncements(): Promise<Announcement[]> {
  const { data } = await http.get<Announcement[]>('/announcements');
  return data;
}

export async function createAnnouncement(
  payload: AnnouncementPayload,
  auth: AuthHeader,
): Promise<Announcement> {
  const { data } = await http.post<Announcement>('/announcements', payload, {
    headers: {
      Authorization: `Bearer ${auth.token}`,
    },
  });
  return data;
}

export async function updateAnnouncement(
  id: number,
  payload: AnnouncementPayload,
  auth: AuthHeader,
): Promise<Announcement> {
  const { data } = await http.put<Announcement>(`/announcements/${id}`, payload, {
    headers: {
      Authorization: `Bearer ${auth.token}`,
    },
  });
  return data;
}

export async function deleteAnnouncement(id: number, auth: AuthHeader): Promise<void> {
  await http.delete(`/announcements/${id}`, {
    headers: {
      Authorization: `Bearer ${auth.token}`,
    },
  });
}
