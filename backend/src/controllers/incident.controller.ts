import { NextFunction, Request, Response } from 'express';

import { pool, withDbClient } from '../db';
import { notifyRoleUsers } from '../services/max-bot.service';

type CreateIncidentBody = {
  incident_date: string;
  incident_time: string;
  place?: string;
  patient_fio: string;
  patient_birth_date: string;
  circumstances: string;
  employee_fio: string;
  employee_position: string;
  legal_presence: string;
  department_id: number;
  incident_view_type_id?: number;
  incident_type_id: number;
  consequences: string;
  severity_level?: string;
};

type CreateDepartmentBody = {
  name: string;
  care_type?: string;
};

type CreateIncidentTypeBody = {
  name: string;
};

type CreateIncidentViewTypeBody = {
  name: string;
  care_type: string;
};

export async function getDepartments(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await withDbClient((client) =>
      client.query('SELECT id, name, care_type, created_at FROM departments ORDER BY name ASC'),
    );

    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function createDepartment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Partial<CreateDepartmentBody>;
    const name = body.name?.trim();
    const careType = body.care_type?.trim() || null;

    if (!name) {
      res.status(400).json({ message: 'Department name is required' });
      return;
    }

    if (careType && !['Стационар', 'Поликлиника'].includes(careType)) {
      res.status(400).json({ message: 'Invalid care_type value' });
      return;
    }

    const result = await withDbClient((client) =>
      client.query(
        'INSERT INTO departments (name, care_type) VALUES ($1, $2) RETURNING id, name, care_type, created_at',
        [name, careType],
      ),
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function getIncidentTypes(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await withDbClient((client) =>
      client.query('SELECT id, name, created_at FROM incident_types ORDER BY name ASC'),
    );

    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function createIncidentType(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Partial<CreateIncidentTypeBody>;
    const name = body.name?.trim();

    if (!name) {
      res.status(400).json({ message: 'Incident type name is required' });
      return;
    }

    const result = await withDbClient((client) =>
      client.query(
        'INSERT INTO incident_types (name) VALUES ($1) RETURNING id, name, created_at',
        [name],
      ),
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function createIncident(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Partial<CreateIncidentBody>;

    if (
      !body.incident_date ||
      !body.incident_time ||
      !body.patient_fio ||
      !body.patient_birth_date ||
      !body.circumstances ||
      !body.employee_fio ||
      !body.employee_position ||
      !body.legal_presence ||
      body.department_id === undefined ||
      body.incident_type_id === undefined
    ) {
      res.status(400).json({ message: 'Missing required fields' });
      return;
    }

    const result = await withDbClient((client) =>
      client.query(
        `INSERT INTO incidents (
          incident_date,
          incident_time,
          place,
          patient_fio,
          patient_birth_date,
          circumstances,
          employee_fio,
          employee_position,
          legal_presence,
          department_id,
          incident_view_type_id,
          incident_type_id,
          consequences,
          severity_level
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id, status, created_at`,
        [
          body.incident_date,
          body.incident_time,
          body.place ?? '',
          body.patient_fio,
          body.patient_birth_date,
          body.circumstances,
          body.employee_fio,
          body.employee_position,
          body.legal_presence,
          body.department_id,
          body.incident_view_type_id ?? null,
          body.incident_type_id,
          body.consequences,
          body.severity_level ?? null,
        ],
      ),
    );

    const created = result.rows[0] as { id: number; status: string; created_at: string };

    void notifyRoleUsers(
      'quality_department',
      `Новое нежелательное событие #${created.id}\nСотрудник: ${body.employee_fio}\nДолжность: ${body.employee_position}\nМесто: ${body.place}`,
    );

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
}

export async function getIncidentViewTypes(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await withDbClient((client) =>
      client.query(
        `SELECT
          ivt.id,
          ivt.name,
          ivt.care_type,
          ivt.created_at,
          COALESCE(
            json_agg(json_build_object('id', it.id, 'name', it.name) ORDER BY it.name)
            FILTER (WHERE it.id IS NOT NULL),
            '[]'
          ) AS incident_types
        FROM incident_view_types ivt
        LEFT JOIN incident_view_type_incident_types link ON link.incident_view_type_id = ivt.id
        LEFT JOIN incident_types it ON it.id = link.incident_type_id
        GROUP BY ivt.id
        ORDER BY ivt.name ASC`,
      ),
    );

    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function createIncidentViewType(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Partial<CreateIncidentViewTypeBody>;
    const name = body.name?.trim();
    const careType = body.care_type?.trim();

    if (!name) {
      res.status(400).json({ message: 'Incident view type name is required' });
      return;
    }

    if (!careType || !['Стационар', 'Поликлиника'].includes(careType)) {
      res.status(400).json({ message: 'care_type must be Стационар or Поликлиника' });
      return;
    }

    const result = await withDbClient((client) =>
      client.query(
        'INSERT INTO incident_view_types (name, care_type) VALUES ($1, $2) RETURNING id, name, care_type, created_at',
        [name, careType],
      ),
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function updateDepartment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    const body = req.body as Partial<CreateDepartmentBody>;
    const name = body.name?.trim();
    const careType = body.care_type?.trim() || null;

    if (!name) {
      res.status(400).json({ message: 'Department name is required' });
      return;
    }

    if (careType && !['Стационар', 'Поликлиника'].includes(careType)) {
      res.status(400).json({ message: 'Invalid care_type value' });
      return;
    }

    const result = await withDbClient((client) =>
      client.query(
        'UPDATE departments SET name = $1, care_type = $2 WHERE id = $3 RETURNING id, name, care_type, created_at',
        [name, careType, id],
      ),
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Department not found' });
      return;
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function deleteDepartment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);

    const result = await withDbClient((client) =>
      client.query('DELETE FROM departments WHERE id = $1 RETURNING id', [id]),
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Department not found' });
      return;
    }

    res.status(200).json({ message: 'Deleted' });
  } catch (error) {
    next(error);
  }
}

export async function updateIncidentType(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    const body = req.body as Partial<CreateIncidentTypeBody>;
    const name = body.name?.trim();

    if (!name) {
      res.status(400).json({ message: 'Incident type name is required' });
      return;
    }

    const result = await withDbClient((client) =>
      client.query(
        'UPDATE incident_types SET name = $1 WHERE id = $2 RETURNING id, name, created_at',
        [name, id],
      ),
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Incident type not found' });
      return;
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function deleteIncidentType(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);

    const result = await withDbClient((client) =>
      client.query('DELETE FROM incident_types WHERE id = $1 RETURNING id', [id]),
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Incident type not found' });
      return;
    }

    res.status(200).json({ message: 'Deleted' });
  } catch (error) {
    next(error);
  }
}

export async function updateIncidentViewType(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    const body = req.body as Partial<CreateIncidentViewTypeBody>;
    const name = body.name?.trim();
    const careType = body.care_type?.trim();

    if (!name) {
      res.status(400).json({ message: 'Incident view type name is required' });
      return;
    }

    if (!careType || !['Стационар', 'Поликлиника'].includes(careType)) {
      res.status(400).json({ message: 'care_type must be Стационар or Поликлиника' });
      return;
    }

    const result = await withDbClient((client) =>
      client.query(
        'UPDATE incident_view_types SET name = $1, care_type = $2 WHERE id = $3 RETURNING id, name, care_type, created_at',
        [name, careType, id],
      ),
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Incident view type not found' });
      return;
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function deleteIncidentViewType(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);

    const result = await withDbClient((client) =>
      client.query('DELETE FROM incident_view_types WHERE id = $1 RETURNING id', [id]),
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Incident view type not found' });
      return;
    }

    res.status(200).json({ message: 'Deleted' });
  } catch (error) {
    next(error);
  }
}

export async function getIncidentViewTypeLinkedTypes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const viewTypeId = Number(req.params.id);

    const result = await withDbClient((client) =>
      client.query(
        `SELECT it.id, it.name, it.created_at
         FROM incident_types it
         INNER JOIN incident_view_type_incident_types ivt ON ivt.incident_type_id = it.id
         WHERE ivt.incident_view_type_id = $1
         ORDER BY it.name ASC`,
        [viewTypeId],
      ),
    );

    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function addIncidentTypeToViewType(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const viewTypeId = Number(req.params.id);
    const body = req.body as { incident_type_id?: number };

    if (!body.incident_type_id) {
      res.status(400).json({ message: 'incident_type_id is required' });
      return;
    }

    await withDbClient((client) =>
      client.query(
        `INSERT INTO incident_view_type_incident_types (incident_view_type_id, incident_type_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [viewTypeId, body.incident_type_id],
      ),
    );

    res.status(201).json({ message: 'Linked' });
  } catch (error) {
    next(error);
  }
}

export async function removeIncidentTypeFromViewType(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const viewTypeId = Number(req.params.id);
    const typeId = Number(req.params.typeId);

    await withDbClient((client) =>
      client.query(
        'DELETE FROM incident_view_type_incident_types WHERE incident_view_type_id = $1 AND incident_type_id = $2',
        [viewTypeId, typeId],
      ),
    );

    res.status(200).json({ message: 'Unlinked' });
  } catch (error) {
    next(error);
  }
}

export async function syncIncidentTypesForViewType(req: Request, res: Response, next: NextFunction): Promise<void> {
  const client = await pool.connect();
  try {
    const viewTypeId = Number(req.params.id);
    const body = req.body as { incident_type_ids?: number[] };
    const ids = Array.isArray(body.incident_type_ids) ? body.incident_type_ids : [];

    await client.query('BEGIN');
    await client.query(
      'DELETE FROM incident_view_type_incident_types WHERE incident_view_type_id = $1',
      [viewTypeId],
    );
    for (const typeId of ids) {
      await client.query(
        'INSERT INTO incident_view_type_incident_types (incident_view_type_id, incident_type_id) VALUES ($1, $2)',
        [viewTypeId, typeId],
      );
    }
    await client.query('COMMIT');

    res.status(200).json({ message: 'Synced' });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
}

export async function getAllIncidents(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await withDbClient((client) =>
      client.query(
        `SELECT
          i.id,
          i.incident_date,
          i.incident_time,
          i.place,
          i.patient_fio,
          i.patient_birth_date,
          i.circumstances,
          i.employee_fio,
          i.employee_position,
          i.legal_presence,
          i.department_id,
          d.name AS department_name,
          i.incident_view_type_id,
          ivt.name AS incident_view_type_name,
          ivt.care_type,
          i.incident_type_id,
          it.name AS incident_type_name,
          i.consequences,
          i.severity_level,
          i.status,
          i.created_at
        FROM incidents i
        LEFT JOIN departments d ON d.id = i.department_id
        LEFT JOIN incident_view_types ivt ON ivt.id = i.incident_view_type_id
        LEFT JOIN incident_types it ON it.id = i.incident_type_id
        ORDER BY i.created_at DESC`,
      ),
    );

    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
}
