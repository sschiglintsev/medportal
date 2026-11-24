import { NextFunction, Response } from 'express';

import { pool, withDbClient } from '../db';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware';

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

type AccessUser = AuthenticatedRequest['user'] & object;

/** Менеджер модуля: главная медсестра / администратор. */
function isTempSheetManager(user: AccessUser): boolean {
  // role — надёжный признак (JWT мог быть выдан до появления canManageTempSheet)
  if (user.role === 'head_nurse' || user.role === 'administrator') return true;
  return user.permissions.canManageTempSheet === true
    || user.permissions.canAccessAdminCabinet === true;
}

async function userHasGrantedAccess(userId: number): Promise<boolean> {
  const r = await pool.query<{ is_active: boolean }>(
    'SELECT is_active FROM temp_sheet_user_access WHERE user_id = $1',
    [userId],
  );
  return r.rows[0]?.is_active === true;
}

async function userBelongsToDepart(userId: number, departmentId: number): Promise<boolean> {
  const r = await pool.query<{ id: number }>(
    `SELECT id FROM employee_departments
     WHERE user_id = $1 AND department_id = $2 AND is_active = TRUE`,
    [userId, departmentId],
  );
  return !!r.rows[0];
}

async function getUserDeptIds(userId: number): Promise<number[]> {
  const r = await pool.query<{ department_id: number }>(
    `SELECT department_id FROM employee_departments WHERE user_id = $1 AND is_active = TRUE`,
    [userId],
  );
  return r.rows.map((row) => row.department_id);
}

/**
 * Право просмотра/выгрузки:
 * - менеджер модуля — все отделения;
 * - сотрудник с выданным доступом — только свои отделения.
 */
async function assertCanViewModule(user: AccessUser): Promise<'manager' | 'editor'> {
  if (isTempSheetManager(user)) return 'manager';
  if (await userHasGrantedAccess(user.userId)) return 'editor';
  throwHttp(403, 'FORBIDDEN', 'Нет доступа к модулю «Температурный лист»');
}

/**
 * Право редактирования/очистки/создания:
 * - главная медсестра / администратор (canManageTempSheet) — да, по всем отделениям;
 * - сотрудник с выданным доступом — да, в своих отделениях.
 */
async function assertCanEditModule(user: AccessUser): Promise<void> {
  if (isTempSheetManager(user)) return;
  if (!(await userHasGrantedAccess(user.userId))) {
    throwHttp(403, 'FORBIDDEN', 'Нет доступа к модулю «Температурный лист»');
  }
}

async function assertCanViewSheet(user: AccessUser, departmentId: number): Promise<void> {
  const role = await assertCanViewModule(user);
  if (role === 'manager') return;
  if (!(await userBelongsToDepart(user.userId, departmentId))) {
    throwHttp(403, 'FORBIDDEN', 'Нет доступа к этому отделению');
  }
}

async function assertCanEditSheet(user: AccessUser, departmentId: number): Promise<void> {
  await assertCanEditModule(user);
  if (isTempSheetManager(user)) return;
  if (!(await userBelongsToDepart(user.userId, departmentId))) {
    throwHttp(403, 'FORBIDDEN', 'Нет доступа к этому отделению');
  }
}

async function loadSheetDepartment(sheetId: number): Promise<number> {
  const r = await pool.query<{ department_id: number }>(
    'SELECT department_id FROM temperature_sheets WHERE id = $1',
    [sheetId],
  );
  if (!r.rows[0]) throwHttp(404, 'NOT_FOUND', 'Sheet not found');
  return r.rows[0].department_id;
}

const VALID_BANDS = new Set([
  'above41', '40_409', '39_399', '38_389',
  '37_379', '36_369', '35_359', 'below35',
]);

const UPDATABLE_COLUMN_FIELDS = new Set([
  'stay_day', 'observation_date', 'observation_time',
  'temperature_band', 'respiratory_rate', 'spo2',
  'weight_kg', 'oral_fluid_ml', 'parenteral_fluid_ml',
  'urine_volume_ml', 'stool',
]);

const MAX_STAY_DAY = 100;
const MAX_SHORT = 20;
const MAX_STOOL = 500;

