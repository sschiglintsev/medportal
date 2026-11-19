import bcrypt from 'bcrypt';
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';

import { withDbClient } from '../db';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { ensureAuthTables, getRegistrationRoles, getRoleByValue } from '../services/role.service';

// Роли, которые нельзя выдавать через публичную регистрацию
const PRIVILEGED_ROLES = new Set([
  'administrator',
  'head_nurse',
  'chief_doctor',
  'quality_department',
  'it_department',
  'facility',
  'metrologist',
  'dispatcher',
]);

type LoginBody = {
  username: string;
  password: string;
};

type RegisterBody = {
  username: string;
  fullName: string;
  role: string;
  password: string;
};

type ChangePasswordBody = {
  currentPassword: string;
  newPassword: string;
};

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set in environment variables');
  }
  return secret;
}

function getJwtExpiresIn(): SignOptions['expiresIn'] {
  const expiresIn = process.env.JWT_EXPIRES_IN;
  return (expiresIn as SignOptions['expiresIn']) ?? '1d';
}

function buildUserPayload(
  user: { id: number; full_name: string },
  roleMeta: ReturnType<typeof getRoleByValue> extends Promise<infer T> ? NonNullable<T> : never,
  authVersion: number,
  mustChangePassword: boolean,
) {
  return {
    id: user.id,
    fullName: user.full_name,
    role: roleMeta.value,
    roleTitle: roleMeta.title,
    permissions: roleMeta.permissions,
    mustChangePassword,
  };
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await ensureAuthTables();

    const body = req.body as Partial<LoginBody>;

    if (!body.username || !body.password) {
      res.status(400).json({ message: 'username and password are required' });
      return;
    }
    const username = body.username.trim();
    const password = body.password;

    const result = await withDbClient((client) =>
      client.query(
        `SELECT id, username, full_name, role, password_hash,
                COALESCE(is_active, TRUE)              AS is_active,
                COALESCE(auth_version, 0)              AS auth_version,
                COALESCE(must_change_password, FALSE)  AS must_change_password,
                temporary_password_expires_at
         FROM users WHERE username = $1 LIMIT 1`,
        [username],
      ),
    );

    const user = result.rows[0] as
      | {
          id: number;
          username: string;
          full_name: string;
          role: string;
          password_hash: string;
          is_active: boolean;
          auth_version: number;
          must_change_password: boolean;
          temporary_password_expires_at: string | null;
        }
      | undefined;

    if (!user) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    // Проверяем активность аккаунта
    if (!user.is_active) {
      res.status(403).json({ code: 'ACCOUNT_DISABLED', message: 'Account is disabled' });
      return;
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    // Проверяем срок временного пароля
    if (user.temporary_password_expires_at) {
      const expiry = new Date(user.temporary_password_expires_at);
      if (expiry < new Date()) {
        res
          .status(401)
          .json({ code: 'TEMP_PASSWORD_EXPIRED', message: 'Temporary password has expired. Contact administrator.' });
        return;
      }
    }

    const roleMeta = await getRoleByValue(user.role);
    if (!roleMeta || !roleMeta.is_active) {
      res.status(403).json({ message: 'Role is inactive or not found' });
      return;
    }

    const token = jwt.sign(
      {
        userId: user.id,
        fullName: user.full_name,
        role: roleMeta.value,
        roleTitle: roleMeta.title,
        permissions: roleMeta.permissions,
        authVersion: user.auth_version,
      },
      getJwtSecret(),
      { expiresIn: getJwtExpiresIn() },
    );

    res.status(200).json({
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        role: roleMeta.value,
        roleTitle: roleMeta.title,
        permissions: roleMeta.permissions,
        mustChangePassword: user.must_change_password,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await ensureAuthTables();

    const body = req.body as Partial<RegisterBody>;

    if (!body.username || !body.fullName || !body.role || !body.password) {
      res.status(400).json({ message: 'username, fullName, role and password are required' });
      return;
    }
    const username = body.username.trim();
    const fullName = body.fullName.trim();
    const roleValue = body.role;
    const password = body.password;

    // Серверная проверка: публичная регистрация не выдаёт привилегированные роли
    if (PRIVILEGED_ROLES.has(roleValue)) {
      res.status(403).json({ message: 'Cannot register with a privileged role' });
      return;
    }

    const roleMeta = await getRoleByValue(roleValue);
    if (!roleMeta || !roleMeta.is_active) {
      res.status(400).json({ message: 'Invalid role value' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await withDbClient((client) =>
      client.query(
        `INSERT INTO users (username, full_name, role, password_hash)
         VALUES ($1, $2, $3, $4)
         RETURNING id, username, full_name, role, created_at`,
        [username, fullName, roleValue, passwordHash],
      ),
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export function me(req: AuthenticatedRequest, res: Response): void {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const user = req.user as AuthenticatedRequest['user'] & { mustChangePassword?: boolean };

  res.status(200).json({
    user: {
      id: req.user.userId,
      fullName: req.user.fullName,
      role: req.user.role,
      roleTitle: req.user.roleTitle,
      permissions: req.user.permissions,
      mustChangePassword: user.mustChangePassword ?? false,
    },
  });
}

export async function roles(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await getRegistrationRoles();
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
}

/**
 * changePassword — смена пароля текущим пользователем.
 * - Требует действующий пароль
 * - Увеличивает auth_version (инвалидирует все старые JWT)
 * - Снимает must_change_password и срок временного пароля
 * - Возвращает новый токен
 */
export async function changePassword(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const body = req.body as Partial<ChangePasswordBody>;
    if (!body.currentPassword || !body.newPassword) {
      res.status(400).json({ message: 'currentPassword and newPassword are required' });
      return;
    }

    const newPassword = body.newPassword;

    // Минимальная длина нового пароля — 15 символов (проектная политика)
    if (newPassword.length < 15) {
      res.status(422).json({
        code: 'VALIDATION_ERROR',
        message: 'New password must be at least 15 characters',
      });
      return;
    }

    // Bcrypt ограничен 72 байтами — проверяем длину в байтах
    if (Buffer.byteLength(newPassword, 'utf8') > 72) {
      res.status(422).json({
        code: 'VALIDATION_ERROR',
        message: 'New password is too long (max 72 bytes)',
      });
      return;
    }

    // Получаем текущий хеш и версию из БД
    const dbResult = await withDbClient((client) =>
      client.query<{ password_hash: string; auth_version: number; must_change_password: boolean }>(
        `SELECT password_hash,
                COALESCE(auth_version, 0) AS auth_version,
                COALESCE(must_change_password, FALSE) AS must_change_password
         FROM users WHERE id = $1 LIMIT 1`,
        [req.user!.userId],
      ),
    );

    const dbUser = dbResult.rows[0];
    if (!dbUser) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const isValidCurrent = await bcrypt.compare(body.currentPassword, dbUser.password_hash);
    if (!isValidCurrent) {
      res.status(422).json({
        code: 'VALIDATION_ERROR',
        message: 'Current password is incorrect',
      });
      return;
    }

    // Новый пароль не должен совпадать с текущим
    const isSamePassword = await bcrypt.compare(newPassword, dbUser.password_hash);
    if (isSamePassword) {
      res.status(422).json({
        code: 'VALIDATION_ERROR',
        message: 'New password must differ from current password',
      });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    const newVersion = dbUser.auth_version + 1;

    await withDbClient((client) =>
      client.query(
        `UPDATE users SET
           password_hash                  = $1,
           auth_version                   = $2,
           must_change_password           = FALSE,
           temporary_password_expires_at  = NULL,
           password_changed_at            = NOW()
         WHERE id = $3`,
        [newHash, newVersion, req.user!.userId],
      ),
    );

    // Получаем обновлённую роль для нового токена
    const roleMeta = await getRoleByValue(req.user.role);
    if (!roleMeta) {
      res.status(500).json({ message: 'Role not found' });
      return;
    }

    const newToken = jwt.sign(
      {
        userId: req.user.userId,
        fullName: req.user.fullName,
        role: roleMeta.value,
        roleTitle: roleMeta.title,
        permissions: roleMeta.permissions,
        authVersion: newVersion,
      },
      getJwtSecret(),
      { expiresIn: getJwtExpiresIn() },
    );

    res.status(200).json({
      token: newToken,
      user: {
        id: req.user.userId,
        fullName: req.user.fullName,
        role: roleMeta.value,
        roleTitle: roleMeta.title,
        permissions: roleMeta.permissions,
        mustChangePassword: false,
      },
    });
  } catch (error) {
    next(error);
  }
}

// Вспомогательная функция для использования в employees controller
export async function buildTokenForUser(
  userId: number,
  fullName: string,
  role: string,
  authVersion: number,
): Promise<{ token: string; roleMeta: Awaited<ReturnType<typeof getRoleByValue>> }> {
  const roleMeta = await getRoleByValue(role);
  if (!roleMeta) throw new Error('Role not found');

  const token = jwt.sign(
    {
      userId,
      fullName,
      role: roleMeta.value,
      roleTitle: roleMeta.title,
      permissions: roleMeta.permissions,
      authVersion,
    },
    getJwtSecret(),
    { expiresIn: getJwtExpiresIn() },
  );

  return { token, roleMeta };
}
