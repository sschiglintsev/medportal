import { NextFunction, Request, Response } from 'express';

import { withDbClient } from '../db';

export async function getUrgencyLevels(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await withDbClient((client) =>
      client.query(`SELECT id, name, days FROM urgency_levels ORDER BY days ASC`),
    );
    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
}
