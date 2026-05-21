import crypto from 'node:crypto';

import { withDbClient } from '../db';

const MAX_API_BASE = 'https://platform-api.max.ru';
const CODE_TTL_MINUTES = 10;

function getBotToken(): string | null {
  return process.env.MAX_BOT_TOKEN ?? null;
}

export function generateLinkCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

export function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code.toUpperCase()).digest('hex');
}

export function getLinkCodeTtlMinutes(): number {
  return CODE_TTL_MINUTES;
}

export async function sendMaxMessage(userId: string | number, text: string): Promise<void> {
  const token = getBotToken();
  if (!token) {
    return;
  }

  try {
    const response = await fetch(`${MAX_API_BASE}/messages?user_id=${userId}`, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error(`[MaxBot] Send message to ${userId} failed: ${response.status} ${body}`);
    }
  } catch (err) {
    console.error(`[MaxBot] Send message to ${userId} error:`, err);
  }
}

type MaxUserRow = {
  max_chat_id: string;
};

export async function notifyRoleUsers(roleValue: string, text: string): Promise<void> {
  const token = getBotToken();
  if (!token) {
    return;
  }

  try {
    const result = await withDbClient((client) =>
      client.query<MaxUserRow>(
        `SELECT max_chat_id
         FROM users
         WHERE role = $1
           AND max_chat_id IS NOT NULL
           AND max_notifications_enabled = TRUE`,
        [roleValue],
      ),
    );

    for (const row of result.rows) {
      await sendMaxMessage(row.max_chat_id, text);
    }
  } catch (err) {
    console.error(`[MaxBot] notifyRoleUsers(${roleValue}) error:`, err);
  }
}
