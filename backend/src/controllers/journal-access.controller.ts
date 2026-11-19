import { NextFunction, Response } from 'express';

import { withDbClient } from '../db';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware';

// ─────────────────────────────────────────────────────────────
// GET /api/journal-departments
// Управленцу — все отделения для настройки допуска;
// сотруднику — только отделения с активным допуском и опубликованными журналами
// ─────────────────────────────────────────────────────────────

export async function getJournalDepartments(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const user = req.user;
    const isManager =
      user.permissions.canManageJournalAccess || user.permissions.canManageAllJournals;

    let rows: Array<{ id: number; name: string; care_type: string | null }>;

    if (isManager) {
      // Администратор / главная медсестра видит все отделения
      const result = await withDbClient((client) =>
        client.query<{ id: number; name: string; care_type: string | null }>(
          `SELECT id, name, care_type FROM departments ORDER BY name`,
        ),
      );
      rows = result.rows;
    } else {
      // Сотрудник — только отделения с активным допуском
      const result = await withDbClient((client) =>
        client.query<{ id: number; name: string; care_type: string | null }>(
          `SELECT DISTINCT d.id, d.name, d.care_type
           FROM departments d
           INNER JOIN department_journal_access dja ON dja.department_id = d.id
             AND dja.user_id = $1 AND dja.is_active = TRUE
           INNER JOIN journals j ON j.department_id = d.id AND j.status = 'published'
           ORDER BY d.name`,
          [user.userId],
        ),
      );
      rows = result.rows;
    }

    res.status(200).json(rows);
  } catch (error) {
    next(error);
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/journal-departments/:departmentId/access
// Минимальный список сотрудников отделения + статус допуска
// ─────────────────────────────────────────────────────────────

export async function getDepartmentAccess(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const deptId = Number(req.params.departmentId);
    if (isNaN(deptId)) {
      res.status(400).json({ message: 'Invalid department id' });
      return;
    }

    // Версия списка для optimistic locking
    const settingsResult = await withDbClient((client) =>
      client.query<{ access_version: number }>(
        `SELECT access_version FROM journal_department_settings WHERE department_id = $1`,
        [deptId],
      ),
    );
    const accessVersion = settingsResult.rows[0]?.access_version ?? 0;

    // Только сотрудники с активной привязкой к отделению
    const result = await withDbClient((client) =>
      client.query(
        `SELECT
           u.id AS user_id,
           u.full_name,
           ed.position,
           COALESCE(dja.is_active, FALSE) AS has_access,
           dja.granted_at,
           dja.revoked_at
         FROM employee_departments ed
         INNER JOIN users u ON u.id = ed.user_id
         LEFT JOIN department_journal_access dja
           ON dja.user_id = u.id AND dja.department_id = $1
         WHERE ed.department_id = $1 AND ed.is_active = TRUE
         ORDER BY u.full_name`,
        [deptId],
      ),
    );

    res.status(200).json({
      departmentId: deptId,
      accessVersion,
      employees: result.rows,
    });
  } catch (error) {
    next(error);
  }
}

// ─────────────────────────────────────────────────────────────
// PUT /api/journal-departments/:departmentId/access
// Явное добавление/отзыв допуска с ожидаемой версией
// ─────────────────────────────────────────────────────────────

export async function updateDepartmentAccess(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const deptId = Number(req.params.departmentId);
    if (isNaN(deptId)) {
      res.status(400).json({ message: 'Invalid department id' });
      return;
    }

    const { expectedVersion, grantUserIds, revokeUserIds } = req.body as {
      expectedVersion: number;
      grantUserIds: number[];
      revokeUserIds: number[];
    };

    if (typeof expectedVersion !== 'number') {
      res.status(400).json({ message: 'expectedVersion is required' });
      return;
    }

    // Пересечение grantUserIds и revokeUserIds недопустимо
    const grantSet = new Set(grantUserIds ?? []);
    const revokeSet = new Set(revokeUserIds ?? []);
    const intersection = [...grantSet].filter((id) => revokeSet.has(id));
    if (intersection.length > 0) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'User IDs cannot appear in both grant and revoke lists',
      });
      return;
    }

    await withDbClient(async (client) => {
      await client.query('BEGIN');

      // Проверяем версию (optimistic locking)
      await client.query(
        `INSERT INTO journal_department_settings (department_id, access_version)
         VALUES ($1, 1)
         ON CONFLICT (department_id) DO NOTHING`,
        [deptId],
      );

      const verResult = await client.query<{ access_version: number }>(
        `SELECT access_version FROM journal_department_settings WHERE department_id = $1 FOR UPDATE`,
        [deptId],
      );

      const currentVersion = verResult.rows[0]?.access_version ?? 1;
      if (currentVersion !== expectedVersion && expectedVersion !== 0) {
        throw { httpStatus: 409, code: 'VERSION_CONFLICT', message: 'Access list version conflict' };
      }

      // Выдаём допуск — только сотрудникам с активной привязкой к отделению
      for (const userId of grantSet) {
        // Проверяем наличие активной кадровой привязки
        const edCheck = await client.query<{ id: number }>(
          `SELECT id FROM employee_departments
           WHERE user_id = $1 AND department_id = $2 AND is_active = TRUE`,
          [userId, deptId],
        );
        if (!edCheck.rows[0]) {
          throw {
            httpStatus: 400,
            code: 'VALIDATION_ERROR',
            message: `User ${userId} has no active assignment to this department`,
          };
        }

        await client.query(
          `INSERT INTO department_journal_access (department_id, user_id, is_active, granted_by, granted_at)
           VALUES ($1, $2, TRUE, $3, NOW())
           ON CONFLICT (department_id, user_id) DO UPDATE
             SET is_active = TRUE, granted_by = $3, granted_at = NOW(), revoked_by = NULL, revoked_at = NULL`,
          [deptId, userId, req.user!.userId],
        );
      }

      // Отзываем допуск
      for (const userId of revokeSet) {
        await client.query(
          `UPDATE department_journal_access
           SET is_active = FALSE, revoked_by = $1, revoked_at = NOW()
           WHERE department_id = $2 AND user_id = $3 AND is_active = TRUE`,
          [req.user!.userId, deptId, userId],
        );
      }

      // Обновляем версию
      await client.query(
        `UPDATE journal_department_settings
         SET access_version = access_version + 1, updated_at = NOW()
         WHERE department_id = $1`,
        [deptId],
      );

      // Аудит
      if (grantSet.size > 0 || revokeSet.size > 0) {
        await client.query(
          `INSERT INTO journal_audit_events (object_type, object_id, action, actor_id, new_data)
           VALUES ('department_access', $1, 'update', $2, $3)`,
          [
            String(deptId),
            req.user!.userId,
            JSON.stringify({ granted: [...grantSet], revoked: [...revokeSet] }),
          ],
        );
      }

      await client.query('COMMIT');
    });

    res.status(200).json({ message: 'Access updated' });
  } catch (error: unknown) {
    const e = error as { httpStatus?: number; code?: string; message?: string };
    if (e.httpStatus) {
      res.status(e.httpStatus).json({ code: e.code, message: e.message });
      return;
    }
    next(error);
  }
}
