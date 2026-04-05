import { NextFunction, Request, Response } from 'express';

import { withDbClient } from '../db';

type CreateItRequestBody = {
  full_name: string;
  phone: string;
  department: string;
  location: string;
  request_text: string;
};

export async function createItRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Partial<CreateItRequestBody>;
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
        `INSERT INTO it_requests (full_name, phone, department, location, request_text)
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

export async function getItRequests(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await withDbClient((client) =>
      client.query(
        `SELECT id, full_name, phone, department, location, request_text, status, created_at
         FROM it_requests
         ORDER BY created_at DESC`,
      ),
    );

    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
}
