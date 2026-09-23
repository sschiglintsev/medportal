import { NextFunction, Request, Response } from 'express';

import { withDbClient } from '../db';
import { notifyRoleUsers } from '../services/max-bot.service';

const ALLOWED_STATUSES = ['new', 'in_progress', 'done', 'cancelled'] as const;
type AhchRequestStatus = (typeof ALLOWED_STATUSES)[number];

const STATUS_LABELS_RU: Record<AhchRequestStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  done: 'Выполнена',
  cancelled: 'Отменена',
};

type CreateAhchRequestBody = {
  address: string;
  department: string;
  request_text: string;
  employee_phone: string;
  urgency_id?: number;
};

export async function createAhchRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Partial<CreateAhchRequestBody>;
    const address = body.address?.trim();
    const department = body.department?.trim();
    const requestText = body.request_text?.trim();
    const employeePhone = body.employee_phone?.trim();
    const urgencyId = body.urgency_id ? Number(body.urgency_id) : null;

    if (!address || !department || !requestText || !employeePhone) {
      res.status(400).json({ message: 'Missing required fields' });
      return;
    }

    const result = await withDbClient((client) =>
      client.query(
        `WITH ins AS (
           INSERT INTO ahch_requests (address, department, request_text, employee_phone, urgency_id)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, status, created_at, urgency_id
         )
         SELECT ins.id, ins.status, ins.created_at, ul.name AS urgency_name
         FROM ins
         LEFT JOIN urgency_levels ul ON ul.id = ins.urgency_id`,
        [address, department, requestText, employeePhone, urgencyId],
      ),
    );

    const created = result.rows[0] as { id: number; status: string; created_at: string; urgency_name: string | null };

    const urgencyLine = created.urgency_name ? `\nСрочность: ${created.urgency_name}` : '';

    void notifyRoleUsers(
      'facility',
      `Новая заявка в АХЧ #${created.id}\nАдрес: ${address}\nОтделение: ${department}\nТелефон: ${employeePhone}${urgencyLine}\nОписание: ${requestText.slice(0, 200)}`,
    );

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
}

export async function getAhchRequests(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await withDbClient((client) =>
      client.query(
        `SELECT r.id, r.address, r.department, r.request_text, r.employee_phone,
                r.status, r.comment, r.created_at,
                ul.name AS urgency_name, ul.days AS urgency_days
         FROM ahch_requests r
         LEFT JOIN urgency_levels ul ON ul.id = r.urgency_id
         ORDER BY r.created_at DESC`,
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
        `WITH upd AS (
           UPDATE ahch_requests SET status = $1 WHERE id = $2
           RETURNING id, status, department, address, employee_phone, request_text, urgency_id
         )
         SELECT upd.*, ul.name AS urgency_name
         FROM upd
         LEFT JOIN urgency_levels ul ON ul.id = upd.urgency_id`,
        [status, id],
      ),
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Заявка не найдена' });
      return;
    }

    const updated = result.rows[0] as {
      id: number;
      status: string;
      department: string;
      address: string;
      employee_phone: string;
      request_text: string;
      urgency_name: string | null;
    };

    const urgencyLine = updated.urgency_name ? `\nСрочность: ${updated.urgency_name}` : '';

    void notifyRoleUsers(
      'facility',
      `Статус заявки в АХЧ #${updated.id} изменён на «${STATUS_LABELS_RU[status]}»\n` +
      `Отделение: ${updated.department}\n` +
      `Адрес: ${updated.address}\n` +
      `Телефон: ${updated.employee_phone}${urgencyLine}\n` +
      `Описание: ${updated.request_text.slice(0, 200)}`,
    );

    res.status(200).json(updated);
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