function sanitizeField(field: string, value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value !== 'string' && typeof value !== 'number') {
    throwHttp(400, 'VALIDATION_ERROR', `Invalid type for ${field}`);
  }
  const str = String(value).trim();
  if (str === '') return null;

  if (field === 'temperature_band') {
    if (!VALID_BANDS.has(str)) {
      throwHttp(400, 'VALIDATION_ERROR', `Invalid temperature_band: ${str}`);
    }
    return str;
  }
  if (field === 'observation_date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      throwHttp(400, 'VALIDATION_ERROR', 'observation_date must be YYYY-MM-DD');
    }
    return str;
  }
  if (field === 'observation_time') {
    // Accept HH:MM or HH:MM:SS
    if (!/^\d{2}:\d{2}(:\d{2})?$/.test(str)) {
      throwHttp(400, 'VALIDATION_ERROR', 'observation_time must be HH:MM');
    }
    return str.length === 5 ? `${str}:00` : str;
  }
  if (field === 'stool') {
    if (str.length > MAX_STOOL) {
      throwHttp(400, 'VALIDATION_ERROR', `stool max length is ${MAX_STOOL}`);
    }
    return str;
  }
  if (field === 'stay_day') {
    if (str.length > MAX_STAY_DAY) {
      throwHttp(400, 'VALIDATION_ERROR', `stay_day max length is ${MAX_STAY_DAY}`);
    }
    return str;
  }
  if (str.length > MAX_SHORT) {
    throwHttp(400, 'VALIDATION_ERROR', `${field} max length is ${MAX_SHORT}`);
  }
  return str;
}

// ─────────────────────────────────────────────────────────────
// GET /api/temp-sheets/my-access
// ─────────────────────────────────────────────────────────────

