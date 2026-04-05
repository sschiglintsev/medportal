import { NextFunction, Request, Response } from 'express';

import { withDbClient } from '../db';

type CreateIncidentBody = {
  incident_date: string;
  incident_time: string;
  place: string;
  patient_fio: string;
  patient_birth_date: string;
  circumstances: string;
  employee_fio: string;
  employee_position: string;
  legal_presence: string;
  department_id: number;
  incident_type_id: number;
  consequences: string;
};

type CreateDepartmentBody = {
  name: string;
};

type CreateIncidentTypeBody = {
  name: string;
};

export async function getDepartments(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await withDbClient((client) =>
      client.query('SELECT id, name, created_at FROM departments ORDER BY name ASC'),
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

    if (!name) {
      res.status(400).json({ message: 'Department name is required' });
      return;
    }

    const result = await withDbClient((client) =>
      client.query(
        'INSERT INTO departments (name) VALUES ($1) RETURNING id, name, created_at',
        [name],
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
      !body.place ||
      !body.patient_fio ||
      !body.patient_birth_date ||
      !body.circumstances ||
      !body.employee_fio ||
      !body.employee_position ||
      !body.legal_presence ||
      body.department_id === undefined ||
      body.incident_type_id === undefined ||
      !body.consequences
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
          incident_type_id,
          consequences
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id, status, created_at`,
        [
          body.incident_date,
          body.incident_time,
          body.place,
          body.patient_fio,
          body.patient_birth_date,
          body.circumstances,
          body.employee_fio,
          body.employee_position,
          body.legal_presence,
          body.department_id,
          body.incident_type_id,
          body.consequences,
        ],
      ),
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
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
          i.incident_type_id,
          it.name AS incident_type_name,
          i.consequences,
          i.status,
          i.created_at
        FROM incidents i
        LEFT JOIN departments d ON d.id = i.department_id
        LEFT JOIN incident_types it ON it.id = i.incident_type_id
        ORDER BY i.created_at DESC`,
      ),
    );

    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
}
