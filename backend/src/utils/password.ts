import crypto from 'crypto';

/**
 * Алфавиты для временных паролей.
 * Исключены визуально неоднозначные буквы: O, I, l.
 * Формат: 1 заглавная + 1 строчная + 6 цифр (всего 8 символов).
 */
const UPPER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER_ALPHABET = 'abcdefghjkmnpqrstuvwxyz';
const DIGIT_ALPHABET = '0123456789';

/**
 * Выбирает один символ из alphabet равномерно (crypto + rejection sampling).
 */
function pickChar(alphabet: string): string {
  const len = alphabet.length;
  const maxUsable = 256 - (256 % len);
  for (;;) {
    const byte = crypto.randomBytes(1)[0];
    if (byte < maxUsable) {
      return alphabet[byte % len];
    }
  }
}

/**
 * Генерирует криптографически стойкий временный пароль.
 * Формат: Aa123456 — заглавная, строчная, затем 6 цифр.
 */
export function generateTemporaryPassword(): string {
  let digits = '';
  for (let i = 0; i < 6; i++) {
    digits += pickChar(DIGIT_ALPHABET);
  }
  return pickChar(UPPER_ALPHABET) + pickChar(LOWER_ALPHABET) + digits;
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
