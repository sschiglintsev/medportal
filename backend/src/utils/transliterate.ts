/**
 * Таблица транслитерации кириллица → латиница (ГОСТ Р 52535.1-2006 / упрощённая)
 * Включает обработку Ё, Й, Щ, Ю, Я, дефиса, отсутствия отчества.
 */
const TRANSLIT_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo',
  ж: 'zh', з: 'z', и: 'i', й: 'j', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  '-': '_',
};

function translitChar(char: string): string {
  const lower = char.toLowerCase();
  if (TRANSLIT_MAP[lower] !== undefined) {
    return TRANSLIT_MAP[lower];
  }
  // Латинские буквы и цифры оставляем как есть
  if (/[a-z0-9]/.test(lower)) return lower;
  // Неподдерживаемые символы — заменяем на 'x' (документированный нейтральный fallback)
  return 'x';
}

function transliterate(text: string): string {
  return text
    .split('')
    .map(translitChar)
    .join('');
}

/**
 * Генерирует базовый логин формата portal_<инициалы>.
 * Формат: portal_ + первая буква Фамилии + первая буква Имени + первая буква Отчества (если есть)
 *
 * @param fullName ФИО через пробел (от 2 до 4 слов)
 * @returns строка вида "portal_iip"
 */
export function buildBaseLogin(fullName: string): string {
  const parts = fullName
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean);

  if (parts.length === 0) {
    return 'portal_user';
  }

  // Берём первые буквы каждой части (Фамилия, Имя, Отчество если есть)
  const initials = parts
    .slice(0, 3)
    .map((p) => transliterate(p.charAt(0)))
    .filter((c) => c.length > 0)
    .join('');

  const base = initials || 'user';
  return `portal_${base}`.toLowerCase().replace(/[^a-z0-9_]/g, '');
}

/**
 * Находит уникальный логин, добавляя суффикс при коллизии.
 * Проверяет существующие логины переданным набором.
 *
 * @param fullName ФИО
 * @param existingUsernames Множество уже занятых логинов (нечувствительно к регистру — должны быть lowercase)
 * @returns уникальный логин
 */
export function resolveUniqueLogin(fullName: string, existingUsernames: Set<string>): string {
  const base = buildBaseLogin(fullName);

  if (!existingUsernames.has(base)) {
    return base;
  }

  for (let i = 2; i <= 9999; i++) {
    const candidate = `${base}_${String(i).padStart(2, '0')}`;
    if (!existingUsernames.has(candidate)) {
      return candidate;
    }
  }

  // Крайний случай — добавляем timestamp
  return `${base}_${Date.now()}`;
}
