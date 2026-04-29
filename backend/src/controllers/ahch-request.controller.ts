import { NextFunction, Request, Response } from 'express';

import { withDbClient } from '../db';

const ALLOWED_STATUSES = ['new', 'in_progress', 'done', 'cancelled'] as const;
type AhchRequestStatus = (typeof ALLOWED_STATUSES)[number];

type CreateAhchRequestBody = {
  address: string;
  department: string;
  request_text: string;
  employee_phone: string;
};

export async function createAhchRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Partial<CreateAhchRequestBody>;
    const address = body.address?.trim();
    const department = body.department?.trim();
    const requestText = body.request_text?.trim();
    const employeePhone = body.employee_phone?.trim();

    if (!address || !department || !requestText || !employeePhone) {
      res.status(400).json({ message: 'Missing required fields' });
      return;
    }

    const result = await withDbClient((client) =>
      client.query(
        `INSERT INTO ahch_requests (address, department, request_text, employee_phone)
         VALUES ($1, $2, $3, $4)
         RETURNING id, status, created_at`,
        [address, department, requestText, employeePhone],
      ),
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function getAhchRequests(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await withDbClient((client) =>
      client.query(
        `SELECT id, address, department, request_text, employee_phone, status, comment, created_at
         FROM ahch_requests
         ORDER BY created_at DESC`,
      ),
    );

    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function updateAhchRequestStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    const { status } = req.body as { status: AhchRequestStatus };

    if (!ALLOWED_STATUSES.includes(status)) {
      res.status(400).json({ message: `Недопустимый статус. Допустимые значения: ${ALLOWED_STATUSES.join(', ')}` });
      return;
    }

    const result = await withDbClient((client) =>
      client.query(
        `UPDATE ahch_requests SET status = $1 WHERE id = $2 RETURNING id, status`,
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

export async function updateAhchRequestComment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    const { comment } = req.body as { comment: string };

    const result = await withDbClient((client) =>
      client.query(
        `UPDATE ahch_requests SET comment = $1 WHERE id = $2 RETURNING id, comment`,
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

export async function getAhchRequestByIdPublic(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      res.status(400).json({ message: 'Некорректный номер заявки' });
      return;
    }

    const result = await withDbClient((client) =>
      client.query(
        `SELECT id, address, department, request_text, status, comment, created_at
         FROM ahch_requests WHERE id = $1`,
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
