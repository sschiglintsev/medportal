import type { UserListItem } from '../types/common';
import { http } from '../api/http';

export async function fetchUsers(token: string): Promise<UserListItem[]> {
  const { data } = await http.get<UserListItem[]>('/users', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function updateUser(
  id: number,
  payload: { fullName?: string; role?: string; password?: string },
  token: string,
): Promise<UserListItem> {
  const { data } = await http.put<UserListItem>(`/users/${id}`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function deleteUser(id: number, token: string): Promise<void> {
  await http.delete(`/users/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
