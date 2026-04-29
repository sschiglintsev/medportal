import { NextFunction, Request, Response } from 'express';

import { withDbClient } from '../db';

const ALLOWED_STATUSES = ['new', 'in_progress', 'done', 'cancelled'] as const;
type MetrologistRequestStatus = (typeof ALLOWED_STATUSES)[number];

type CreateMetrologistRequestBody = {
  full_name: string;
  phone: string;
  department: string;
  location: string;
  request_text: string;
};

export async function createMetrologistRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Partial<CreateMetrologistRequestBody>;
    const fullName = body.full_name?.trim();
    const phone = body.phone?.trim();
    const department = body.department?.trim();
    const location = body.location?.trim();
    const requestText = body.request_text?.trim();

    if (!fullName || !phone || !department || !location || !requestText) {
      res.status(400).json({ message: 'Missing required fields' });
      return;
    }

    const result = await withDbClient((client) =>
      client.query(
        `INSERT INTO metrologist_requests (full_name, phone, department, location, request_text)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, status, created_at`,
        [fullName, phone, department, location, requestText],
      ),
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function getMetrologistRequests(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await withDbClient((client) =>
      client.query(
        `SELECT id, full_name, phone, department, location, request_text, status, comment, created_at
         FROM metrologist_requests
         ORDER BY created_at DESC`,
      ),
    );

    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function updateMetrologistRequestStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    const { status } = req.body as { status: MetrologistRequestStatus };

    if (!ALLOWED_STATUSES.includes(status)) {
      res.status(400).json({ message: `Недопустимый статус. Допустимые значения: ${ALLOWED_STATUSES.join(', ')}` });
      return;
    }

    const result = await withDbClient((client) =>
      client.query(
        `UPDATE metrologist_requests SET status = $1 WHERE id = $2 RETURNING id, status`,
        [status, id],
      ),
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Заявка не найдена' });
      return;
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function updateMetrologistRequestComment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    const { comment } = req.body as { comment: string };

    const result = await withDbClient((client) =>
      client.query(
        `UPDATE metrologist_requests SET comment = $1 WHERE id = $2 RETURNING id, comment`,
        [comment ?? null, id],
      ),
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Заявка не найдена' });
      return;
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function getMetrologistRequestByIdPublic(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      res.status(400).json({ message: 'Некорректный номер заявки' });
      return;
    }

    const result = await withDbClient((client) =>
      client.query(
        `SELECT id, full_name, department, location, request_text, status, comment, created_at
         FROM metrologist_requests WHERE id = $1`,
        [id],
      ),
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Заявка не найдена' });
      return;
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}
