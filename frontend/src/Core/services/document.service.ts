import { http } from '../api/http';
import type { PortalDocument } from '../types/common';

type AuthHeader = {
  token: string;
};

export type DocumentPayload = {
  folder_id?: number | null;
  title: string;
  description?: string;
  file?: File;
};

export async function fetchDocuments(folderId?: number): Promise<PortalDocument[]> {
  const params = folderId != null ? { folder_id: folderId } : {};
  const { data } = await http.get<PortalDocument[]>('/documents', { params });
  return data;
}

export async function createDocument(payload: DocumentPayload, auth: AuthHeader): Promise<PortalDocument> {
  const formData = new FormData();
  if (payload.folder_id != null) {
    formData.append('folder_id', String(payload.folder_id));
  }
  formData.append('title', payload.title);
  if (payload.description) {
    formData.append('description', payload.description);
  }
  if (payload.file) {
    formData.append('file', payload.file);
  }

  const { data } = await http.post<PortalDocument>('/documents', formData, {
    headers: {
      Authorization: `Bearer ${auth.token}`,
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
}

export async function updateDocument(
  id: number,
  payload: DocumentPayload,
  auth: AuthHeader,
): Promise<PortalDocument> {
  const formData = new FormData();
  if (payload.folder_id != null) {
    formData.append('folder_id', String(payload.folder_id));
  }
  formData.append('title', payload.title);
  if (payload.description) {
    formData.append('description', payload.description);
  }
  if (payload.file) {
    formData.append('file', payload.file);
  }

  const { data } = await http.put<PortalDocument>(`/documents/${id}`, formData, {
    headers: {
      Authorization: `Bearer ${auth.token}`,
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
}

export async function deleteDocument(id: number, auth: AuthHeader): Promise<void> {
  await http.delete(`/documents/${id}`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
}
