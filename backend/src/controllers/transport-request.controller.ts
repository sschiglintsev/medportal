import { NextFunction, Request, Response } from 'express';

import { withDbClient } from '../db';
import { notifyRoleUsers } from '../services/max-bot.service';

let tableReady = false;

async function ensureTable(): Promise<void> {
  if (tableReady) return;
  await withDbClient(async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS transport_requests (
        id               SERIAL PRIMARY KEY,
        department       VARCHAR(255) NOT NULL,
        initiator        VARCHAR(255) NOT NULL,
        submission_date  DATE         NOT NULL,
        submission_time  TIME         NOT NULL,
        route_from       VARCHAR(255) NOT NULL,
        route_to         VARCHAR(255) NOT NULL,
        purpose          TEXT         NOT NULL,
        passenger_count  INTEGER      NOT NULL,
        special_notes    TEXT,
        status           VARCHAR(20)  NOT NULL DEFAULT 'new',
        comment          TEXT,
        created_at       TIMESTAMP    NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      ALTER TABLE transport_requests
      ADD COLUMN IF NOT EXISTS vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL
    `);
    await client.query(`
      ALTER TABLE transport_requests ADD COLUMN IF NOT EXISTS position VARCHAR(255)
    `);
    await client.query(`
      ALTER TABLE transport_requests ADD COLUMN IF NOT EXISTS phone VARCHAR(20)
    `);
  });
  tableReady = true;
}

const ALLOWED_STATUSES = ['new', 'in_progress', 'done', 'cancelled'] as const;
type TransportRequestStatus = (typeof ALLOWED_STATUSES)[number];

type CreateTransportRequestBody = {
  department: string;
  initiator: string;
  position?: string;
  phone?: string;
  submission_date: string;
  submission_time: string;
  route_from: string;
  route_to: string;
  purpose: string;
  passenger_count: number;
  special_notes?: string;
};

export async function createTransportRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await ensureTable();
    const body = req.body as Partial<CreateTransportRequestBody>;

    const department     = body.department?.trim();
    const initiator      = body.initiator?.trim();
    const position       = body.position?.trim() || null;
    const phone          = body.phone?.trim() || null;
    const submissionDate = body.submission_date?.trim();
    const submissionTime = body.submission_time?.trim();
    const routeFrom      = body.route_from?.trim();
    const routeTo        = body.route_to?.trim();
    const purpose        = body.purpose?.trim();
    const passengerCount = body.passenger_count;
    const specialNotes   = body.special_notes?.trim() || null;

    if (
      !department || !initiator || !submissionDate || !submissionTime ||
      !routeFrom || !routeTo || !purpose || passengerCount === undefined || passengerCount === null
    ) {
      res.status(400).json({ message: 'Missing required fields' });
      return;
    }

    if (!Number.isInteger(Number(passengerCount)) || Number(passengerCount) < 1) {
      res.status(400).json({ message: 'passenger_count must be a positive integer' });
      return;
    }

    const result = await withDbClient((client) =>
      client.query(
        `INSERT INTO transport_requests
           (department, initiator, position, phone, submission_date, submission_time,
            route_from, route_to, purpose, passenger_count, special_notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id, status, created_at`,
        [department, initiator, position, phone, submissionDate, submissionTime,
         routeFrom, routeTo, purpose, Number(passengerCount), specialNotes],
      ),
    );

    const created = result.rows[0] as { id: number; status: string; created_at: string };

    void notifyRoleUsers(
      'dispatcher',
      `Новая транспортная заявка #${created.id}\n` +
      `Отделение: ${department}\n` +
      `Инициатор: ${initiator}\n` +
      `Дата/время: ${submissionDate} ${submissionTime}\n` +
      `Маршрут: ${routeFrom} — ${routeTo}\n` +
      `Цель: ${purpose}\n` +
      `Пассажиров: ${passengerCount}`,
    );

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
}

export async function getTransportRequests(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await ensureTable();
    const result = await withDbClient((client) =>
      client.query(
        `SELECT tr.id, tr.department, tr.initiator, tr.position, tr.phone,
                tr.submission_date, tr.submission_time,
                tr.route_from, tr.route_to, tr.purpose, tr.passenger_count, tr.special_notes,
                tr.status, tr.comment, tr.created_at, tr.vehicle_id,
                v.make AS vehicle_make, v.model AS vehicle_model,
                v.license_plate AS vehicle_license_plate, v.driver AS vehicle_driver
         FROM transport_requests tr
         LEFT JOIN vehicles v ON v.id = tr.vehicle_id
         ORDER BY tr.created_at DESC`,
      ),
    );

    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function getTransportRequestByIdPublic(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await ensureTable();
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      res.status(400).json({ message: 'Некорректный номер заявки' });
      return;
    }

    const result = await withDbClient((client) =>
      client.query(
        `SELECT tr.id, tr.department, tr.initiator, tr.position, tr.phone,
                tr.submission_date, tr.submission_time,
                tr.route_from, tr.route_to, tr.purpose, tr.passenger_count, tr.special_notes,
                tr.status, tr.comment, tr.created_at, tr.vehicle_id,
                v.make AS vehicle_make, v.model AS vehicle_model,
                v.license_plate AS vehicle_license_plate, v.driver AS vehicle_driver
         FROM transport_requests tr
         LEFT JOIN vehicles v ON v.id = tr.vehicle_id
         WHERE tr.id = $1`,
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

export async function updateTransportRequestStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await ensureTable();
    const id = Number(req.params.id);
    const { status } = req.body as { status: TransportRequestStatus };

    if (!ALLOWED_STATUSES.includes(status)) {
      res.status(400).json({ message: `Допустимые статусы: ${ALLOWED_STATUSES.join(', ')}` });
      return;
    }

    const result = await withDbClient((client) =>
      client.query(
        `UPDATE transport_requests SET status = $1 WHERE id = $2 RETURNING id, status`,
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

export async function updateTransportRequestVehicle(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await ensureTable();
    const id = Number(req.params.id);
    const { vehicle_id } = req.body as { vehicle_id: number | null };

    const vehicleId = vehicle_id === null || vehicle_id === undefined ? null : Number(vehicle_id);

    const result = await withDbClient((client) =>
      client.query(
        `UPDATE transport_requests SET vehicle_id = $1 WHERE id = $2
         RETURNING id, vehicle_id`,
        [vehicleId, id],
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

export async function updateTransportRequestComment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await ensureTable();
    const id = Number(req.params.id);
    const { comment } = req.body as { comment: string };

    const result = await withDbClient((client) =>
      client.query(
        `UPDATE transport_requests SET comment = $1 WHERE id = $2 RETURNING id, comment`,
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
