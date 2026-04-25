import type { OrganizationProfile } from '../types/common';
import { http } from '../api/http';

export async function fetchOrganization(): Promise<OrganizationProfile> {
  const { data } = await http.get<OrganizationProfile>('/organization');
  return data;
}

export async function uploadOrganizationLogo(file: File, token: string): Promise<OrganizationProfile> {
  const formData = new FormData();
  formData.append('logo', file);
  const { data } = await http.post<OrganizationProfile>('/organization/logo', formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
}

export async function deleteOrganizationLogo(token: string): Promise<OrganizationProfile> {
  const { data } = await http.delete<OrganizationProfile>('/organization/logo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function uploadOrganizationHero(file: File, token: string): Promise<OrganizationProfile> {
  const formData = new FormData();
  formData.append('hero', file);
  const { data } = await http.post<OrganizationProfile>('/organization/hero', formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
}

export async function deleteOrganizationHero(token: string): Promise<OrganizationProfile> {
  const { data } = await http.delete<OrganizationProfile>('/organization/hero', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}
