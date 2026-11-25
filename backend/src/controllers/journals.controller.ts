import { NextFunction, Response } from 'express';
import type { PoolClient } from 'pg';

import { pool, withDbClient } from '../db';
import type { AuthPayload, AuthenticatedRequest } from '../middlewares/auth.middleware';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function throwHttp(status: number, code: string, message: string): never {
  throw { httpStatus: status, code, message };
}

async function handleHttpError(
  error: unknown,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const e = error as { httpStatus?: number; code?: string; message?: string };
  if (e.httpStatus) {
    res.status(e.httpStatus).json({ code: e.code, message: e.message });
    return;
  }
  next(error);
}

/** Проверяет, имеет ли пользователь управленческий доступ к журналу. */
async function checkManageAccess(
  client: PoolClient,
  journalId: number,
  userId: number,
  permissions: AuthPayload['permissions'],
): Promise<{ id: number; title: string; department_id: number; owner_user_id: number; status: string; version: number; schema_version: number; first_published_at: string | null }> {
  const result = await client.query<{
    id: number; title: string; department_id: number; owner_user_id: number;
    status: string; version: number; schema_version: number; first_published_at: string | null;
  }>(
    'SELECT id, title, department_id, owner_user_id, status, version, schema_version, first_published_at FROM journals WHERE id = $1',
    [journalId],
  );

  const journal = result.rows[0];
  if (!journal) throwHttp(404, 'NOT_FOUND', 'Journal not found');

  const isOwner = journal.owner_user_id === userId;
  const canManageAll = permissions?.canManageAllJournals;
  const canManageOwn = permissions?.canManageOwnJournals;

  if (!canManageAll && !(canManageOwn && isOwner)) {
    throwHttp(403, 'FORBIDDEN', 'No access to this journal');
  }

  return journal;
}

// ─────────────────────────────────────────────────────────────
// GET /api/journals
// ─────────────────────────────────────────────────────────────

export async function getJournals(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const scope = req.query.scope as string ?? 'available';
    const userId = req.user!.userId;
    const permissions = req.user!.permissions;

    if (scope === 'all' && !permissions.canManageAllJournals) {
      throwHttp(403, 'FORBIDDEN', 'scope=all requires canManageAllJournals');
    }
    if (scope === 'own' && !permissions.canManageOwnJournals && !permissions.canManageAllJournals) {
      throwHttp(403, 'FORBIDDEN', 'No journal management permission');
    }

    let query: string;
    const params: unknown[] = [userId];

    if (scope === 'all') {
      query = `
        SELECT j.id, j.title, j.department_id, d.name AS department_name,
               j.owner_user_id, u.full_name AS owner_name,
               j.status, j.version, j.first_published_at, j.created_at, j.updated_at,
               COUNT(jr.id) FILTER (WHERE jr.deleted_at IS NULL) AS row_count
        FROM journals j
        JOIN departments d ON d.id = j.department_id
        JOIN users u ON u.id = j.owner_user_id
        LEFT JOIN journal_rows jr ON jr.journal_id = j.id
        GROUP BY j.id, d.name, u.full_name
        ORDER BY j.updated_at DESC`;
      params.length = 0;
    } else if (scope === 'own') {
      query = `
        SELECT j.id, j.title, j.department_id, d.name AS department_name,
               j.owner_user_id, u.full_name AS owner_name,
               j.status, j.version, j.first_published_at, j.created_at, j.updated_at,
               COUNT(jr.id) FILTER (WHERE jr.deleted_at IS NULL) AS row_count
        FROM journals j
        JOIN departments d ON d.id = j.department_id
        JOIN users u ON u.id = j.owner_user_id
        LEFT JOIN journal_rows jr ON jr.journal_id = j.id
        WHERE j.owner_user_id = $1
        GROUP BY j.id, d.name, u.full_name
        ORDER BY j.updated_at DESC`;
    } else {
      // available — только опубликованные журналы доступных отделений
      query = `
        SELECT j.id, j.title, j.department_id, d.name AS department_name,
               j.status, j.version, j.created_at, j.updated_at,
               COUNT(jr.id) FILTER (WHERE jr.deleted_at IS NULL) AS row_count
        FROM journals j
        JOIN departments d ON d.id = j.department_id
        JOIN department_journal_access dja ON dja.department_id = j.department_id
          AND dja.user_id = $1 AND dja.is_active = TRUE
        JOIN employee_departments ed ON ed.user_id = $1 AND ed.department_id = j.department_id
          AND ed.is_active = TRUE
        LEFT JOIN journal_rows jr ON jr.journal_id = j.id
        WHERE j.status = 'published'
        GROUP BY j.id, d.name
        ORDER BY d.name, j.title`;
    }

    const result = await withDbClient((client) => client.query(query, params));

    res.status(200).json(result.rows);
  } catch (error) {
    await handleHttpError(error, res, next);
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/journals — создание черновика
// ─────────────────────────────────────────────────────────────

export async function createJournal(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { title, departmentId, columns } = req.body as {
      title: string;
      departmentId: number;
      columns: Array<{ title: string; type: string; sort_order: number; is_editable_by_employee?: boolean }>;
    };

    if (!title?.trim()) throwHttp(400, 'VALIDATION_ERROR', 'title is required');
    if (!departmentId) throwHttp(400, 'VALIDATION_ERROR', 'departmentId is required');

    const journal = await withDbClient(async (client) => {
      await client.query('BEGIN');
      try {
        const result = await client.query<{ id: number }>(
          `INSERT INTO journals (title, department_id, owner_user_id, status)
           VALUES ($1, $2, $3, 'draft')
           RETURNING id`,
          [title.trim(), departmentId, req.user!.userId],
        );
        const journalId = result.rows[0].id;

        if (Array.isArray(columns) && columns.length > 0) {
          for (const col of columns) {
            await client.query(
              `INSERT INTO journal_columns (journal_id, title, type, sort_order, is_editable_by_employee)
               VALUES ($1, $2, $3, $4, $5)`,
              [journalId, col.title.trim(), col.type, col.sort_order, col.is_editable_by_employee ?? true],
            );
          }
        }

        await client.query('COMMIT');
        return { id: journalId };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    });

    res.status(201).json(journal);
  } catch (error) {
    await handleHttpError(error, res, next);
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/journals/:id
// ─────────────────────────────────────────────────────────────

export async function getJournal(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const journalId = Number(req.params.id);
    if (isNaN(journalId)) throwHttp(400, 'VALIDATION_ERROR', 'Invalid journal id');

    const result = await withDbClient((client) =>
      client.query(
        `SELECT j.id, j.title, j.department_id, d.name AS department_name,
                j.owner_user_id, u.full_name AS owner_name,
                j.status, j.version, j.schema_version, j.first_published_at,
                j.created_at, j.updated_at,
                COALESCE(
                  JSON_AGG(
                    JSON_BUILD_OBJECT(
                      'id', jc.id,
                      'title', jc.title,
                      'type', jc.type,
                      'sort_order', jc.sort_order,
                      'is_editable_by_employee', COALESCE(jc.is_editable_by_employee, TRUE)
                    ) ORDER BY jc.sort_order
                  ) FILTER (WHERE jc.id IS NOT NULL),
                  '[]'
                ) AS columns
         FROM journals j
         JOIN departments d ON d.id = j.department_id
         JOIN users u ON u.id = j.owner_user_id
         LEFT JOIN journal_columns jc ON jc.journal_id = j.id
         WHERE j.id = $1
         GROUP BY j.id, d.name, u.full_name`,
        [journalId],
      ),
    );

    const journal = result.rows[0];
    if (!journal) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Journal not found' });
      return;
    }

    const userId = req.user!.userId;
    const permissions = req.user!.permissions;
    const isOwner = journal.owner_user_id === userId;
    const isManager = permissions.canManageAllJournals || (permissions.canManageOwnJournals && isOwner);

    if (!isManager) {
      // Сотрудник — проверяем опубликованность и допуск
      if (journal.status !== 'published') {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Journal not found' });
        return;
      }

      const accessCheck = await withDbClient((client) =>
        client.query<{ ok: boolean }>(
          `SELECT EXISTS(
             SELECT 1 FROM department_journal_access dja
             JOIN employee_departments ed ON ed.user_id = dja.user_id AND ed.department_id = dja.department_id
             WHERE dja.user_id = $1 AND dja.department_id = $2 AND dja.is_active = TRUE AND ed.is_active = TRUE
           ) AS ok`,
          [userId, journal.department_id],
        ),
      );

      if (!accessCheck.rows[0]?.ok) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Journal not found' });
        return;
      }
    }

    res.status(200).json(journal);
  } catch (error) {
    await handleHttpError(error, res, next);
  }
}

