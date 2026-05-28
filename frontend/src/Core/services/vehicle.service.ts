import { http } from '../api/http';
import type { Vehicle } from '../types/common';

type AuthHeader = { token: string };

export async function fetchVehicles(auth: AuthHeader): Promise<Vehicle[]> {
  const { data } = await http.get<Vehicle[]>('/vehicles', {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  return data;
}

export async function createVehicle(
  payload: { make: string; model: string; license_plate: string; driver?: string },
  auth: AuthHeader,
): Promise<Vehicle> {
  const { data } = await http.post<Vehicle>('/vehicles', payload, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  return data;
}

export async function deleteVehicle(id: number, auth: AuthHeader): Promise<void> {
  await http.delete(`/vehicles/${id}`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
}
