import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

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
};

export type AuthenticatedRequest = Request & {
  user?: AuthPayload;
};

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  const jwtSecret = getJwtSecret();

  try {
    const payload = jwt.verify(token, jwtSecret) as unknown as AuthPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
}

export function requireRoles(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    next();
  };
}

export function requirePermission(permission: keyof RolePermissions) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    if (!req.user.permissions?.[permission]) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    next();
  };
}

export function requireAnyPermission(permissions: (keyof RolePermissions)[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const allowed = permissions.some((key) => req.user?.permissions?.[key] === true);
    if (!allowed) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    next();
  };
}
