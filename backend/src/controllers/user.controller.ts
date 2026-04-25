import bcrypt from 'bcrypt';
import { NextFunction, Request, Response } from 'express';

import { withDbClient } from '../db';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { getRoleByValue } from '../services/role.service';

type UserRow = {
  id: number;
  username: string;
  full_name: string;
  role: string;
  role_title: string;
  created_at: string;
};

type UpdateUserBody = {
  fullName?: string;
  role?: string;
  password?: string;
};

export async function getUsers(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await withDbClient((client) =>
      client.query<UserRow>(`
        SELECT
          u.id,
          u.username,
          u.full_name,
          u.role,
          COALESCE(r.title, u.role) AS role_title,
          u.created_at
        FROM users u
        LEFT JOIN roles r ON r.value = u.role
        ORDER BY u.id
      `),
    );

    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function updateUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = Number(req.params.id);
    if (isNaN(userId)) {
      res.status(400).json({ message: 'Invalid user id' });
      return;
    }

    const body = req.body as Partial<UpdateUserBody>;

    if (!body.fullName && !body.role && !body.password) {
      res.status(400).json({ message: 'No fields to update' });
      return;
    }

    // Проверяем что пользователь существует
    const existing = await withDbClient((client) =>
      client.query<{ id: number }>('SELECT id FROM users WHERE id = $1', [userId]),
    );

    if (!existing.rows[0]) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // Валидируем роль если передана
    if (body.role) {
      const roleMeta = await getRoleByValue(body.role);
      if (!roleMeta || !roleMeta.is_active) {
        res.status(400).json({ message: 'Invalid role value' });
        return;
      }
    }

    // Строим SET-часть запроса динамически
    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (body.fullName) {
      updates.push(`full_name = $${paramIdx++}`);
      params.push(body.fullName.trim());
    }

    if (body.role) {
      updates.push(`role = $${paramIdx++}`);
      params.push(body.role);
    }

    if (body.password) {
      const hash = await bcrypt.hash(body.password, 10);
      updates.push(`password_hash = $${paramIdx++}`);
      params.push(hash);
    }

    params.push(userId);

    const result = await withDbClient((client) =>
      client.query<UserRow>(
        `
        UPDATE users SET ${updates.join(', ')}
        WHERE id = $${paramIdx}
        RETURNING id, username, full_name, role, created_at
        `,
        params,
      ),
    );

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function deleteUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = Number(req.params.id);
    if (isNaN(userId)) {
      res.status(400).json({ message: 'Invalid user id' });
      return;
    }

    // Запрещаем удалять самого себя
    if (req.user && req.user.userId === userId) {
      res.status(400).json({ message: 'Cannot delete yourself' });
      return;
    }

    const result = await withDbClient((client) =>
      client.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]),
    );

    if (result.rows.length === 0) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.status(200).json({ message: 'User deleted' });
  } catch (error) {
    next(error);
  }
}