// ─────────────────────────────────────────────────────────────
// PATCH /api/journals/:id — изменение метаданных
// ─────────────────────────────────────────────────────────────

export async function updateJournal(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const journalId = Number(req.params.id);
    if (isNaN(journalId)) throwHttp(400, 'VALIDATION_ERROR', 'Invalid journal id');

    const { title, expectedVersion } = req.body as { title: string; expectedVersion: number };

    await withDbClient(async (client) => {
      await client.query('BEGIN');
      try {
        const journal = await checkManageAccess(client, journalId, req.user!.userId, req.user!.permissions);

        if (expectedVersion !== undefined && journal.version !== expectedVersion) {
          throwHttp(409, 'VERSION_CONFLICT', 'Journal version conflict');
        }

        if (title?.trim()) {
          await client.query(
            `UPDATE journals SET title = $1, version = version + 1, updated_at = NOW() WHERE id = $2`,
            [title.trim(), journalId],
          );

          await client.query(
            `INSERT INTO journal_audit_events (object_type, object_id, action, actor_id, prev_data, new_data)
             VALUES ('journal', $1, 'rename', $2, $3, $4)`,
            [String(journalId), req.user!.userId, JSON.stringify({ title: journal.title }), JSON.stringify({ title: title.trim() })],
          );
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    });

    res.status(200).json({ message: 'Updated' });
  } catch (error) {
    await handleHttpError(error, res, next);
  }
}

// ─────────────────────────────────────────────────────────────
// PUT /api/journals/:id/columns — изменение схемы (только до публикации)
// ─────────────────────────────────────────────────────────────

export async function updateColumns(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const journalId = Number(req.params.id);
    const { columns } = req.body as {
      columns: Array<{ id?: string; title: string; type: string; sort_order: number; is_editable_by_employee?: boolean }>;
    };

    if (!Array.isArray(columns)) throwHttp(400, 'VALIDATION_ERROR', 'columns array required');

    await withDbClient(async (client) => {
      await client.query('BEGIN');
      try {
        const journal = await checkManageAccess(client, journalId, req.user!.userId, req.user!.permissions);

        if (journal.first_published_at) {
          throwHttp(403, 'FORBIDDEN', 'Cannot change schema after first publication');
        }

        const confirmationCols = columns.filter((c) => c.type === 'confirmation');
        if (confirmationCols.length > 1) {
          throwHttp(400, 'VALIDATION_ERROR', 'Only one confirmation column allowed');
        }

        // Удаляем старые колонки и пересоздаём
        await client.query('DELETE FROM journal_columns WHERE journal_id = $1', [journalId]);

        for (const col of columns) {
          await client.query(
            `INSERT INTO journal_columns (journal_id, title, type, sort_order, is_editable_by_employee)
             VALUES ($1, $2, $3, $4, $5)`,
            [journalId, col.title.trim(), col.type, col.sort_order, col.is_editable_by_employee ?? true],
          );
        }

        await client.query(
          `UPDATE journals SET schema_version = schema_version + 1, version = version + 1, updated_at = NOW() WHERE id = $1`,
          [journalId],
        );

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    });

    res.status(200).json({ message: 'Columns updated' });
  } catch (error) {
    await handleHttpError(error, res, next);
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/journals/:id/publish
// ─────────────────────────────────────────────────────────────

export async function publishJournal(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const journalId = Number(req.params.id);

    await withDbClient(async (client) => {
      await client.query('BEGIN');
      try {
        const journal = await checkManageAccess(client, journalId, req.user!.userId, req.user!.permissions);

        if (journal.status !== 'draft') throwHttp(400, 'VALIDATION_ERROR', 'Journal is not a draft');

        // Валидация схемы
        const colResult = await client.query<{ type: string }>(
          'SELECT type FROM journal_columns WHERE journal_id = $1',
          [journalId],
        );
        const cols = colResult.rows;
        if (cols.length === 0) throwHttp(400, 'VALIDATION_ERROR', 'Journal must have at least one column');

        const confirmCols = cols.filter((c) => c.type === 'confirmation');
        if (confirmCols.length !== 1) throwHttp(400, 'VALIDATION_ERROR', 'Journal must have exactly one confirmation column');

        const dataCols = cols.filter((c) => c.type !== 'confirmation');
        if (dataCols.length === 0) throwHttp(400, 'VALIDATION_ERROR', 'Journal must have at least one non-confirmation column');

        // Строки
        const rowResult = await client.query<{ cnt: string }>(
          'SELECT COUNT(*) AS cnt FROM journal_rows WHERE journal_id = $1 AND deleted_at IS NULL',
          [journalId],
        );
        if (Number(rowResult.rows[0].cnt) === 0) throwHttp(400, 'VALIDATION_ERROR', 'Journal must have at least one row');

        await client.query(
          `UPDATE journals SET status = 'published', first_published_at = NOW(),
           version = version + 1, updated_at = NOW()
           WHERE id = $1`,
          [journalId],
        );

        await client.query(
          `INSERT INTO journal_audit_events (object_type, object_id, action, actor_id)
           VALUES ('journal', $1, 'publish', $2)`,
          [String(journalId), req.user!.userId],
        );

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    });

    res.status(200).json({ message: 'Published' });
  } catch (error) {
    await handleHttpError(error, res, next);
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/journals/:id/archive и /restore
// ─────────────────────────────────────────────────────────────

export async function archiveJournal(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const journalId = Number(req.params.id);

    await withDbClient(async (client) => {
      await client.query('BEGIN');
      try {
        const journal = await checkManageAccess(client, journalId, req.user!.userId, req.user!.permissions);
        if (journal.status !== 'published') throwHttp(400, 'VALIDATION_ERROR', 'Only published journals can be archived');

        await client.query(
          `UPDATE journals SET status = 'archived', archived_at = NOW(), version = version + 1, updated_at = NOW() WHERE id = $1`,
          [journalId],
        );

        await client.query(
          `INSERT INTO journal_audit_events (object_type, object_id, action, actor_id) VALUES ('journal', $1, 'archive', $2)`,
          [String(journalId), req.user!.userId],
        );

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    });

    res.status(200).json({ message: 'Archived' });
  } catch (error) {
    await handleHttpError(error, res, next);
  }
}

export async function restoreJournal(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const journalId = Number(req.params.id);

    await withDbClient(async (client) => {
      await client.query('BEGIN');
      try {
        const journal = await checkManageAccess(client, journalId, req.user!.userId, req.user!.permissions);
        if (journal.status !== 'archived') throwHttp(400, 'VALIDATION_ERROR', 'Only archived journals can be restored');

        await client.query(
          `UPDATE journals SET status = 'published', archived_at = NULL, version = version + 1, updated_at = NOW() WHERE id = $1`,
          [journalId],
        );

        await client.query(
          `INSERT INTO journal_audit_events (object_type, object_id, action, actor_id) VALUES ('journal', $1, 'restore', $2)`,
          [String(journalId), req.user!.userId],
        );

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    });

    res.status(200).json({ message: 'Restored' });
  } catch (error) {
    await handleHttpError(error, res, next);
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/journals/:id/rows
// ─────────────────────────────────────────────────────────────

export async function getRows(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const journalId = Number(req.params.id);
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 100)));
    const offset = (page - 1) * limit;

    // Проверяем доступ к журналу (переиспользуем логику getJournal)
    const userId = req.user!.userId;
    const permissions = req.user!.permissions;
    const isManager = permissions.canManageAllJournals || permissions.canManageOwnJournals;

    if (!isManager) {
      const accessCheck = await withDbClient((client) =>
        client.query<{ ok: boolean; status: string }>(
          `SELECT j.status,
                  EXISTS(
                    SELECT 1 FROM department_journal_access dja
                    JOIN employee_departments ed ON ed.user_id = dja.user_id AND ed.department_id = dja.department_id
                    WHERE dja.user_id = $1 AND dja.department_id = j.department_id AND dja.is_active = TRUE AND ed.is_active = TRUE
                  ) AS ok
           FROM journals j WHERE j.id = $2`,
          [userId, journalId],
        ),
      );

      const info = accessCheck.rows[0];
      if (!info || info.status !== 'published' || !info.ok) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Journal not found or no access' });
        return;
      }
    }

    const totalResult = await withDbClient((client) =>
      client.query<{ total: string }>(
        'SELECT COUNT(*) AS total FROM journal_rows WHERE journal_id = $1 AND deleted_at IS NULL',
        [journalId],
      ),
    );
    const total = Number(totalResult.rows[0].total);

    const result = await withDbClient((client) =>
      client.query(
        `SELECT
           jr.id, jr.sort_order, jr.current_revision, jr.created_at, jr.updated_at,
           rev.values,
           c.id AS confirmation_id, c.signer_full_name, c.signer_position, c.confirmed_at, c.status AS confirmation_status
         FROM journal_rows jr
         JOIN journal_row_revisions rev ON rev.row_id = jr.id AND rev.revision = jr.current_revision
         LEFT JOIN journal_row_confirmations c ON c.row_id = jr.id AND c.status = 'active'
         WHERE jr.journal_id = $1 AND jr.deleted_at IS NULL
         ORDER BY jr.sort_order
         LIMIT $2 OFFSET $3`,
        [journalId, limit, offset],
      ),
    );

    res.status(200).json({ total, page, limit, rows: result.rows });
  } catch (error) {
    next(error);
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/journals/:id/rows — добавление строки
// ─────────────────────────────────────────────────────────────

export async function addRow(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const journalId = Number(req.params.id);
    const { values } = req.body as { values: Record<string, unknown> };

    const row = await withDbClient(async (client) => {
      await client.query('BEGIN');
      try {
        const journal = await checkManageAccess(client, journalId, req.user!.userId, req.user!.permissions);
        if (journal.status === 'archived') throwHttp(403, 'FORBIDDEN', 'Cannot add rows to archived journal');

        // Получаем схему журнала
        const colResult = await client.query<{ id: string; type: string }>(
          'SELECT id, type FROM journal_columns WHERE journal_id = $1',
          [journalId],
        );
        const schema = colResult.rows;
        const schemaSnapshot = Object.fromEntries(schema.map((c) => [c.id, { type: c.type }]));

        // Валидируем values
        validateRowValues(values ?? {}, schema);

        // Следующий sort_order
        const sortResult = await client.query<{ max_order: number | null }>(
          'SELECT MAX(sort_order) AS max_order FROM journal_rows WHERE journal_id = $1',
          [journalId],
        );
        const sortOrder = (sortResult.rows[0].max_order ?? 0) + 1;

        const rowResult = await client.query<{ id: number }>(
          `INSERT INTO journal_rows (journal_id, sort_order, current_revision) VALUES ($1, $2, 1) RETURNING id`,
          [journalId, sortOrder],
        );
        const rowId = rowResult.rows[0].id;

        // Создаём первую ревизию
        const cleanValues = filterValuesToSchema(values ?? {}, schema);
        await client.query(
          `INSERT INTO journal_row_revisions (row_id, revision, values, schema_snapshot, created_by)
           VALUES ($1, 1, $2, $3, $4)`,
          [rowId, JSON.stringify(cleanValues), JSON.stringify(schemaSnapshot), req.user!.userId],
        );

        await client.query(
          `UPDATE journals SET version = version + 1, updated_at = NOW() WHERE id = $1`,
          [journalId],
        );

        await client.query('COMMIT');
        return { id: rowId, sort_order: sortOrder, revision: 1 };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    });

    res.status(201).json(row);
  } catch (error) {
    await handleHttpError(error, res, next);
  }
}

// ─────────────────────────────────────────────────────────────
// PATCH /api/journals/:id/rows/:rowId — обновление строки
// ─────────────────────────────────────────────────────────────

export async function updateRow(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const journalId = Number(req.params.id);
    const rowId = Number(req.params.rowId);
    const { values, expectedRevision } = req.body as { values: Record<string, unknown>; expectedRevision: number };

    await withDbClient(async (client) => {
      await client.query('BEGIN');
      try {
        const journal = await checkManageAccess(client, journalId, req.user!.userId, req.user!.permissions);
        if (journal.status === 'archived') throwHttp(403, 'FORBIDDEN', 'Cannot edit rows in archived journal');

        const rowResult = await client.query<{ id: number; current_revision: number; journal_id: number }>(
          'SELECT id, current_revision, journal_id FROM journal_rows WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
          [rowId],
        );

        const row = rowResult.rows[0];
        if (!row || row.journal_id !== journalId) throwHttp(404, 'NOT_FOUND', 'Row not found');

        if (expectedRevision !== undefined && row.current_revision !== expectedRevision) {
          throwHttp(409, 'VERSION_CONFLICT', 'Row revision conflict');
        }

        // Проверяем наличие активного подтверждения
        const confirmResult = await client.query<{ id: number }>(
          `SELECT id FROM journal_row_confirmations WHERE row_id = $1 AND status = 'active'`,
          [rowId],
        );

        if (confirmResult.rows[0]) {
          throwHttp(409, 'ROW_ALREADY_CONFIRMED', 'Row has active confirmation. Use corrections endpoint instead.');
        }

        const colResult = await client.query<{ id: string; type: string }>(
          'SELECT id, type FROM journal_columns WHERE journal_id = $1',
          [journalId],
        );
        const schema = colResult.rows;
        validateRowValues(values, schema);

        const newRevision = row.current_revision + 1;
        const cleanValues = filterValuesToSchema(values, schema);
        const schemaSnapshot = Object.fromEntries(schema.map((c) => [c.id, { type: c.type }]));

        await client.query(
          `INSERT INTO journal_row_revisions (row_id, revision, values, schema_snapshot, created_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [rowId, newRevision, JSON.stringify(cleanValues), JSON.stringify(schemaSnapshot), req.user!.userId],
        );

        await client.query(
          `UPDATE journal_rows SET current_revision = $1, updated_at = NOW() WHERE id = $2`,
          [newRevision, rowId],
        );

        await client.query(
          `UPDATE journals SET version = version + 1, updated_at = NOW() WHERE id = $1`,
          [journalId],
        );

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    });

    res.status(200).json({ message: 'Row updated' });
  } catch (error) {
    await handleHttpError(error, res, next);
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/journals/:id/rows/:rowId — мягкое удаление
// ─────────────────────────────────────────────────────────────

export async function deleteRow(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const journalId = Number(req.params.id);
    const rowId = Number(req.params.rowId);
    const { reason } = req.body as { reason?: string };

    await withDbClient(async (client) => {
      await client.query('BEGIN');
      try {
        await checkManageAccess(client, journalId, req.user!.userId, req.user!.permissions);

        const rowResult = await client.query<{ id: number; journal_id: number }>(
          `SELECT id, journal_id FROM journal_rows WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
          [rowId],
        );
        const row = rowResult.rows[0];
        if (!row || row.journal_id !== journalId) throwHttp(404, 'NOT_FOUND', 'Row not found');

        // Не удаляем строки с подтверждениями
        const confirmResult = await client.query<{ id: number }>(
          `SELECT id FROM journal_row_confirmations WHERE row_id = $1 LIMIT 1`,
          [rowId],
        );
        if (confirmResult.rows[0]) {
          throwHttp(409, 'ROW_ALREADY_CONFIRMED', 'Cannot delete row with confirmation history');
        }

        await client.query(
          `UPDATE journal_rows SET deleted_at = NOW(), deleted_by = $1, deletion_reason = $2 WHERE id = $3`,
          [req.user!.userId, reason ?? null, rowId],
        );

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    });

    res.status(200).json({ message: 'Row deleted' });
  } catch (error) {
    await handleHttpError(error, res, next);
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/journals/:id/rows/:rowId/copy
// ─────────────────────────────────────────────────────────────

export async function copyRow(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const journalId = Number(req.params.id);
    const sourceRowId = Number(req.params.rowId);
    const { count, dateColumnId, stepDays, expectedRevision, idempotencyKey } = req.body as {
      count: number;
      dateColumnId?: string;
      stepDays?: number;
      expectedRevision: number;
      idempotencyKey?: string;
    };

    const maxCopies = Number(process.env.JOURNAL_COPY_MAX_ROWS ?? 365);
    if (!count || count < 1 || count > maxCopies) {
      throwHttp(400, 'VALIDATION_ERROR', `count must be between 1 and ${maxCopies}`);
    }

    const step = stepDays ?? 0;
    if (step < 0 || step > 365) throwHttp(400, 'VALIDATION_ERROR', 'stepDays must be between 0 and 365');

    // Идемпотентность копирования
    if (idempotencyKey) {
      const existing = await withDbClient((client) =>
        client.query<{ result_id: string }>(
          `SELECT result_id FROM idempotency_keys WHERE actor_user_id = $1 AND operation = 'copy_row' AND key = $2`,
          [req.user!.userId, idempotencyKey],
        ),
      );
      if (existing.rows[0]) {
        res.status(200).json({ message: 'Already copied', idempotencyKey });
        return;
      }
    }

    await withDbClient(async (client) => {
      await client.query('BEGIN');
      try {
        const journal = await checkManageAccess(client, journalId, req.user!.userId, req.user!.permissions);
        if (journal.status === 'archived') throwHttp(403, 'FORBIDDEN', 'Cannot copy rows in archived journal');

        const rowResult = await client.query<{ current_revision: number; journal_id: number }>(
          `SELECT current_revision, journal_id FROM journal_rows WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
          [sourceRowId],
        );
        const sourceRow = rowResult.rows[0];
        if (!sourceRow || sourceRow.journal_id !== journalId) throwHttp(404, 'NOT_FOUND', 'Source row not found');

        if (sourceRow.current_revision !== expectedRevision) {
          throwHttp(409, 'VERSION_CONFLICT', 'Source row has changed');
        }

        const revResult = await client.query<{ values: Record<string, string | null> }>(
          `SELECT values FROM journal_row_revisions WHERE row_id = $1 AND revision = $2`,
          [sourceRowId, expectedRevision],
        );
        const sourceValues = revResult.rows[0]?.values ?? {};

        const colResult = await client.query<{ id: string; type: string }>(
          'SELECT id, type FROM journal_columns WHERE journal_id = $1',
          [journalId],
        );
        const schema = colResult.rows;
        const schemaSnapshot = Object.fromEntries(schema.map((c) => [c.id, { type: c.type }]));

        const sortResult = await client.query<{ max_order: number | null }>(
          'SELECT MAX(sort_order) AS max_order FROM journal_rows WHERE journal_id = $1',
          [journalId],
        );
        let nextOrder = (sortResult.rows[0].max_order ?? 0) + 1;

        for (let i = 1; i <= count; i++) {
          const copyValues = { ...sourceValues };

          if (dateColumnId && step > 0) {
            const sourceDate = sourceValues[dateColumnId];
            if (sourceDate) {
              copyValues[dateColumnId] = addCalendarDays(sourceDate, i * step);
            }
          } else if (dateColumnId && step === 0) {
            // Оставляем дату без изменений
          }

          // Удаляем из значений colum confirmation-типа
          for (const col of schema) {
            if (col.type === 'confirmation') {
              delete copyValues[col.id];
            }
          }

          const newRowResult = await client.query<{ id: number }>(
            `INSERT INTO journal_rows (journal_id, sort_order, current_revision) VALUES ($1, $2, 1) RETURNING id`,
            [journalId, nextOrder++],
          );
          const newRowId = newRowResult.rows[0].id;

          await client.query(
            `INSERT INTO journal_row_revisions (row_id, revision, values, schema_snapshot, created_by)
             VALUES ($1, 1, $2, $3, $4)`,
            [newRowId, JSON.stringify(copyValues), JSON.stringify(schemaSnapshot), req.user!.userId],
          );
        }

        await client.query(
          `UPDATE journals SET version = version + 1, updated_at = NOW() WHERE id = $1`,
          [journalId],
        );

        if (idempotencyKey) {
          await client.query(
            `INSERT INTO idempotency_keys (actor_user_id, operation, key, result_id)
             VALUES ($1, 'copy_row', $2, $3)
             ON CONFLICT DO NOTHING`,
            [req.user!.userId, idempotencyKey, String(sourceRowId)],
          );
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    });

    res.status(200).json({ message: `${count} rows copied` });
  } catch (error) {
    await handleHttpError(error, res, next);
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/journals/:id/rows/:rowId/confirm
// ─────────────────────────────────────────────────────────────

export async function confirmRow(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const journalId = Number(req.params.id);
    const rowId = Number(req.params.rowId);
    const { expectedRevision, idempotencyKey, editableValues } = req.body as {
      expectedRevision: number;
      idempotencyKey?: string;
      editableValues?: Record<string, string | null>;
    };

    const userId = req.user!.userId;

    // Проверяем идемпотентность
    if (idempotencyKey) {
      const existing = await withDbClient((client) =>
        client.query<{ id: string }>(
          `SELECT result_id AS id FROM idempotency_keys WHERE actor_user_id = $1 AND operation = 'confirm_row' AND key = $2`,
          [userId, idempotencyKey],
        ),
      );
      if (existing.rows[0]) {
        res.status(200).json({ message: 'Already confirmed', idempotencyKey });
        return;
      }
    }

    await withDbClient(async (client) => {
      await client.query('BEGIN');
      try {
        // Проверяем актуальность данных пользователя
        const freshUser = await client.query<{ auth_version: number; is_active: boolean }>(
          `SELECT COALESCE(auth_version,0) AS auth_version, COALESCE(is_active, TRUE) AS is_active
           FROM users WHERE id = $1 FOR SHARE`,
          [userId],
        );
        const fu = freshUser.rows[0];
        if (!fu || !fu.is_active) throwHttp(403, 'ACCOUNT_DISABLED', 'Account is disabled');
        if (fu.auth_version !== req.user!.authVersion) throwHttp(401, 'TOKEN_REVOKED', 'Session revoked');

        // Проверяем доступ к журналу
        const journalResult = await client.query<{ status: string; department_id: number }>(
          'SELECT status, department_id FROM journals WHERE id = $1 FOR SHARE',
          [journalId],
        );
        const journal = journalResult.rows[0];
        if (!journal) throwHttp(404, 'NOT_FOUND', 'Journal not found');
        if (journal.status !== 'published') throwHttp(403, 'FORBIDDEN', 'Journal is not published');

        // Проверяем кадровую привязку и допуск
        const accessCheck = await client.query<{ ok: boolean; position: string | null }>(
          `SELECT TRUE AS ok, ed.position
           FROM department_journal_access dja
           JOIN employee_departments ed ON ed.user_id = dja.user_id AND ed.department_id = dja.department_id
           WHERE dja.user_id = $1 AND dja.department_id = $2 AND dja.is_active = TRUE AND ed.is_active = TRUE
           LIMIT 1`,
          [userId, journal.department_id],
        );
        if (!accessCheck.rows[0]?.ok) throwHttp(403, 'FORBIDDEN', 'No access to this journal');

        const signerPosition = accessCheck.rows[0].position;

        // Проверяем строку и ревизию
        const rowResult = await client.query<{ current_revision: number; journal_id: number }>(
          `SELECT current_revision, journal_id FROM journal_rows WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
          [rowId],
        );
        const row = rowResult.rows[0];
        if (!row || row.journal_id !== journalId) throwHttp(404, 'NOT_FOUND', 'Row not found');

        if (row.current_revision !== expectedRevision) {
          throwHttp(409, 'VERSION_CONFLICT', 'Row has been modified. Please review the current content.');
        }

        // Проверяем отсутствие действующего подтверждения
        const existingConfirm = await client.query<{ id: number }>(
          `SELECT id FROM journal_row_confirmations WHERE row_id = $1 AND status = 'active'`,
          [rowId],
        );
        if (existingConfirm.rows[0]) throwHttp(409, 'ROW_ALREADY_CONFIRMED', 'Row already confirmed');

        // ── Если переданы значения для редактируемых колонок — сохраняем как новую ревизию ──
        let confirmRevision = expectedRevision;

        if (editableValues && Object.keys(editableValues).length > 0) {
          // Получаем схему с флагом is_editable_by_employee
          const editableSchemaResult = await client.query<{ id: string; type: string; is_editable_by_employee: boolean }>(
            `SELECT id, type, COALESCE(is_editable_by_employee, TRUE) AS is_editable_by_employee
             FROM journal_columns WHERE journal_id = $1`,
            [journalId],
          );
          const editableSchema = editableSchemaResult.rows;
          const editableMap = new Map(editableSchema.map((c) => [c.id, c]));

          // Валидация: только editable-колонки, без confirmation, без unknown
          for (const [key, val] of Object.entries(editableValues)) {
            const col = editableMap.get(key);
            if (!col) throwHttp(422, 'VALIDATION_ERROR', `Unknown column id: ${key}`);
            if (!col.is_editable_by_employee) throwHttp(403, 'FORBIDDEN', `Column ${key} is not editable by employee`);
            if (col.type === 'confirmation') throwHttp(422, 'VALIDATION_ERROR', 'Cannot set confirmation column');
            if (val !== null && val !== undefined && val !== '') {
              if (typeof val !== 'string') throwHttp(422, 'VALIDATION_ERROR', `Column ${key}: value must be a string`);
              if (val.length > 2000) throwHttp(422, 'VALIDATION_ERROR', `Column ${key}: value exceeds max length`);
              if (col.type === 'date') {
                if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) throwHttp(422, 'VALIDATION_ERROR', `Column ${key}: date must be YYYY-MM-DD`);
                if (isNaN(new Date(val).getTime())) throwHttp(422, 'VALIDATION_ERROR', `Column ${key}: invalid date`);
              }
            }
          }

          // Загружаем текущие значения строки
          const curRevResult = await client.query<{ values: Record<string, string | null> }>(
            `SELECT values FROM journal_row_revisions WHERE row_id = $1 AND revision = $2`,
            [rowId, expectedRevision],
          );
          const currentValues: Record<string, string | null> = curRevResult.rows[0]?.values ?? {};

          // Мёржим: только editable-поля обновляются
          const mergedValues: Record<string, string | null> = { ...currentValues };
          for (const [key, val] of Object.entries(editableValues)) {
            mergedValues[key] = val === '' ? null : val;
          }

          const schemaSnapshot = Object.fromEntries(editableSchema.map((c) => [c.id, { type: c.type }]));
          confirmRevision = expectedRevision + 1;

          await client.query(
            `INSERT INTO journal_row_revisions (row_id, revision, values, schema_snapshot, created_by)
             VALUES ($1, $2, $3, $4, $5)`,
            [rowId, confirmRevision, JSON.stringify(mergedValues), JSON.stringify(schemaSnapshot), userId],
          );

          await client.query(
            `UPDATE journal_rows SET current_revision = $1, updated_at = NOW() WHERE id = $2`,
            [confirmRevision, rowId],
          );
        }

        // Получаем снимки для записи
        const deptResult = await client.query<{ name: string }>(
          'SELECT name FROM departments WHERE id = $1',
          [journal.department_id],
        );
        const journalResult2 = await client.query<{ title: string }>(
          'SELECT title FROM journals WHERE id = $1',
          [journalId],
        );
        const userNameResult = await client.query<{ full_name: string }>(
          'SELECT full_name FROM users WHERE id = $1',
          [userId],
        );

        // Сохраняем подтверждение
        const confirmKey = idempotencyKey ?? null;
        await client.query(
          `INSERT INTO journal_row_confirmations
             (row_id, row_revision, signer_user_id, signer_full_name, signer_position,
              department_name, journal_title, confirmed_at, idempotency_key)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)`,
          [
            rowId,
            confirmRevision,
            userId,
            userNameResult.rows[0]?.full_name ?? '',
            signerPosition,
            deptResult.rows[0]?.name ?? '',
            journalResult2.rows[0]?.title ?? '',
            confirmKey,
          ],
        );

        await client.query(
          `INSERT INTO journal_audit_events (object_type, object_id, action, actor_id)
           VALUES ('row', $1, 'confirm', $2)`,
          [String(rowId), userId],
        );

        if (idempotencyKey) {
          await client.query(
            `INSERT INTO idempotency_keys (actor_user_id, operation, key, result_id)
             VALUES ($1, 'confirm_row', $2, $3) ON CONFLICT DO NOTHING`,
            [userId, idempotencyKey, String(rowId)],
          );
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    });

    res.status(200).json({ message: 'Confirmed' });
  } catch (error: unknown) {
    // Уникальный индекс — ещё одна защита от race condition
    const e = error as { code?: string; httpStatus?: number; message?: string };
    if (e.code === '23505') {
      res.status(409).json({ code: 'ROW_ALREADY_CONFIRMED', message: 'Row already confirmed' });
      return;
    }
    await handleHttpError(error, res, next);
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/journals/:id/rows/:rowId/corrections
// ─────────────────────────────────────────────────────────────

export async function correctRow(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const journalId = Number(req.params.id);
    const rowId = Number(req.params.rowId);
    const { values, reason, expectedRevision } = req.body as {
      values: Record<string, unknown>;
      reason: string;
      expectedRevision: number;
    };

    if (!reason?.trim()) throwHttp(400, 'VALIDATION_ERROR', 'reason is required for corrections');

    await withDbClient(async (client) => {
      await client.query('BEGIN');
      try {
        await checkManageAccess(client, journalId, req.user!.userId, req.user!.permissions);

        const rowResult = await client.query<{ current_revision: number; journal_id: number }>(
          `SELECT current_revision, journal_id FROM journal_rows WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
          [rowId],
        );
        const row = rowResult.rows[0];
        if (!row || row.journal_id !== journalId) throwHttp(404, 'NOT_FOUND', 'Row not found');
        if (row.current_revision !== expectedRevision) throwHttp(409, 'VERSION_CONFLICT', 'Revision conflict');

        const colResult = await client.query<{ id: string; type: string }>(
          'SELECT id, type FROM journal_columns WHERE journal_id = $1',
          [journalId],
        );
        const schema = colResult.rows;
        validateRowValues(values, schema);
        const cleanValues = filterValuesToSchema(values, schema);
        const schemaSnapshot = Object.fromEntries(schema.map((c) => [c.id, { type: c.type }]));

        // Аннулируем активное подтверждение, если есть
        await client.query(
          `UPDATE journal_row_confirmations
           SET status = 'voided', voided_at = NOW(), voided_by = $1, void_reason = $2
           WHERE row_id = $3 AND status = 'active'`,
          [req.user!.userId, reason.trim(), rowId],
        );

        const newRevision = row.current_revision + 1;
        await client.query(
          `INSERT INTO journal_row_revisions (row_id, revision, values, schema_snapshot, created_by, change_reason)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [rowId, newRevision, JSON.stringify(cleanValues), JSON.stringify(schemaSnapshot), req.user!.userId, reason.trim()],
        );

        await client.query(
          `UPDATE journal_rows SET current_revision = $1, updated_at = NOW() WHERE id = $2`,
          [newRevision, rowId],
        );

        await client.query(
          `INSERT INTO journal_audit_events (object_type, object_id, action, actor_id, reason)
           VALUES ('row', $1, 'correction', $2, $3)`,
          [String(rowId), req.user!.userId, reason.trim()],
        );

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    });

    res.status(200).json({ message: 'Corrected' });
  } catch (error) {
    await handleHttpError(error, res, next);
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/journals/:id/rows/:rowId/history
// ─────────────────────────────────────────────────────────────

export async function getRowHistory(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const journalId = Number(req.params.id);
    const rowId = Number(req.params.rowId);

    await withDbClient(async (client) => {
      const journal = await checkManageAccess(client, journalId, req.user!.userId, req.user!.permissions);

      const rowCheck = await client.query<{ journal_id: number }>(
        'SELECT journal_id FROM journal_rows WHERE id = $1',
        [rowId],
      );
      if (!rowCheck.rows[0] || rowCheck.rows[0].journal_id !== journalId) {
        throwHttp(404, 'NOT_FOUND', 'Row not found');
      }
      void journal;

      const revisions = await client.query(
        `SELECT rev.revision, rev.values, rev.change_reason, rev.created_at,
                u.full_name AS created_by_name
         FROM journal_row_revisions rev
         LEFT JOIN users u ON u.id = rev.created_by
         WHERE rev.row_id = $1
         ORDER BY rev.revision DESC`,
        [rowId],
      );

      const confirmations = await client.query(
        `SELECT c.id, c.row_revision, c.signer_full_name, c.signer_position,
                c.confirmed_at, c.status, c.voided_at,
                vu.full_name AS voided_by_name, c.void_reason
         FROM journal_row_confirmations c
         LEFT JOIN users vu ON vu.id = c.voided_by
         WHERE c.row_id = $1
         ORDER BY c.confirmed_at DESC`,
        [rowId],
      );

      res.status(200).json({
        rowId,
        revisions: revisions.rows,
        confirmations: confirmations.rows,
      });
    });
  } catch (error) {
    await handleHttpError(error, res, next);
  }
}

// ─────────────────────────────────────────────────────────────
// Validation helpers
// ─────────────────────────────────────────────────────────────

type ColSchema = { id: string; type: string };

function validateRowValues(values: Record<string, unknown>, schema: ColSchema[]): void {
  const MAX_TEXT_LENGTH = 2000;
  const colMap = new Map(schema.map((c) => [c.id, c.type]));

  for (const [key, value] of Object.entries(values)) {
    if (!colMap.has(key)) {
      throwHttp(422, 'VALIDATION_ERROR', `Unknown column id: ${key}`);
    }
    const type = colMap.get(key)!;

    if (type === 'confirmation') {
      throwHttp(422, 'VALIDATION_ERROR', 'Cannot set confirmation column value directly');
    }

    if (value === null || value === undefined || value === '') continue;

    if (typeof value !== 'string') {
      throwHttp(422, 'VALIDATION_ERROR', `Column ${key}: value must be a string`);
    }

    if (value.length > MAX_TEXT_LENGTH) {
      throwHttp(422, 'VALIDATION_ERROR', `Column ${key}: value exceeds max length`);
    }

    if (type === 'date') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throwHttp(422, 'VALIDATION_ERROR', `Column ${key}: date must be YYYY-MM-DD`);
      }
      const d = new Date(value);
      if (isNaN(d.getTime())) {
        throwHttp(422, 'VALIDATION_ERROR', `Column ${key}: invalid date`);
      }
    }
  }
}

function filterValuesToSchema(values: Record<string, unknown>, schema: ColSchema[]): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  for (const col of schema) {
    if (col.type === 'confirmation') continue;
    const v = values[col.id];
    result[col.id] = (v === null || v === undefined || v === '') ? null : String(v);
  }
  return result;
}

function addCalendarDays(dateStr: string, days: number): string {
  // Работаем с календарными датами без timezone shifts
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dy}`;
}
