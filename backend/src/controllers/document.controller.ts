import { NextFunction, Request, Response } from 'express';

import { withDbClient } from '../db';

type DocumentBody = {
  folder_id?: number | null;
  title: string;
  description?: string;
};

export async function getDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const folderIdParam = req.query.folder_id;

    let query: string;
    let params: unknown[];

    if (folderIdParam !== undefined) {
      const folderId = Number(folderIdParam);
      query = `SELECT id, folder_id, title, description, file_url, original_filename, sort_order, created_at, updated_at
               FROM documents
               WHERE folder_id = $1
               ORDER BY sort_order ASC, created_at DESC`;
      params = [folderId];
    } else {
      query = `SELECT id, folder_id, title, description, file_url, original_filename, sort_order, created_at, updated_at
               FROM documents
               ORDER BY created_at DESC`;
      params = [];
    }

    const result = await withDbClient((client) => client.query(query, params));
    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function createDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Partial<DocumentBody>;
    const file = req.file;
    const folder_id = body.folder_id != null ? Number(body.folder_id) : null;
    const title = body.title?.trim();
    const description = body.description?.trim() || null;

    if (!title) {
      res.status(400).json({ message: 'Title is required' });
      return;
    }

    if (!file) {
      res.status(400).json({ message: 'Document file is required' });
      return;
    }

    const fileUrl = `/uploads/documents/${file.filename}`;
    const originalFilename = file.originalname
      ? Buffer.from(file.originalname, 'latin1').toString('utf8')
      : null;

    const result = await withDbClient((client) =>
      client.query(
        `INSERT INTO documents (folder_id, title, description, file_url, original_filename)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, folder_id, title, description, file_url, original_filename, sort_order, created_at, updated_at`,
        [folder_id, title, description, fileUrl, originalFilename],
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
    const folder_id = body.folder_id != null ? Number(body.folder_id) : null;
    const title = body.title?.trim();
    const description = body.description?.trim() || null;

    if (!title) {
      res.status(400).json({ message: 'Title is required' });
      return;
    }

    if (file) {
      const fileUrl = `/uploads/documents/${file.filename}`;
      const originalFilename = file.originalname
        ? Buffer.from(file.originalname, 'latin1').toString('utf8')
        : null;
      const result = await withDbClient((client) =>
        client.query(
          `UPDATE documents
           SET folder_id = $1,
               title = $2,
               description = $3,
               file_url = $4,
               original_filename = $5,
               updated_at = NOW()
           WHERE id = $6
           RETURNING id, folder_id, title, description, file_url, original_filename, sort_order, created_at, updated_at`,
          [folder_id, title, description, fileUrl, originalFilename, id],
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
         SET folder_id = $1,
             title = $2,
             description = $3,
             updated_at = NOW()
         WHERE id = $4
         RETURNING id, folder_id, title, description, file_url, original_filename, sort_order, created_at, updated_at`,
        [folder_id, title, description, id],
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
