import { http } from '../api/http';

export type RequestType = 'incident' | 'it' | 'metrologist' | 'ahch' | 'transport';

export type AnalyticsPoint = {
  date: string;
  type: RequestType;
  count: number;
};

export async function fetchRequestsAnalytics(
  from: string,
  to: string,
  token: string,
): Promise<AnalyticsPoint[]> {
  const { data } = await http.get<AnalyticsPoint[]>('/analytics/requests', {
    params: { from, to },
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}
