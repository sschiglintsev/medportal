import { Request, Response, NextFunction } from 'express';

import { withDbClient } from '../db';

export async function getHealth(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await withDbClient((client) => client.query('SELECT NOW() AS server_time'));

    res.status(200).json({
      ok: true,
      serverTime: result.rows[0]?.server_time ?? null,
    });
  } catch (error) {
    next(error);
  }
}
