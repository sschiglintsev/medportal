import { NextFunction, Response } from 'express';

import { withDbClient } from '../db';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware';
import {
  generateLinkCode,
  getLinkCodeTtlMinutes,
  hashCode,
  sendMaxMessage,
} from '../services/max-bot.service';

type MaxLinkRow = {
  max_chat_id: string | null;
  max_username: string | null;
  max_verified_at: string | null;
  max_notifications_enabled: boolean;
};

export async function getMaxLinkStatus(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;

    const result = await withDbClient((client) =>
      client.query<MaxLinkRow>(
        `SELECT max_chat_id, max_username, max_verified_at, max_notifications_enabled
         FROM users
         WHERE id = $1`,
        [userId],
      ),
    );

    const row = result.rows[0];
    if (!row) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.status(200).json({
      linked: Boolean(row.max_chat_id),
      maxUserId: row.max_chat_id ?? null,
      verifiedAt: row.max_verified_at ?? null,
      notificationsEnabled: row.max_notifications_enabled,
    });
  } catch (error) {
    next(error);
  }
}

export async function startMaxLink(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { maxUserId } = req.body as { maxUserId?: unknown };

    if (!maxUserId || typeof maxUserId !== 'string' || !/^\d+$/.test(maxUserId.trim())) {
      res.status(400).json({ message: 'maxUserId должен быть числовым идентификатором' });
      return;
    }

    const targetUserId = maxUserId.trim();
    const code = generateLinkCode();
    const codeHash = hashCode(code);
    const ttl = getLinkCodeTtlMinutes();
    const expiresAt = new Date(Date.now() + ttl * 60 * 1000);

    await withDbClient((client) =>
      client.query(
        `UPDATE users
         SET max_link_code_hash         = $1,
             max_link_code_expires_at   = $2,
             max_link_pending_user_id   = $3
         WHERE id = $4`,
        [codeHash, expiresAt, targetUserId, userId],
      ),
    );

    const messageText =
      `Код подтверждения для привязки к порталу ГБУЗ РБ ГДКБ №17:\n\n` +
      `${code}\n\n` +
      `Введите этот код в личном кабинете портала. Код действителен ${ttl} минут.`;

    await sendMaxMessage(targetUserId, messageText);

    res.status(200).json({ sent: true, ttlMinutes: ttl });
  } catch (error) {
    next(error);
  }
}

export async function verifyMaxLink(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { code } = req.body as { code?: unknown };

    if (!code || typeof code !== 'string' || !code.trim()) {
      res.status(400).json({ message: 'code обязателен' });
      return;
    }

    const codeHash = hashCode(code.trim());

    const result = await withDbClient((client) =>
      client.query<{ max_link_pending_user_id: string }>(
        `SELECT max_link_pending_user_id
         FROM users
         WHERE id = $1
           AND max_link_code_hash = $2
           AND max_link_code_expires_at > NOW()`,
        [userId, codeHash],
      ),
    );

    const row = result.rows[0];
    if (!row) {
      res.status(400).json({ message: 'Неверный или просроченный код' });
      return;
    }

    await withDbClient((client) =>
      client.query(
        `UPDATE users
         SET max_chat_id                = $1,
             max_verified_at            = NOW(),
             max_link_code_hash         = NULL,
             max_link_code_expires_at   = NULL,
             max_link_pending_user_id   = NULL
         WHERE id = $2`,
        [row.max_link_pending_user_id, userId],
      ),
    );

    res.status(200).json({ linked: true });
  } catch (error) {
    next(error);
  }
}

export async function unlinkMax(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;

    await withDbClient((client) =>
      client.query(
        `UPDATE users
         SET max_chat_id                = NULL,
             max_verified_at            = NULL,
             max_link_code_hash         = NULL,
             max_link_code_expires_at   = NULL,
             max_link_pending_user_id   = NULL
         WHERE id = $1`,
        [userId],
      ),
    );

    res.status(200).json({ message: 'Max unlinked' });
  } catch (error) {
    next(error);
  }
}

export async function toggleMaxNotifications(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { enabled } = req.body as { enabled?: unknown };

    if (typeof enabled !== 'boolean') {
      res.status(400).json({ message: 'enabled must be boolean' });
      return;
    }

    await withDbClient((client) =>
      client.query(
        `UPDATE users SET max_notifications_enabled = $1 WHERE id = $2`,
        [enabled, userId],
      ),
    );

    res.status(200).json({ notificationsEnabled: enabled });
  } catch (error) {
    next(error);
  }
}