export async function getMyAccess(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user!;
    if (isTempSheetManager(user)) {
      res.status(200).json({
        hasAccess: true,
        role: 'manager',
        canEdit: true,
        canManageAccess: true,
      });
      return;
    }
    const hasAccess = await userHasGrantedAccess(user.userId);
    res.status(200).json({
      hasAccess,
      role: 'employee',
      canEdit: hasAccess,
      canManageAccess: false,
    });
  } catch (error) {
    next(error);
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/temp-sheets/departments
// ─────────────────────────────────────────────────────────────

export async function getTempSheetDepartments(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user!;
    const role = await assertCanViewModule(user);

    if (role === 'manager') {
      const r = await pool.query<{ id: number; name: string }>(
        'SELECT id, name FROM departments ORDER BY name',
      );
      res.status(200).json(r.rows);
      return;
    }

    const r = await pool.query<{ id: number; name: string }>(
      `SELECT d.id, d.name
       FROM departments d
       INNER JOIN employee_departments ed ON ed.department_id = d.id
         AND ed.user_id = $1 AND ed.is_active = TRUE
       ORDER BY d.name`,
      [user.userId],
    );
    res.status(200).json(r.rows);
  } catch (error) {
    await handleHttpError(error, res, next);
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/temp-sheets/patients?q=
// ─────────────────────────────────────────────────────────────

export async function searchPatients(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user!;
    await assertCanViewModule(user);

    const q = (req.query.q as string | undefined)?.trim() ?? '';
    const r = await pool.query<{ id: number; full_name: string; birth_date: string | null }>(
      `SELECT id, full_name, birth_date
       FROM patients
       WHERE ($1 = '' OR full_name ILIKE $2)
       ORDER BY full_name
       LIMIT 50`,
      [q, `%${q}%`],
    );
    res.status(200).json(r.rows);
  } catch (error) {
    await handleHttpError(error, res, next);
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/temp-sheets/patients
// ─────────────────────────────────────────────────────────────

export async function createPatient(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user!;
    await assertCanEditModule(user);

    const { full_name, birth_date } = req.body as {
      full_name: string;
      birth_date?: string | null;
    };

    if (!full_name?.trim()) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'full_name is required' });
      return;
    }
    if (full_name.trim().length > 255) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'full_name max length is 255' });
      return;
    }

    const r = await pool.query<{ id: number; full_name: string; birth_date: string | null }>(
      `INSERT INTO patients (full_name, birth_date)
       VALUES ($1, $2)
       RETURNING id, full_name, birth_date`,
      [full_name.trim(), birth_date || null],
    );

    res.status(201).json(r.rows[0]);
  } catch (error) {
    await handleHttpError(error, res, next);
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/temp-sheets
// ─────────────────────────────────────────────────────────────

export async function listSheets(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user!;
    const role = await assertCanViewModule(user);

    const q = (req.query.q as string | undefined)?.trim() ?? '';
    const deptId = req.query.departmentId ? Number(req.query.departmentId) : null;
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (role === 'editor') {
      const deptIds = await getUserDeptIds(user.userId);
      if (deptIds.length === 0) {
        res.status(200).json({ items: [], total: 0, page, limit });
        return;
      }
      conditions.push(`ts.department_id = ANY($${idx})`);
      params.push(deptIds);
      idx++;
    } else if (deptId) {
      conditions.push(`ts.department_id = $${idx}`);
      params.push(deptId);
      idx++;
    }

    if (q) {
      conditions.push(`p.full_name ILIKE $${idx}`);
      params.push(`%${q}%`);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total
       FROM temperature_sheets ts
       INNER JOIN patients p ON p.id = ts.patient_id
       ${where}`,
      params,
    );

    params.push(limit, offset);
    const dataResult = await pool.query(
      `SELECT ts.id, ts.patient_id, p.full_name AS patient_name, p.birth_date,
              ts.department_id, d.name AS department_name,
              ts.height_cm, ts.created_at, ts.updated_at
       FROM temperature_sheets ts
       INNER JOIN patients p ON p.id = ts.patient_id
       INNER JOIN departments d ON d.id = ts.department_id
       ${where}
       ORDER BY ts.updated_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params,
    );

    res.status(200).json({
      items: dataResult.rows,
      total: Number(countResult.rows[0]?.total ?? 0),
      page,
      limit,
    });
  } catch (error) {
    await handleHttpError(error, res, next);
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/temp-sheets — создать или открыть текущий лист
// ─────────────────────────────────────────────────────────────

export async function createOrGetSheet(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user!;
    const { patient_id, department_id, height_cm } = req.body as {
      patient_id: number;
      department_id: number;
      height_cm?: number | null;
    };

    if (!patient_id || !department_id) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'patient_id and department_id are required' });
      return;
    }

    await assertCanEditSheet(user, Number(department_id));

    const patResult = await pool.query<{ id: number }>('SELECT id FROM patients WHERE id = $1', [patient_id]);
    if (!patResult.rows[0]) throwHttp(404, 'NOT_FOUND', 'Patient not found');

    const deptResult = await pool.query<{ id: number }>('SELECT id FROM departments WHERE id = $1', [department_id]);
    if (!deptResult.rows[0]) throwHttp(404, 'NOT_FOUND', 'Department not found');

    const r = await pool.query(
      `INSERT INTO temperature_sheets (patient_id, department_id, height_cm, created_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (patient_id, department_id) DO UPDATE SET
         height_cm = COALESCE(EXCLUDED.height_cm, temperature_sheets.height_cm),
         updated_at = temperature_sheets.updated_at
       RETURNING id, patient_id, department_id, height_cm, created_at, updated_at`,
      [patient_id, department_id, height_cm ?? null, user.userId],
    );

    res.status(200).json(r.rows[0]);
  } catch (error) {
    await handleHttpError(error, res, next);
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/temp-sheets/:id
// ─────────────────────────────────────────────────────────────

export async function getSheet(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user!;
    const sheetId = Number(req.params.id);
    if (isNaN(sheetId)) throwHttp(400, 'BAD_REQUEST', 'Invalid sheet id');

    const sheetResult = await pool.query(
      `SELECT ts.id, ts.patient_id, p.full_name AS patient_name, p.birth_date,
              ts.department_id, d.name AS department_name,
              ts.height_cm, ts.created_at, ts.updated_at
       FROM temperature_sheets ts
       INNER JOIN patients p ON p.id = ts.patient_id
       INNER JOIN departments d ON d.id = ts.department_id
       WHERE ts.id = $1`,
      [sheetId],
    );
    const sheet = sheetResult.rows[0];
    if (!sheet) throwHttp(404, 'NOT_FOUND', 'Sheet not found');

    await assertCanViewSheet(user, sheet.department_id as number);

    const colsResult = await pool.query(
      `SELECT column_index, stay_day, observation_date, observation_time,
              temperature_band, respiratory_rate, spo2, weight_kg,
              oral_fluid_ml, parenteral_fluid_ml, urine_volume_ml, stool
       FROM temperature_sheet_columns
       WHERE sheet_id = $1
       ORDER BY column_index`,
      [sheetId],
    );

    const colsByIndex: Record<number, Record<string, unknown>> = {};
    for (const col of colsResult.rows) {
      colsByIndex[col.column_index as number] = col;
    }

    const columns: Array<Record<string, unknown>> = [];
    for (let i = 1; i <= 15; i++) {
      columns.push(colsByIndex[i] ?? {
        column_index: i,
        stay_day: null, observation_date: null, observation_time: null,
        temperature_band: null, respiratory_rate: null, spo2: null,
        weight_kg: null, oral_fluid_ml: null, parenteral_fluid_ml: null,
        urine_volume_ml: null, stool: null,
      });
    }

    const canEdit =
      isTempSheetManager(user) ||
      ((await userHasGrantedAccess(user.userId)) &&
        (await userBelongsToDepart(user.userId, sheet.department_id as number)));

    res.status(200).json({ ...sheet, columns, can_edit: canEdit });
  } catch (error) {
    await handleHttpError(error, res, next);
  }
}

