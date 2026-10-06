import { NextFunction, Request, Response } from 'express';

import { withDbClient } from '../db';

const SELECT_COLUMNS = `
  cs.id,
  cs.commissioning_date::text AS commissioning_date,
  cs.nomenclature,
  cs.name,
  cs.type,
  cs.inventory_number,
  cs.serial_number,
  cs.manufacture_date::text AS manufacture_date,
  cs.department_id,
  d.name AS department_name,
  cs.quantity,
  cs.verification_kind,
  cs.current_verification_date::text AS current_verification_date,
  cs.next_verification_date::text AS next_verification_date,
  cs.note,
  cs.created_at
`;

type SchedulePayload = {
  commissioning_date?: string | null;
  nomenclature?: string | null;
  name?: string | null;
  type?: string | null;
  inventory_number?: string | null;
  serial_number?: string | null;
  manufacture_date?: string | null;
  department_id?: number | null;
  department?: string | null;
  quantity?: number | null;
  verification_kind?: string | null;
  current_verification_date?: string | null;
  next_verification_date?: string | null;
  note?: string | null;
};

let tableReady = false;

async function ensureTable(): Promise<void> {
  if (tableReady) return;
  await withDbClient((client) =>
    client.query(`
      CREATE TABLE IF NOT EXISTS calibration_schedule (
        id                         SERIAL PRIMARY KEY,
        commissioning_date         DATE,
        nomenclature               TEXT NOT NULL,
        name                       TEXT,
        type                       TEXT,
        inventory_number           TEXT,
        serial_number              TEXT,
        manufacture_date           DATE,
        department_id              INTEGER REFERENCES departments(id) ON DELETE SET NULL,
        quantity                   INTEGER,
        verification_kind          TEXT,
        current_verification_date  DATE,
        next_verification_date     DATE,
        note                       TEXT,
        created_at                 TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `),
  );
  await withDbClient((client) =>
    client.query(`
      CREATE INDEX IF NOT EXISTS calibration_schedule_department_idx
        ON calibration_schedule (department_id)
    `),
  );
  await withDbClient((client) =>
    client.query(`
      CREATE INDEX IF NOT EXISTS calibration_schedule_next_date_idx
        ON calibration_schedule (next_verification_date)
    `),
  );
  tableReady = true;
}

function emptyToNull(value: unknown): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

function parseDate(value: unknown): string | null {
  const raw = emptyToNull(value);
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return null;
}

function parseQuantity(value: unknown): number | null {
  if (value == null || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.trunc(num);
}

function parseDepartmentId(value: unknown): number | null {
  if (value == null || value === '') return null;
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) return null;
  return num;
}

function normalizeDepartmentName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ');
}

function mapRow(body: SchedulePayload, departmentId: number | null) {
  const nomenclature = emptyToNull(body.nomenclature);
  if (!nomenclature) return null;
  return {
    commissioning_date: parseDate(body.commissioning_date),
    nomenclature,
    name: emptyToNull(body.name),
    type: emptyToNull(body.type),
    inventory_number: emptyToNull(body.inventory_number),
    serial_number: emptyToNull(body.serial_number),
    manufacture_date: parseDate(body.manufacture_date),
    department_id: departmentId,
    quantity: parseQuantity(body.quantity),
    verification_kind: emptyToNull(body.verification_kind),
    current_verification_date: parseDate(body.current_verification_date),
    next_verification_date: parseDate(body.next_verification_date),
    note: emptyToNull(body.note),
  };
}

async function resolveDepartmentId(
  body: SchedulePayload,
  departments: Map<string, number>,
): Promise<number | null> {
  const byId = parseDepartmentId(body.department_id);
  if (byId) return byId;
  const name = emptyToNull(body.department);
  if (!name) return null;
  return departments.get(normalizeDepartmentName(name)) ?? null;
}

async function loadDepartmentMap(): Promise<Map<string, number>> {
  const result = await withDbClient((client) =>
    client.query<{ id: number; name: string }>('SELECT id, name FROM departments'),
  );
  const map = new Map<string, number>();
  for (const row of result.rows) {
    map.set(normalizeDepartmentName(row.name), row.id);
  }
  return map;
}

