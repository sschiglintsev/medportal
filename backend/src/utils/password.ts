import crypto from 'crypto';

/**
 * Алфавит для временных паролей:
 * - Латинские буквы (верхний и нижний регистр) и цифры
 * - Исключены визуально неоднозначные символы: 0, O, o, 1, I, i, l
 */
const TEMP_PASSWORD_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

const TEMP_PASSWORD_LENGTH = 16;

/**
 * Генерирует криптографически стойкий временный пароль.
 * Не использует Math.random().
 */
export function generateTemporaryPassword(): string {
  const len = TEMP_PASSWORD_ALPHABET.length;
  const randomBytes = crypto.randomBytes(TEMP_PASSWORD_LENGTH * 2); // запас для uniform sampling
  let result = '';

  let byteIndex = 0;
  while (result.length < TEMP_PASSWORD_LENGTH) {
    if (byteIndex >= randomBytes.length) {
      // Запрашиваем ещё байт (редкий случай)
      byteIndex = 0;
      randomBytes.set(crypto.randomBytes(TEMP_PASSWORD_LENGTH * 2));
    }
    const byte = randomBytes[byteIndex++];
    // Отбрасываем байты, создающие bias (uniform rejection)
    const maxUsable = 256 - (256 % len);
    if (byte < maxUsable) {
      result += TEMP_PASSWORD_ALPHABET[byte % len];
    }
  }
  return result;
}

/**
 * Генерирует N уникальных временных паролей (проверяет отсутствие повторов).
 */
export function generateUniqueTemporaryPasswords(count: number): string[] {
  const passwords: string[] = [];
  const seen = new Set<string>();

  while (passwords.length < count) {
    const p = generateTemporaryPassword();
    if (!seen.has(p)) {
      seen.add(p);
      passwords.push(p);
    }
  }
  return passwords;
}

/**
 * Возвращает дату истечения временного пароля.
 * TTL берётся из переменной окружения EMPLOYEE_TEMP_PASSWORD_TTL_HOURS (по умолчанию 168 ч = 7 дней).
 */
export function getTempPasswordExpiry(): Date {
  const ttlHours = Number(process.env.EMPLOYEE_TEMP_PASSWORD_TTL_HOURS ?? 168);
  const expiry = new Date();
  expiry.setTime(expiry.getTime() + ttlHours * 60 * 60 * 1000);
  return expiry;
}
