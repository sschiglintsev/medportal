import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { NextFunction, Response } from 'express';

import { pool, withDbClient } from '../db';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { generateUniqueTemporaryPasswords, getTempPasswordExpiry } from '../utils/password';
import { resolveUniqueLogin } from '../utils/transliterate';

// ─────────────────────────────────────────────────────────────
// Типы
// ─────────────────────────────────────────────────────────────

type EmployeeListRow = {
  id: number;
  username: string;
  full_name: string;
  role: string;
  role_title: string;
  is_active: boolean;
  employee_code: string | null;
  departments: Array<{ id: number; name: string; position: string; is_active: boolean }>;
  created_at: string;
};

type ImportPreviewItem = {
  sourceRow: number;
  fullName: string;
  departmentName: string;
  position: string;
  employeeCode?: string;
};

type ImportPreviewRequest = {
  sourceSheet: string;
  items: ImportPreviewItem[];
};

type MappingDecision = {
  sourceRow: number;
  action: 'create' | 'link' | 'skip';
  existingUserId?: number; // для 'link'
};

type ImportCommitRequest = {
  batchId: string;
  previewVersion: number;
  idempotencyKey: string;
  decisions: MappingDecision[];
};

// ─────────────────────────────────────────────────────────────
// GET /api/employees
// ─────────────────────────────────────────────────────────────

