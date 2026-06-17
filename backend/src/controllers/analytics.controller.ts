import { Response, NextFunction } from 'express';

import { withDbClient } from '../db';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware';

export async function getRequestsAnalytics(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { from, to } = req.query as { from?: string; to?: string };

    if (!from || !to) {
      res.status(400).json({ message: 'Параметры from и to обязательны' });
      return;
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(from) || !dateRegex.test(to)) {
      res.status(400).json({ message: 'Формат дат: YYYY-MM-DD' });
      return;
    }

    if (from > to) {
      res.status(400).json({ message: 'Дата from не может быть позже to' });
      return;
    }

    const result = await withDbClient((client) =>
      client.query(
        `SELECT DATE(created_at) AS date, 'incident' AS type, COUNT(*)::int AS count
           FROM incidents
           WHERE created_at::date BETWEEN $1 AND $2
           GROUP BY DATE(created_at)
         UNION ALL
         SELECT DATE(created_at), 'it', COUNT(*)::int
           FROM it_requests
           WHERE created_at::date BETWEEN $1 AND $2
           GROUP BY DATE(created_at)
         UNION ALL
         SELECT DATE(created_at), 'metrologist', COUNT(*)::int
           FROM metrologist_requests
           WHERE created_at::date BETWEEN $1 AND $2
           GROUP BY DATE(created_at)
         UNION ALL
         SELECT DATE(created_at), 'ahch', COUNT(*)::int
           FROM ahch_requests
           WHERE created_at::date BETWEEN $1 AND $2
           GROUP BY DATE(created_at)
         UNION ALL
         SELECT DATE(created_at), 'transport', COUNT(*)::int
           FROM transport_requests
           WHERE created_at::date BETWEEN $1 AND $2
           GROUP BY DATE(created_at)
         ORDER BY date`,
        [from, to],
      ),
    );

    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
}
