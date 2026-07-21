import { http } from '../api/http';
import type { DocumentFolder } from '../types/common';

type AuthHeader = {
  token: string;
};

export async function fetchFolders(): Promise<DocumentFolder[]> {
  const { data } = await http.get<DocumentFolder[]>('/document-folders');
  return data;
}

export async function createFolder(
  payload: { name: string; parent_id?: number | null },
  auth: AuthHeader,
): Promise<DocumentFolder> {
  const { data } = await http.post<DocumentFolder>('/document-folders', payload, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  return data;
}

export async function updateFolder(
  id: number,
  payload: { name: string },
  auth: AuthHeader,
): Promise<DocumentFolder> {
  const { data } = await http.put<DocumentFolder>(`/document-folders/${id}`, payload, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  return data;
}

export async function deleteFolder(id: number, auth: AuthHeader): Promise<void> {
  await http.delete(`/document-folders/${id}`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
}

export type FolderNode = DocumentFolder & { children: FolderNode[] };

export function buildFolderTree(folders: DocumentFolder[], parentId: number | null = null): FolderNode[] {
  return folders
    .filter((f) => f.parent_id === parentId)
    .map((f) => ({ ...f, children: buildFolderTree(folders, f.id) }));
}

export function getFolderPath(folders: DocumentFolder[], folderId: number): DocumentFolder[] {
  const path: DocumentFolder[] = [];
  let current = folders.find((f) => f.id === folderId);
  while (current) {
    path.unshift(current);
    const parentId = current.parent_id;
    current = parentId != null ? folders.find((f) => f.id === parentId) : undefined;
  }
  return path;
}