export async function getCalibrationSchedule(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await ensureTable();
    const result = await withDbClient((client) =>
      client.query(
        `SELECT ${SELECT_COLUMNS}
         FROM calibration_schedule cs
         LEFT JOIN departments d ON d.id = cs.department_id
         ORDER BY cs.next_verification_date NULLS LAST, cs.id ASC`,
      ),
    );
    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function createCalibrationItem(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await ensureTable();
    const body = req.body as SchedulePayload;
    const departments = await loadDepartmentMap();
    const departmentId = await resolveDepartmentId(body, departments);
    const row = mapRow(body, departmentId);
    if (!row) {
      res.status(400).json({ message: 'Укажите номенклатуру' });
      return;
    }

    const result = await withDbClient((client) =>
      client.query(
        `INSERT INTO calibration_schedule (
           commissioning_date, nomenclature, name, type, inventory_number, serial_number,
           manufacture_date, department_id, quantity, verification_kind,
           current_verification_date, next_verification_date, note
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING id`,
        [
          row.commissioning_date,
          row.nomenclature,
          row.name,
          row.type,
          row.inventory_number,
          row.serial_number,
          row.manufacture_date,
          row.department_id,
          row.quantity,
          row.verification_kind,
          row.current_verification_date,
          row.next_verification_date,
          row.note,
        ],
      ),
    );

    const created = await withDbClient((client) =>
      client.query(
        `SELECT ${SELECT_COLUMNS}
         FROM calibration_schedule cs
         LEFT JOIN departments d ON d.id = cs.department_id
         WHERE cs.id = $1`,
        [result.rows[0].id],
      ),
    );
    res.status(201).json(created.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function updateCalibrationItem(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await ensureTable();
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
      res.status(400).json({ message: 'Некорректный ID' });
      return;
    }

    const body = req.body as SchedulePayload;
    const departments = await loadDepartmentMap();
    const departmentId = await resolveDepartmentId(body, departments);
    const row = mapRow(body, departmentId);
    if (!row) {
      res.status(400).json({ message: 'Укажите номенклатуру' });
      return;
    }

    const result = await withDbClient((client) =>
      client.query(
        `UPDATE calibration_schedule SET
           commissioning_date = $1,
           nomenclature = $2,
           name = $3,
           type = $4,
           inventory_number = $5,
           serial_number = $6,
           manufacture_date = $7,
           department_id = $8,
           quantity = $9,
           verification_kind = $10,
           current_verification_date = $11,
           next_verification_date = $12,
           note = $13
         WHERE id = $14
         RETURNING id`,
        [
          row.commissioning_date,
          row.nomenclature,
          row.name,
          row.type,
          row.inventory_number,
          row.serial_number,
          row.manufacture_date,
          row.department_id,
          row.quantity,
          row.verification_kind,
          row.current_verification_date,
          row.next_verification_date,
          row.note,
          id,
        ],
      ),
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Запись не найдена' });
      return;
    }

    const updated = await withDbClient((client) =>
      client.query(
        `SELECT ${SELECT_COLUMNS}
         FROM calibration_schedule cs
         LEFT JOIN departments d ON d.id = cs.department_id
         WHERE cs.id = $1`,
        [id],
      ),
    );
    res.status(200).json(updated.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function deleteCalibrationItem(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await ensureTable();
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
      res.status(400).json({ message: 'Некорректный ID' });
      return;
    }
    const result = await withDbClient((client) =>
      client.query('DELETE FROM calibration_schedule WHERE id = $1 RETURNING id', [id]),
    );
    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Запись не найдена' });
      return;
    }
    res.status(200).json({ deleted: true });
  } catch (error) {
    next(error);
  }
}

export async function clearCalibrationSchedule(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await ensureTable();
    const result = await withDbClient((client) =>
      client.query('DELETE FROM calibration_schedule'),
    );
    res.status(200).json({ deleted: result.rowCount ?? 0 });
  } catch (error) {
    next(error);
  }
}

export async function importCalibrationSchedule(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await ensureTable();
    const items = Array.isArray((req.body as { items?: SchedulePayload[] }).items)
      ? (req.body as { items: SchedulePayload[] }).items
      : [];

    if (items.length === 0) {
      res.status(400).json({ message: 'Нет строк для импорта' });
      return;
    }

    const departments = await loadDepartmentMap();
    const rows = items
      .map((item) => {
        const departmentId = departments.get(normalizeDepartmentName(item.department ?? '')) ?? parseDepartmentId(item.department_id);
        return mapRow(item, departmentId);
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (rows.length === 0) {
      res.status(400).json({ message: 'Не удалось распознать строки Excel' });
      return;
    }

    await withDbClient(async (client) => {
      const chunkSize = 200;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        await client.query(
          `INSERT INTO calibration_schedule (
             commissioning_date, nomenclature, name, type, inventory_number, serial_number,
             manufacture_date, department_id, quantity, verification_kind,
             current_verification_date, next_verification_date, note
           )
           SELECT * FROM unnest(
             $1::date[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[],
             $7::date[], $8::int[], $9::int[], $10::text[],
             $11::date[], $12::date[], $13::text[]
           )`,
          [
            chunk.map((r) => r.commissioning_date),
            chunk.map((r) => r.nomenclature),
            chunk.map((r) => r.name),
            chunk.map((r) => r.type),
            chunk.map((r) => r.inventory_number),
            chunk.map((r) => r.serial_number),
            chunk.map((r) => r.manufacture_date),
            chunk.map((r) => r.department_id),
            chunk.map((r) => r.quantity),
            chunk.map((r) => r.verification_kind),
            chunk.map((r) => r.current_verification_date),
            chunk.map((r) => r.next_verification_date),
            chunk.map((r) => r.note),
          ],
        );
      }
    });

    res.status(201).json({ imported: rows.length });
  } catch (error) {
    next(error);
  }
}
