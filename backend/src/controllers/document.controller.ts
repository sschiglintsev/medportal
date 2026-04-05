import { NextFunction, Request, Response } from 'express';

import { withDbClient } from '../db';

type DocumentBody = {
  category: string;
  title: string;
  description?: string;
};

export async function getDocuments(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await withDbClient((client) =>
      client.query(
        `SELECT id, category, title, description, file_url, created_at, updated_at
         FROM documents
         ORDER BY category ASC, created_at DESC`,
      ),
    );

    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function createDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Partial<DocumentBody>;
    const file = req.file;
    const category = body.category?.trim();
    const title = body.title?.trim();
    const description = body.description?.trim() || null;

    if (!category || !title) {
      res.status(400).json({ message: 'Category and title are required' });
      return;
    }

    if (!file) {
      res.status(400).json({ message: 'Document file is required' });
      return;
    }

    const fileUrl = `/uploads/documents/${file.filename}`;

    const result = await withDbClient((client) =>
      client.query(
        `INSERT INTO documents (category, title, description, file_url)
         VALUES ($1, $2, $3, $4)
         RETURNING id, category, title, description, file_url, created_at, updated_at`,
        [category, title, description, fileUrl],
      ),
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function updateDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ message: 'Invalid document id' });
      return;
    }

    const body = req.body as Partial<DocumentBody>;
    const file = req.file;
    const category = body.category?.trim();
    const title = body.title?.trim();
    const description = body.description?.trim() || null;

    if (!category || !title) {
      res.status(400).json({ message: 'Category and title are required' });
      return;
    }

    if (file) {
      const fileUrl = `/uploads/documents/${file.filename}`;
      const result = await withDbClient((client) =>
        client.query(
          `UPDATE documents
           SET category = $1,
               title = $2,
               description = $3,
               file_url = $4,
               updated_at = NOW()
           WHERE id = $5
           RETURNING id, category, title, description, file_url, created_at, updated_at`,
          [category, title, description, fileUrl, id],
        ),
      );

      if (result.rowCount === 0) {
        res.status(404).json({ message: 'Document not found' });
        return;
      }

      res.status(200).json(result.rows[0]);
      return;
    }

    const result = await withDbClient((client) =>
      client.query(
        `UPDATE documents
         SET category = $1,
             title = $2,
             description = $3,
             updated_at = NOW()
         WHERE id = $4
         RETURNING id, category, title, description, file_url, created_at, updated_at`,
        [category, title, description, id],
      ),
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Document not found' });
      return;
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function deleteDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ message: 'Invalid document id' });
      return;
    }

    const result = await withDbClient((client) =>
      client.query('DELETE FROM documents WHERE id = $1 RETURNING id', [id]),
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Document not found' });
      return;
    }

    res.status(200).json({ message: 'Document deleted' });
  } catch (error) {
    next(error);
  }
}