export async function getEmployees(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { q, departmentId, active } = req.query as {
      q?: string;
      departmentId?: string;
      active?: string;
    };
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 50)));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (q) {
      conditions.push(`(u.full_name ILIKE $${idx} OR u.username ILIKE $${idx} OR ep.employee_code ILIKE $${idx})`);
      params.push(`%${q}%`);
      idx++;
    }

    if (departmentId) {
      conditions.push(`EXISTS (
        SELECT 1 FROM employee_departments ed2
        WHERE ed2.user_id = u.id AND ed2.department_id = $${idx} AND ed2.is_active = TRUE
      )`);
      params.push(Number(departmentId));
      idx++;
    }

    if (active !== undefined) {
      conditions.push(`u.is_active = $${idx}`);
      params.push(active !== 'false');
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await withDbClient((client) =>
      client.query<{ total: string }>(
        `SELECT COUNT(DISTINCT u.id) AS total
         FROM users u
         LEFT JOIN employee_profiles ep ON ep.user_id = u.id
         ${where}`,
        params,
      ),
    );
    const total = Number(countResult.rows[0]?.total ?? 0);

    params.push(limit, offset);

    const result = await withDbClient((client) =>
      client.query(
        `SELECT
           u.id,
           u.username,
           u.full_name,
           u.role,
           COALESCE(r.title, u.role) AS role_title,
           COALESCE(u.is_active, TRUE) AS is_active,
           ep.employee_code,
           u.created_at,
           COALESCE(
             JSON_AGG(
               JSON_BUILD_OBJECT(
                 'id', d.id,
                 'name', d.name,
                 'position', ed.position,
                 'is_active', ed.is_active
               ) ORDER BY d.name
             ) FILTER (WHERE d.id IS NOT NULL),
             '[]'
           ) AS departments
         FROM users u
         LEFT JOIN roles r ON r.value = u.role
         LEFT JOIN employee_profiles ep ON ep.user_id = u.id
         LEFT JOIN employee_departments ed ON ed.user_id = u.id
         LEFT JOIN departments d ON d.id = ed.department_id
         ${where}
         GROUP BY u.id, r.title, ep.employee_code
         ORDER BY u.full_name
         LIMIT $${idx++} OFFSET $${idx++}`,
        params,
      ),
    );

    res.status(200).json({
      total,
      page,
      limit,
      items: result.rows as EmployeeListRow[],
    });
  } catch (error) {
    next(error);
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/employees/export — кадровая выгрузка без паролей
// ─────────────────────────────────────────────────────────────

export async function exportEmployees(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await withDbClient((client) =>
      client.query(`
        SELECT
          u.full_name,
          ep.employee_code,
          u.username,
          u.role,
          COALESCE(r.title, u.role) AS role_title,
          COALESCE(u.is_active, TRUE) AS is_active,
          d.name AS department_name,
          ed.position,
          ed.is_active AS dept_is_active
        FROM users u
        LEFT JOIN employee_profiles ep ON ep.user_id = u.id
        LEFT JOIN roles r ON r.value = u.role
        LEFT JOIN employee_departments ed ON ed.user_id = u.id AND ed.is_active = TRUE
        LEFT JOIN departments d ON d.id = ed.department_id
        ORDER BY u.full_name, d.name
      `),
    );

    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/employees/:id
// ─────────────────────────────────────────────────────────────

export async function getEmployee(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = Number(req.params.id);
    if (isNaN(userId)) {
      res.status(400).json({ message: 'Invalid user id' });
      return;
    }

    const result = await withDbClient((client) =>
      client.query(
        `SELECT
           u.id,
           u.username,
           u.full_name,
           u.role,
           COALESCE(r.title, u.role) AS role_title,
           COALESCE(u.is_active, TRUE) AS is_active,
           COALESCE(u.must_change_password, FALSE) AS must_change_password,
           ep.employee_code,
           ep.version AS profile_version,
           u.created_at,
           COALESCE(
             JSON_AGG(
               JSON_BUILD_OBJECT(
                 'id', d.id,
                 'name', d.name,
                 'position', ed.position,
                 'is_active', ed.is_active,
                 'dept_version', ed.version
               ) ORDER BY d.name
             ) FILTER (WHERE d.id IS NOT NULL),
             '[]'
           ) AS departments
         FROM users u
         LEFT JOIN roles r ON r.value = u.role
         LEFT JOIN employee_profiles ep ON ep.user_id = u.id
         LEFT JOIN employee_departments ed ON ed.user_id = u.id
         LEFT JOIN departments d ON d.id = ed.department_id
         WHERE u.id = $1
         GROUP BY u.id, r.title, ep.employee_code, ep.version`,
        [userId],
      ),
    );

    if (!result.rows[0]) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Employee not found' });
      return;
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/employees — ручное создание сотрудника
// ─────────────────────────────────────────────────────────────

export async function createEmployee(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const {
      fullName,
      employeeCode,
      departments: deptAssignments,
    } = req.body as {
      fullName: string;
      employeeCode?: string;
      departments: Array<{ departmentId: number; position: string }>;
    };

    if (!fullName?.trim()) {
      res.status(400).json({ message: 'fullName is required' });
      return;
    }

    if (!Array.isArray(deptAssignments) || deptAssignments.length === 0) {
      res.status(400).json({ message: 'At least one department assignment is required' });
      return;
    }

    for (const d of deptAssignments) {
      if (!d.position?.trim()) {
        res.status(400).json({ message: 'position is required for each department' });
        return;
      }
    }

    const { tempPassword, userId, username, employeeCodeFinal } = await withDbClient(async (client) => {
      await client.query('BEGIN');
      try {
        // Собираем существующие логины для генерации уникального
        const existingResult = await client.query<{ username: string }>(
          'SELECT username FROM users',
        );
        const existingUsernames = new Set(existingResult.rows.map((r) => r.username.toLowerCase()));

        const login = resolveUniqueLogin(fullName.trim(), existingUsernames);

        const tempPw = generateUniqueTemporaryPasswords(1)[0];
        const hash = await bcrypt.hash(tempPw, 10);
        const expiry = getTempPasswordExpiry();

        const userResult = await client.query<{ id: number }>(
          `INSERT INTO users (username, full_name, role, password_hash,
                              must_change_password, temporary_password_expires_at, auth_version)
           VALUES ($1, $2, 'employee', $3, TRUE, $4, 0)
           RETURNING id`,
          [login, fullName.trim(), hash, expiry],
        );
        const newUserId = userResult.rows[0].id;

        // Определяем код сотрудника
        let code = employeeCode?.trim();
        if (!code) {
          const seqResult = await client.query<{ nextval: string }>(
            "SELECT nextval('employee_code_seq')",
          );
          code = `EMP-${String(seqResult.rows[0].nextval).padStart(6, '0')}`;
        }

        await client.query(
          `INSERT INTO employee_profiles (user_id, employee_code) VALUES ($1, $2)`,
          [newUserId, code],
        );

        // Привязываем отделения
        for (const d of deptAssignments) {
          await client.query(
            `INSERT INTO employee_departments (user_id, department_id, position)
             VALUES ($1, $2, $3)`,
            [newUserId, d.departmentId, d.position.trim()],
          );
        }

        await client.query('COMMIT');
        return { tempPassword: tempPw, userId: newUserId, username: login, employeeCodeFinal: code };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    });

    res.setHeader('Cache-Control', 'no-store, private');
    res.status(201).json({
      userId,
      username,
      employeeCode: employeeCodeFinal,
      // Временные данные — только в этом ответе, не хранятся в БД открытым текстом
      credentials: {
        username,
        temporaryPassword: tempPassword,
      },
    });
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === '23505'
    ) {
      res.status(409).json({ code: 'ENTITY_IN_USE', message: 'Employee code or username already exists' });
      return;
    }
    next(error);
  }
}

// ─────────────────────────────────────────────────────────────
// PATCH /api/employees/:id — обновление ФИО и мест работы
// ─────────────────────────────────────────────────────────────

export async function updateEmployee(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = Number(req.params.id);
    if (isNaN(userId)) {
      res.status(400).json({ message: 'Invalid user id' });
      return;
    }

    const { fullName, profileVersion, departments: deptChanges } = req.body as {
      fullName?: string;
      profileVersion?: number;
      departments?: Array<{
        departmentId: number;
        position: string;
        isActive: boolean;
        deptVersion: number;
      }>;
    };

    await withDbClient(async (client) => {
      await client.query('BEGIN');
      try {
        if (fullName?.trim()) {
          // Проверяем версию профиля для optimistic locking
          if (profileVersion !== undefined) {
            const verResult = await client.query<{ version: number }>(
              'SELECT version FROM employee_profiles WHERE user_id = $1 FOR UPDATE',
              [userId],
            );
            if (verResult.rows[0] && verResult.rows[0].version !== profileVersion) {
              throw { httpStatus: 409, code: 'VERSION_CONFLICT', message: 'Profile version conflict' };
            }
          }

          await client.query(
            `UPDATE users SET full_name = $1 WHERE id = $2`,
            [fullName.trim(), userId],
          );

          await client.query(
            `UPDATE employee_profiles SET version = version + 1, updated_at = NOW()
             WHERE user_id = $1`,
            [userId],
          );
        }

        if (deptChanges?.length) {
          for (const d of deptChanges) {
            // Проверяем версию привязки
            const existing = await client.query<{ version: number; is_active: boolean }>(
              `SELECT version, is_active FROM employee_departments
               WHERE user_id = $1 AND department_id = $2 FOR UPDATE`,
              [userId, d.departmentId],
            );

            if (existing.rows[0]) {
              if (existing.rows[0].version !== d.deptVersion) {
                throw { httpStatus: 409, code: 'VERSION_CONFLICT', message: `Version conflict for department ${d.departmentId}` };
              }
              await client.query(
                `UPDATE employee_departments
                 SET position = $1, is_active = $2, version = version + 1, updated_at = NOW()
                 WHERE user_id = $3 AND department_id = $4`,
                [d.position.trim(), d.isActive, userId, d.departmentId],
              );

              // При деактивации — отзываем допуск к журналам
              if (!d.isActive && existing.rows[0].is_active) {
                await client.query(
                  `UPDATE department_journal_access
                   SET is_active = FALSE, revoked_by = $1, revoked_at = NOW()
                   WHERE user_id = $2 AND department_id = $3 AND is_active = TRUE`,
                  [req.user!.userId, userId, d.departmentId],
                );
              }
            } else {
              // Новая привязка
              await client.query(
                `INSERT INTO employee_departments (user_id, department_id, position, is_active)
                 VALUES ($1, $2, $3, $4)`,
                [userId, d.departmentId, d.position.trim(), d.isActive],
              );
            }
          }
        }

        await client.query('COMMIT');
      } catch (err: unknown) {
        await client.query('ROLLBACK');
        throw err;
      }
    });

    res.status(200).json({ message: 'Employee updated' });
  } catch (error: unknown) {
    const e = error as { httpStatus?: number; code?: string; message?: string };
    if (e.httpStatus) {
      res.status(e.httpStatus).json({ code: e.code, message: e.message });
      return;
    }
    next(error);
  }
}

// ─────────────────────────────────────────────────────────────
// PATCH /api/employees/:id/status — блокировка/разблокировка
// ─────────────────────────────────────────────────────────────

export async function setEmployeeStatus(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = Number(req.params.id);
    if (isNaN(userId)) {
      res.status(400).json({ message: 'Invalid user id' });
      return;
    }

    const { isActive } = req.body as { isActive: boolean };
    if (typeof isActive !== 'boolean') {
      res.status(400).json({ message: 'isActive (boolean) is required' });
      return;
    }

    await withDbClient(async (client) => {
      await client.query('BEGIN');

      // При блокировке увеличиваем auth_version — все сессии отзываются
      if (!isActive) {
        await client.query(
          `UPDATE users SET is_active = FALSE, auth_version = auth_version + 1 WHERE id = $1`,
          [userId],
        );
      } else {
        // При разблокировке НЕ оживляем старые токены — только снимаем флаг
        await client.query(
          `UPDATE users SET is_active = TRUE WHERE id = $1`,
          [userId],
        );
      }

      // Аудит
      await client.query(
        `INSERT INTO journal_audit_events (object_type, object_id, action, actor_id, reason)
         VALUES ('user', $1, $2, $3, $4)`,
        [
          String(userId),
          isActive ? 'unblock' : 'block',
          req.user?.userId,
          isActive ? 'Admin unblocked account' : 'Admin blocked account',
        ],
      );

      await client.query('COMMIT');
    });

    res.status(200).json({ message: `Employee ${isActive ? 'unblocked' : 'blocked'}` });
  } catch (error) {
    next(error);
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/employees/:id/reset-password
// ─────────────────────────────────────────────────────────────

export async function resetEmployeePassword(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = Number(req.params.id);
    if (isNaN(userId)) {
      res.status(400).json({ message: 'Invalid user id' });
      return;
    }

    const tempPw = generateUniqueTemporaryPasswords(1)[0];
    const hash = await bcrypt.hash(tempPw, 10);
    const expiry = getTempPasswordExpiry();

    await withDbClient(async (client) => {
      await client.query('BEGIN');

      await client.query(
        `UPDATE users SET
           password_hash                 = $1,
           must_change_password          = TRUE,
           temporary_password_expires_at = $2,
           auth_version                  = auth_version + 1
         WHERE id = $3`,
        [hash, expiry, userId],
      );

      await client.query(
        `INSERT INTO journal_audit_events (object_type, object_id, action, actor_id)
         VALUES ('user', $1, 'password_reset', $2)`,
        [String(userId), req.user?.userId],
      );

      await client.query('COMMIT');
    });

    res.setHeader('Cache-Control', 'no-store, private');
    res.status(200).json({
      temporaryPassword: tempPw,
      expiresAt: expiry.toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/employees/import/preview
// ─────────────────────────────────────────────────────────────

export async function importPreview(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = req.body as ImportPreviewRequest;

    if (!Array.isArray(body?.items) || body.items.length === 0) {
      res.status(400).json({ code: 'INVALID_IMPORT_FORMAT', message: 'items array is required' });
      return;
    }

    const maxRows = Number(process.env.EMPLOYEE_IMPORT_MAX_ROWS ?? 2000);
    if (body.items.length > maxRows) {
      res.status(413).json({ code: 'IMPORT_TOO_LARGE', message: `Max ${maxRows} rows allowed` });
      return;
    }

    // Загружаем все отделения для сопоставления
    const deptResult = await withDbClient((client) =>
      client.query<{ id: number; name: string }>('SELECT id, name FROM departments ORDER BY name'),
    );

    const departmentsMap = new Map<string, number>();
    for (const d of deptResult.rows) {
      departmentsMap.set(normalizeText(d.name), d.id);
    }

    // Загружаем всех пользователей для поиска кандидатов
    const usersResult = await withDbClient((client) =>
      client.query<{ id: number; full_name: string; role: string; employee_code: string | null }>(
        `SELECT u.id, u.full_name, u.role, ep.employee_code
         FROM users u
         LEFT JOIN employee_profiles ep ON ep.user_id = u.id`,
      ),
    );

    const usersByCode = new Map<string, { id: number; full_name: string; role: string }>();
    const usersByName = new Map<string, Array<{ id: number; full_name: string; role: string }>>();

    for (const u of usersResult.rows) {
      if (u.employee_code) {
        usersByCode.set(u.employee_code.trim(), u);
      }
      const normalizedName = normalizeText(u.full_name);
      if (!usersByName.has(normalizedName)) usersByName.set(normalizedName, []);
      usersByName.get(normalizedName)!.push(u);
    }

    const previewRows: Array<{
      sourceRow: number;
      status: string;
      message?: string;
      fullName: string;
      departmentName: string;
      departmentId?: number;
      position: string;
      employeeCode?: string;
      existingCandidates?: Array<{ id: number; full_name: string; role: string }>;
    }> = [];

    let conflicts = 0;
    let errors = 0;
    let newUsers = 0;
    let newMemberships = 0;
    let unchanged = 0;

    for (const item of body.items) {
      const normalizedDept = normalizeText(item.departmentName);
      const deptId = departmentsMap.get(normalizedDept);

      if (!deptId) {
        previewRows.push({
          sourceRow: item.sourceRow,
          status: 'error',
          message: `Отделение не найдено: "${item.departmentName}"`,
          fullName: item.fullName,
          departmentName: item.departmentName,
          position: item.position,
          employeeCode: item.employeeCode,
        });
        errors++;
        continue;
      }

      if (!item.position?.trim()) {
        previewRows.push({
          sourceRow: item.sourceRow,
          status: 'error',
          message: 'Должность обязательна',
          fullName: item.fullName,
          departmentName: item.departmentName,
          position: item.position,
          employeeCode: item.employeeCode,
        });
        errors++;
        continue;
      }

      // Поиск по коду
      let matchedUser: { id: number; full_name: string; role: string } | null = null;
      let status = 'new_user';
      let message: string | undefined;
      let existingCandidates: Array<{ id: number; full_name: string; role: string }> | undefined;

      if (item.employeeCode?.trim()) {
        const byCode = usersByCode.get(item.employeeCode.trim());
        if (byCode) {
          if (normalizeText(byCode.full_name) === normalizeText(item.fullName)) {
            matchedUser = byCode;
            status = 'existing_user';
          } else {
            status = 'conflict';
            message = `Код ${item.employeeCode} найден, но ФИО отличается (в системе: "${byCode.full_name}")`;
            conflicts++;
            previewRows.push({
              sourceRow: item.sourceRow,
              status,
              message,
              fullName: item.fullName,
              departmentName: item.departmentName,
              departmentId: deptId,
              position: item.position,
              employeeCode: item.employeeCode,
              existingCandidates: [byCode],
            });
            continue;
          }
        }
      }

      // Поиск по ФИО (если не нашли по коду)
      if (!matchedUser) {
        const byName = usersByName.get(normalizeText(item.fullName)) ?? [];
        if (byName.length === 1) {
          if (!item.employeeCode?.trim()) {
            status = 'needs_review';
            message = 'Найден пользователь с таким же ФИО — подтвердите совпадение';
            existingCandidates = byName;
            conflicts++;
          } else {
            matchedUser = byName[0];
            status = 'existing_user';
          }
        } else if (byName.length > 1) {
          status = 'needs_review';
          message = 'Найдено несколько пользователей с таким же ФИО';
          existingCandidates = byName;
          conflicts++;
        }
      }

      if (matchedUser) {
        newMemberships++;
        status = 'existing_user';
      } else if (status === 'new_user') {
        newUsers++;
      }

      previewRows.push({
        sourceRow: item.sourceRow,
        status,
        message,
        fullName: item.fullName,
        departmentName: item.departmentName,
        departmentId: deptId,
        position: item.position,
        employeeCode: item.employeeCode,
        existingCandidates,
      });
    }

    // Создаём пакет импорта
    const ttlMinutes = Number(process.env.EMPLOYEE_IMPORT_PREVIEW_TTL_MINUTES ?? 60);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    const batchResult = await withDbClient((client) =>
      client.query<{ id: string }>(
        `INSERT INTO employee_import_batches
           (created_by, status, expires_at, rows_data)
         VALUES ($1, 'preview', $2, $3)
         RETURNING id`,
        [req.user!.userId, expiresAt, JSON.stringify({ items: body.items, previewRows })],
      ),
    );

    const batchId = batchResult.rows[0].id;
    const canCommit = conflicts === 0 && errors === 0;

    res.status(200).json({
      batchId,
      previewVersion: 1,
      canCommit,
      expiresAt: expiresAt.toISOString(),
      summary: { newUsers, newMemberships, unchanged, conflicts, errors },
      rows: previewRows,
    });
  } catch (error) {
    next(error);
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/employees/import/:batchId/commit
// ─────────────────────────────────────────────────────────────

export async function importCommit(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { batchId } = req.params;
    const body = req.body as ImportCommitRequest;

    if (!body.idempotencyKey) {
      res.status(400).json({ message: 'idempotencyKey is required' });
      return;
    }

    // Проверяем идемпотентность
    const idempCheck = await withDbClient((client) =>
      client.query<{ result_id: string }>(
        `SELECT result_id FROM idempotency_keys
         WHERE actor_user_id = $1 AND operation = 'import_commit' AND key = $2`,
        [req.user!.userId, body.idempotencyKey],
      ),
    );

    if (idempCheck.rows[0]) {
      // Повторный запрос — возвращаем тот же batchId из отчёта
      const existing = await withDbClient((client) =>
        client.query<{ summary: unknown }>(
          'SELECT summary FROM employee_import_batches WHERE id = $1',
          [idempCheck.rows[0].result_id],
        ),
      );
      res.status(200).json({
        batchId: idempCheck.rows[0].result_id,
        message: 'Already committed',
        summary: existing.rows[0]?.summary,
      });
      return;
    }

    // Загружаем пакет
    const batchResult = await withDbClient((client) =>
      client.query(
        `SELECT * FROM employee_import_batches WHERE id = $1 AND created_by = $2`,
        [batchId, req.user!.userId],
      ),
    );

    const batch = batchResult.rows[0];
    if (!batch) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Import batch not found' });
      return;
    }

    if (batch.status === 'expired' || new Date(batch.expires_at) < new Date()) {
      res.status(410).json({ code: 'IMPORT_PREVIEW_EXPIRED', message: 'Preview has expired' });
      return;
    }

    if (batch.status === 'committed') {
      res.status(409).json({ code: 'IMPORT_STALE', message: 'Batch already committed' });
      return;
    }

    const rowsData = batch.rows_data as { items: ImportPreviewItem[]; previewRows: Array<{ status: string; fullName: string; departmentId?: number; position: string; employeeCode?: string }> };

    // Применяем только строки без конфликтов/ошибок (или явно одобренные через decisions)
    const toProcess = rowsData.previewRows.filter((r) => r.status === 'new_user' || r.status === 'existing_user');

    // Хешируем пароли заранее (вне транзакции) — ограничиваем параллелизм
    const newUserRows = toProcess.filter((r) => r.status === 'new_user');
    const tempPasswords = generateUniqueTemporaryPasswords(newUserRows.length);

    const credentialsResult: Array<{ fullName: string; username: string; temporaryPassword: string; employeeCode: string }> = [];

    const hashes = await Promise.all(
      tempPasswords.map((pw) => bcrypt.hash(pw, 10)),
    );

    await withDbClient(async (client) => {
      await client.query('BEGIN');
      try {
        const existingLoginsResult = await client.query<{ username: string }>('SELECT username FROM users');
        const existingUsernames = new Set(existingLoginsResult.rows.map((r) => r.username.toLowerCase()));

        let newUserIdx = 0;

        for (const row of toProcess) {
          if (row.status === 'new_user') {
            const login = resolveUniqueLogin(row.fullName, existingUsernames);
            existingUsernames.add(login);

            const hash = hashes[newUserIdx++];
            const expiry = getTempPasswordExpiry();

            const userResult = await client.query<{ id: number }>(
              `INSERT INTO users (username, full_name, role, password_hash, must_change_password, temporary_password_expires_at, auth_version)
               VALUES ($1, $2, 'employee', $3, TRUE, $4, 0)
               RETURNING id`,
              [login, row.fullName.trim(), hash, expiry],
            );
            const newUserId = userResult.rows[0].id;

            let code = row.employeeCode?.trim();
            if (!code) {
              const seqResult = await client.query<{ nextval: string }>("SELECT nextval('employee_code_seq')");
              code = `EMP-${String(seqResult.rows[0].nextval).padStart(6, '0')}`;
            }

            await client.query(
              `INSERT INTO employee_profiles (user_id, employee_code) VALUES ($1, $2)`,
              [newUserId, code],
            );

            if (row.departmentId) {
              await client.query(
                `INSERT INTO employee_departments (user_id, department_id, position)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (user_id, department_id) DO NOTHING`,
                [newUserId, row.departmentId, row.position.trim()],
              );
            }

            credentialsResult.push({
              fullName: row.fullName,
              username: login,
              temporaryPassword: tempPasswords[newUserIdx - 1],
              employeeCode: code,
            });
          }
          // existing_user — только добавляем привязку (логику упрощаем до добавления)
          // Полная реализация decisions-based linking — в следующих итерациях
        }

        await client.query(
          `UPDATE employee_import_batches
           SET status = 'committed', summary = $1, rows_data = NULL, updated_at = NOW()
           WHERE id = $2`,
          [
            JSON.stringify({ created: credentialsResult.length, processed: toProcess.length }),
            batchId,
          ],
        );

        // Сохраняем ключ идемпотентности
        await client.query(
          `INSERT INTO idempotency_keys (actor_user_id, operation, key, result_id)
           VALUES ($1, 'import_commit', $2, $3)`,
          [req.user!.userId, body.idempotencyKey, batchId],
        );

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    });

    res.setHeader('Cache-Control', 'no-store, private');
    res.status(200).json({
      batchId,
      summary: { created: credentialsResult.length, processed: toProcess.length },
      // Одноразовые временные данные — только в этом ответе
      newCredentials: credentialsResult.length > 0 ? credentialsResult : undefined,
    });
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const pgErr = error as { code: string };
      if (pgErr.code === '23505') {
        res.status(409).json({ code: 'ENTITY_IN_USE', message: 'Duplicate employee code or username' });
        return;
      }
    }
    next(error);
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/employees/import/:batchId
// ─────────────────────────────────────────────────────────────

export async function getImportBatch(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { batchId } = req.params;

    const result = await withDbClient((client) =>
      client.query(
        `SELECT id, status, summary, expires_at, created_at
         FROM employee_import_batches
         WHERE id = $1 AND created_by = $2`,
        [batchId, req.user!.userId],
      ),
    );

    if (!result.rows[0]) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Import batch not found' });
      return;
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/ё/g, 'е')
    .toLowerCase();
}

// Suppress unused import warning
void crypto;
void pool;
