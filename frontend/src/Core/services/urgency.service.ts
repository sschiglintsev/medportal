import { http } from '../api/http';
import type { UrgencyLevel } from '../types/common';

export async function fetchUrgencyLevels(): Promise<UrgencyLevel[]> {
  const { data } = await http.get<UrgencyLevel[]>('/urgency-levels');
  return data;
}
