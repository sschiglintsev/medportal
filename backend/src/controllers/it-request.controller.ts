import { NextFunction, Request, Response } from 'express';

import { withDbClient } from '../db';
import { notifyRoleUsers } from '../services/max-bot.service';

const ALLOWED_STATUSES = ['new', 'in_progress', 'done', 'cancelled'] as const;
type ItRequestStatus = (typeof ALLOWED_STATUSES)[number];

const STATUS_LABELS_RU: Record<ItRequestStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  done: 'Выполнена',
  cancelled: 'Отменена',
};

type CreateItRequestBody = {
  full_name: string;
  phone: string;
  department: string;
  location: string;
  request_text: string;
  remote_access_id?: string;
  urgency_id?: number;
};

export async function createItRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Partial<CreateItRequestBody>;
    const fullName = body.full_name?.trim();
    const phone = body.phone?.trim();
    const department = body.department?.trim();
    const location = body.location?.trim();
    const requestText = body.request_text?.trim();
    const remoteAccessId = body.remote_access_id?.trim() || null;
    const urgencyId = body.urgency_id ? Number(body.urgency_id) : null;

    if (!fullName || !phone || !department || !location || !requestText) {
      res.status(400).json({ message: 'Missing required fields' });
      return;
    }

    const result = await withDbClient((client) =>
      client.query(
        `WITH ins AS (
           INSERT INTO it_requests (full_name, phone, department, location, request_text, remote_access_id, urgency_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, status, created_at, urgency_id
         )
         SELECT ins.id, ins.status, ins.created_at, ul.name AS urgency_name
         FROM ins
         LEFT JOIN urgency_levels ul ON ul.id = ins.urgency_id`,
        [fullName, phone, department, location, requestText, remoteAccessId, urgencyId],
      ),
    );

    const created = result.rows[0] as { id: number; status: string; created_at: string; urgency_name: string | null };

    const remoteAccessLine = remoteAccessId ? `\nУдаленный доступ: ${remoteAccessId}` : '';
    const urgencyLine = created.urgency_name ? `\nСрочность: ${created.urgency_name}` : '';

    void notifyRoleUsers(
      'it_department',
      `Новая заявка в ИТ #${created.id}\nОтделение: ${department}\nКабинет: ${location}\nТелефон: ${phone}${remoteAccessLine}${urgencyLine}\nОписание: ${requestText.slice(0, 200)}`,
    );

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
}

export async function updateItRequestStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    const { status } = req.body as { status: ItRequestStatus };

    if (!ALLOWED_STATUSES.includes(status)) {
      res.status(400).json({ message: `Недопустимый статус. Допустимые значения: ${ALLOWED_STATUSES.join(', ')}` });
      return;
    }

    const result = await withDbClient((client) =>
      client.query(
        `WITH upd AS (
           UPDATE it_requests SET status = $1 WHERE id = $2
           RETURNING id, status, department, location, phone, request_text, urgency_id
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
      location: string;
      phone: string;
      request_text: string;
      urgency_name: string | null;
    };

    const urgencyLine = updated.urgency_name ? `\nСрочность: ${updated.urgency_name}` : '';

    void notifyRoleUsers(
      'it_department',
      `Статус заявки в ИТ #${updated.id} изменён на «${STATUS_LABELS_RU[status]}»\n` +
      `Отделение: ${updated.department}\n` +
      `Кабинет: ${updated.location}\n` +
      `Телефон: ${updated.phone}${urgencyLine}\n` +
      `Описание: ${updated.request_text.slice(0, 200)}`,
    );

    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
}

export async function updateItRequestComment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    const { comment } = req.body as { comment: string };

    const result = await withDbClient((client) =>
      client.query(
        `UPDATE it_requests SET comment = $1 WHERE id = $2 RETURNING id, comment`,
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

export async function getItRequestByIdPublic(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      res.status(400).json({ message: 'Некорректный номер заявки' });
      return;
    }

    const result = await withDbClient((client) =>
      client.query(
        `SELECT id, full_name, department, location, request_text, remote_access_id, status, comment, created_at
         FROM it_requests WHERE id = $1`,
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

export async function getItRequests(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await withDbClient((client) =>
      client.query(
        `SELECT r.id, r.full_name, r.phone, r.department, r.location, r.request_text,
                r.remote_access_id, r.status, r.comment, r.created_at,
                ul.name AS urgency_name, ul.days AS urgency_days
         FROM it_requests r
         LEFT JOIN urgency_levels ul ON ul.id = r.urgency_id
         ORDER BY r.created_at DESC`,
      ),
    );

    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
}