// ─────────────────────────────────────────────────────────────
// PATCH /api/temp-sheets/:id/header
// ─────────────────────────────────────────────────────────────

export async function updateSheetHeader(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user!;
    const sheetId = Number(req.params.id);
    if (isNaN(sheetId)) throwHttp(400, 'BAD_REQUEST', 'Invalid sheet id');

    const { height_cm } = req.body as { height_cm?: number | null };
    const departmentId = await loadSheetDepartment(sheetId);
    await assertCanEditSheet(user, departmentId);

    let heightValue: number | null = null;
    if (height_cm !== undefined && height_cm !== null && height_cm !== ('' as unknown)) {
      const n = Number(height_cm);
      if (isNaN(n) || n < 0 || n > 300) {
        throwHttp(400, 'VALIDATION_ERROR', 'height_cm must be 0..300');
      }
      heightValue = n;
    }

    await pool.query(
      `UPDATE temperature_sheets SET height_cm = $1, updated_at = NOW() WHERE id = $2`,
      [heightValue, sheetId],
    );

    res.status(200).json({ ok: true });
  } catch (error) {
    await handleHttpError(error, res, next);
  }
}

// ─────────────────────────────────────────────────────────────
// PATCH /api/temp-sheets/:id/columns/:col
// ─────────────────────────────────────────────────────────────

