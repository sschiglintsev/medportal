import bcrypt from 'bcrypt';
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';

import { withDbClient } from '../db';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { ensureAuthTables, getRegistrationRoles, getRoleByValue } from '../services/role.service';

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
        'SELECT id, username, full_name, role, password_hash FROM users WHERE username = $1 LIMIT 1',
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
        }
      | undefined;

    if (!user) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    // users.role теперь хранит английский value (slug)
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

    // Проверяем по value (английскому слагу)
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

  res.status(200).json({
    user: {
      id: req.user.userId,
      fullName: req.user.fullName,
      role: req.user.role,
      roleTitle: req.user.roleTitle,
      permissions: req.user.permissions,
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
