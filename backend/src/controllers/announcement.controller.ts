import { NextFunction, Request, Response } from 'express';

import { withDbClient } from '../db';

type AnnouncementPayload = {
  title: string;
  description: string;
  full_description: string;
  published_date: string;
  image_url?: string;
};

function validatePayload(body: Partial<AnnouncementPayload>): { valid: boolean; message?: string } {
  if (!body.title?.trim()) {
    return { valid: false, message: 'Title is required' };
  }
  if (!body.description?.trim()) {
    return { valid: false, message: 'Description is required' };
  }
  if (!body.full_description?.trim()) {
    return { valid: false, message: 'Full description is required' };
  }
  if (!body.published_date) {
    return { valid: false, message: 'Published date is required' };
  }

  return { valid: true };
}

export async function getAnnouncements(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await withDbClient((client) =>
      client.query(
        `SELECT id, title, description, full_description, image_url, published_date, created_at, updated_at
         FROM announcements
         ORDER BY published_date DESC, created_at DESC`,
      ),
    );

    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function createAnnouncement(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Partial<AnnouncementPayload>;
    const validation = validatePayload(body);

    if (!validation.valid) {
      res.status(400).json({ message: validation.message });
      return;
    }

    const result = await withDbClient((client) =>
      client.query(
        `INSERT INTO announcements (title, description, full_description, image_url, published_date)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, title, description, full_description, image_url, published_date, created_at, updated_at`,
        [
          body.title?.trim(),
          body.description?.trim(),
          body.full_description?.trim(),
          body.image_url?.trim() || null,
          body.published_date,
        ],
      ),
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function updateAnnouncement(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ message: 'Invalid announcement id' });
      return;
    }

    const body = req.body as Partial<AnnouncementPayload>;
    const validation = validatePayload(body);
    if (!validation.valid) {
      res.status(400).json({ message: validation.message });
      return;
    }

    const result = await withDbClient((client) =>
      client.query(
        `UPDATE announcements
         SET title = $1,
             description = $2,
             full_description = $3,
             image_url = $4,
             published_date = $5,
             updated_at = NOW()
         WHERE id = $6
         RETURNING id, title, description, full_description, image_url, published_date, created_at, updated_at`,
        [
          body.title?.trim(),
          body.description?.trim(),
          body.full_description?.trim(),
          body.image_url?.trim() || null,
          body.published_date,
          id,
        ],
      ),
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Announcement not found' });
      return;
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}