export async function updateColumn(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user!;
    const sheetId = Number(req.params.id);
    const colIdx = Number(req.params.col);
    if (isNaN(sheetId) || isNaN(colIdx) || colIdx < 1 || colIdx > 15) {
      throwHttp(400, 'BAD_REQUEST', 'Invalid sheet id or column index');
    }

    const departmentId = await loadSheetDepartment(sheetId);
    await assertCanEditSheet(user, departmentId);

    const updates = req.body as Record<string, unknown>;
    const fieldNames: string[] = [];
    const values: unknown[] = [];

    for (const [field, raw] of Object.entries(updates)) {
      if (!UPDATABLE_COLUMN_FIELDS.has(field)) continue;
      fieldNames.push(field);
      values.push(sanitizeField(field, raw));
    }

    if (fieldNames.length === 0) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'No valid fields to update' });
      return;
    }

    const insertCols = ['sheet_id', 'column_index', ...fieldNames].join(', ');
    const insertPlaceholders = values
      .map((_, i) => `$${i + 3}`)
      .join(', ');
    const updateSet = fieldNames.map((f) => `${f} = EXCLUDED.${f}`).join(', ');

    await pool.query(
      `INSERT INTO temperature_sheet_columns (${insertCols})
       VALUES ($1, $2, ${insertPlaceholders})
       ON CONFLICT (sheet_id, column_index) DO UPDATE SET ${updateSet}`,
      [sheetId, colIdx, ...values],
    );

    await pool.query('UPDATE temperature_sheets SET updated_at = NOW() WHERE id = $1', [sheetId]);

    res.status(200).json({ ok: true });
  } catch (error) {
    await handleHttpError(error, res, next);
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/temp-sheets/:id/columns/:col
// ─────────────────────────────────────────────────────────────

export async function clearColumn(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user!;
    const sheetId = Number(req.params.id);
    const colIdx = Number(req.params.col);
    if (isNaN(sheetId) || isNaN(colIdx) || colIdx < 1 || colIdx > 15) {
      throwHttp(400, 'BAD_REQUEST', 'Invalid params');
    }

    const departmentId = await loadSheetDepartment(sheetId);
    await assertCanEditSheet(user, departmentId);

    await pool.query(
      `DELETE FROM temperature_sheet_columns WHERE sheet_id = $1 AND column_index = $2`,
      [sheetId, colIdx],
    );
    await pool.query('UPDATE temperature_sheets SET updated_at = NOW() WHERE id = $1', [sheetId]);

    res.status(200).json({ ok: true });
  } catch (error) {
    await handleHttpError(error, res, next);
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/temp-sheets/:id/columns
// ─────────────────────────────────────────────────────────────

export async function clearAllColumns(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user!;
    const sheetId = Number(req.params.id);
    if (isNaN(sheetId)) throwHttp(400, 'BAD_REQUEST', 'Invalid sheet id');

    const departmentId = await loadSheetDepartment(sheetId);
    await assertCanEditSheet(user, departmentId);

    await withDbClient(async (client) => {
      await client.query('BEGIN');
      try {
        await client.query('DELETE FROM temperature_sheet_columns WHERE sheet_id = $1', [sheetId]);
        await client.query('UPDATE temperature_sheets SET updated_at = NOW() WHERE id = $1', [sheetId]);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    });

    res.status(200).json({ ok: true });
  } catch (error) {
    await handleHttpError(error, res, next);
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/temp-sheets/module-access
// ─────────────────────────────────────────────────────────────

export async function getModuleAccess(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const r = await pool.query(
      `SELECT u.id AS user_id, u.full_name,
              ARRAY_AGG(
                CASE WHEN ed.is_active THEN d.name ELSE NULL END
                ORDER BY d.name
              ) FILTER (WHERE ed.is_active) AS departments,
              COALESCE(tsua.is_active, FALSE) AS has_access
       FROM users u
       LEFT JOIN employee_departments ed ON ed.user_id = u.id
       LEFT JOIN departments d ON d.id = ed.department_id
       LEFT JOIN temp_sheet_user_access tsua ON tsua.user_id = u.id
       WHERE u.role = 'employee'
       GROUP BY u.id, u.full_name, tsua.is_active
       ORDER BY u.full_name`,
    );
    res.status(200).json(r.rows);
  } catch (error) {
    next(error);
  }
}

// ─────────────────────────────────────────────────────────────
// PUT /api/temp-sheets/module-access
// ─────────────────────────────────────────────────────────────

export async function updateModuleAccess(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = req.user!;
    const { grantUserIds, revokeUserIds } = req.body as {
      grantUserIds: number[];
      revokeUserIds: number[];
    };

    const grantSet = new Set((grantUserIds ?? []).map(Number).filter((id) => !isNaN(id)));
    const revokeSet = new Set((revokeUserIds ?? []).map(Number).filter((id) => !isNaN(id)));
    const intersection = [...grantSet].filter((id) => revokeSet.has(id));
    if (intersection.length > 0) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'IDs cannot appear in both lists' });
      return;
    }

    // Нельзя выдать доступ самому себе через подмену — менеджер уже имеет canManageTempSheet
    if (grantSet.has(actor.userId) || revokeSet.has(actor.userId)) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Cannot change own module access here' });
      return;
    }

    await withDbClient(async (client) => {
      await client.query('BEGIN');
      try {
        for (const userId of grantSet) {
          // Только существующие сотрудники
          const u = await client.query<{ id: number }>(
            `SELECT id FROM users WHERE id = $1 AND role = 'employee'`,
            [userId],
          );
          if (!u.rows[0]) continue;

          await client.query(
            `INSERT INTO temp_sheet_user_access (user_id, is_active, granted_by, granted_at)
             VALUES ($1, TRUE, $2, NOW())
             ON CONFLICT (user_id) DO UPDATE
               SET is_active = TRUE, granted_by = $2, granted_at = NOW(),
                   revoked_by = NULL, revoked_at = NULL`,
            [userId, actor.userId],
          );
        }

        for (const userId of revokeSet) {
          await client.query(
            `UPDATE temp_sheet_user_access
             SET is_active = FALSE, revoked_by = $1, revoked_at = NOW()
             WHERE user_id = $2 AND is_active = TRUE`,
            [actor.userId, userId],
          );
        }

        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    });

    res.status(200).json({ ok: true });
  } catch (error) {
    next(error);
  }
}
