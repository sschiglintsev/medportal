import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

import { pool } from '../db';
import type { RolePermissions } from '../services/role.service';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set in environment variables');
  }
  return secret;
}

export type AuthPayload = JwtPayload & {
  userId: number;
  fullName: string;
  role: string;
  roleTitle: string;
  permissions: RolePermissions;
  authVersion?: number;      // claim добавлен в миграции 024
  mustChangePassword?: boolean; // заполняется requireAuth из БД
};

export type AuthenticatedRequest = Request & {
  user?: AuthPayload;
};

/**
 * requireAuth — проверяет JWT и актуальное состояние пользователя в БД.
 *
 * Проверяет:
 * 1. Подпись JWT
 * 2. is_active — заблокированный аккаунт не проходит даже с валидным токеном
 * 3. auth_version — при смене пароля/блокировке версия увеличивается,
 *    старые токены перестают работать
 *
 * НЕ блокирует при must_change_password — это делает requirePasswordChanged.
 * Публичные маршруты продолжают работать без токена.
 */
export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  _requireAuthAsync(req, res, next).catch(next);
}

async function _requireAuthAsync(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ code: 'UNAUTHENTICATED', message: 'Unauthorized' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();

  let jwtSecret: string;
  try {
    jwtSecret = getJwtSecret();
  } catch (err) {
    next(err);
    return;
  }

  let payload: AuthPayload;
  try {
    payload = jwt.verify(token, jwtSecret) as unknown as AuthPayload;
  } catch {
    res.status(401).json({ code: 'UNAUTHENTICATED', message: 'Invalid token' });
    return;
  }

  // Проверяем актуальное состояние пользователя в БД
  let dbUser: { is_active: boolean; auth_version: number; must_change_password: boolean } | undefined;
  try {
    const result = await pool.query<{
      is_active: boolean;
      auth_version: number;
      must_change_password: boolean;
    }>(
      `SELECT COALESCE(is_active, TRUE)             AS is_active,
              COALESCE(auth_version, 0)             AS auth_version,
              COALESCE(must_change_password, FALSE) AS must_change_password
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [payload.userId],
    );
    dbUser = result.rows[0];
  } catch (err) {
    next(err);
    return;
  }

  if (!dbUser) {
    res.status(401).json({ code: 'UNAUTHENTICATED', message: 'User not found' });
    return;
  }

  if (!dbUser.is_active) {
    res.status(403).json({ code: 'ACCOUNT_DISABLED', message: 'Account is disabled' });
    return;
  }

  // Проверяем версию токена: если в JWT нет claim — считаем 0 (совместимость)
  const tokenVersion = payload.authVersion ?? 0;
  if (tokenVersion !== dbUser.auth_version) {
    res.status(401).json({ code: 'TOKEN_REVOKED', message: 'Token has been revoked' });
    return;
  }

  // Прокидываем must_change_password в req для использования ниже
  req.user = { ...payload, mustChangePassword: dbUser.must_change_password };
  next();
}

/**
 * requirePasswordChanged — блокирует запросы если требуется смена пароля.
 * Используется после requireAuth для защищённых эндпоинтов.
 * Маршрут /api/auth/change-password и /api/auth/me пропускаются без этой проверки.
 */
export function requirePasswordChanged(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const user = req.user as (AuthPayload & { mustChangePassword?: boolean }) | undefined;
  if (user?.mustChangePassword) {
    res.status(403).json({
      code: 'PASSWORD_CHANGE_REQUIRED',
      message: 'You must change your password before proceeding',
    });
    return;
  }
  next();
}

export function requireRoles(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ code: 'UNAUTHENTICATED', message: 'Unauthorized' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Forbidden' });
      return;
    }

    next();
  };
}

export function requirePermission(permission: keyof RolePermissions) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ code: 'UNAUTHENTICATED', message: 'Unauthorized' });
      return;
    }

    if (!req.user.permissions?.[permission]) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Forbidden' });
      return;
    }

    next();
  };
}

export function requireAnyPermission(permissions: (keyof RolePermissions)[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ code: 'UNAUTHENTICATED', message: 'Unauthorized' });
      return;
    }

    const allowed = permissions.some((key) => req.user?.permissions?.[key] === true);
    if (!allowed) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Forbidden' });
      return;
    }

    next();
  };
}
