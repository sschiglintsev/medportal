import { NextFunction, Request, Response } from 'express';

import { withDbClient } from '../db';

type FolderBody = {
  name?: string;
  parent_id?: number | null;
};

export async function getFolders(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await withDbClient((client) =>
      client.query(
        `SELECT id, name, parent_id, sort_order, created_at
         FROM document_folders
         ORDER BY parent_id NULLS FIRST, sort_order ASC, name ASC`,
      ),
    );
    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function createFolder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as FolderBody;
    const name = body.name?.trim();
    const parent_id = body.parent_id != null ? Number(body.parent_id) : null;

    if (!name) {
      res.status(400).json({ message: 'Folder name is required' });
      return;
    }

    const result = await withDbClient((client) =>
      client.query(
        `INSERT INTO document_folders (name, parent_id)
         VALUES ($1, $2)
         RETURNING id, name, parent_id, sort_order, created_at`,
        [name, parent_id],
      ),
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function updateFolder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ message: 'Invalid folder id' });
      return;
    }

    const body = req.body as FolderBody;
    const name = body.name?.trim();

    if (!name) {
      res.status(400).json({ message: 'Folder name is required' });
      return;
    }

    const result = await withDbClient((client) =>
      client.query(
        `UPDATE document_folders
         SET name = $1
         WHERE id = $2
         RETURNING id, name, parent_id, sort_order, created_at`,
        [name, id],
      ),
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Folder not found' });
      return;
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function deleteFolder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ message: 'Invalid folder id' });
      return;
    }

    const result = await withDbClient((client) =>
      client.query('DELETE FROM document_folders WHERE id = $1 RETURNING id', [id]),
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Folder not found' });
      return;
    }

    res.status(200).json({ message: 'Folder deleted' });
  } catch (error) {
    next(error);
  }
}
