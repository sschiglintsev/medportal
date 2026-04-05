function parseDate(value: string): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

export function formatDate(value: string): string {
  const date = parseDate(value);
  if (!date) {
    return value || '-';
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(value: string): string {
  const date = parseDate(value);
  if (!date) {
    return value || '-';
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatTime(value: string): string {
  if (!value) {
    return '-';
  }

  const match = value.match(/^(\d{2}:\d{2})/);
  if (match?.[1]) {
    return match[1];
  }

  const date = parseDate(value);
  if (!date) {
    return value;
  }

  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
