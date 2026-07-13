// ============================================
// SJ Lab — Utility Helpers
// ============================================

/**
 * Generate a UUID v4.
 * Uses crypto.randomUUID() which is available in Edge Runtime.
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Get current Unix timestamp in seconds.
 */
export function now(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Format a number as USD currency string.
 * @example formatCurrency(1234.5) → "$1,234.50"
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a number as VES currency string.
 * @example formatBs(150000.5) → "Bs. 150.000,50"
 */
export function formatBs(amount: number): string {
  return `Bs. ${new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)}`;
}

/**
 * Format a Unix timestamp (seconds) to a localized date string.
 * @example formatDate(1716912000) → "28/05/2026"
 */
export function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Caracas',
  }).format(new Date(timestamp * 1000));
}

/**
 * Format a Unix timestamp (seconds) to a localized datetime string.
 * @example formatDateTime(1716912000) → "28/05/2026, 12:00"
 */
export function formatDateTime(timestamp: number): string {
  return new Intl.DateTimeFormat('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Caracas',
  }).format(new Date(timestamp * 1000));
}

/**
 * Format a Unix timestamp to relative time (e.g., "hace 2 horas").
 */
export function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000) - timestamp;

  if (seconds < 60) return 'hace un momento';
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `hace ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return `hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  }
  const days = Math.floor(seconds / 86400);
  if (days === 1) return 'ayer';
  if (days < 30) return `hace ${days} días`;
  return formatDate(timestamp);
}

/**
 * Calculate the start and end timestamps for a period preset.
 */
const CARACAS_OFFSET = '-04:00';

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function getCaracasTodayParts() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);

  return { year, month, day };
}

function buildCaracasDate(year: number, month: number, day: number, time: 'start' | 'midday' | 'end'): Date {
  const clock = time === 'start' ? '00:00:00' : time === 'midday' ? '12:00:00' : '23:59:59';
  return new Date(`${year}-${pad2(month)}-${pad2(day)}T${clock}${CARACAS_OFFSET}`);
}

function toTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function getPeriodRange(preset: string): { from: number; to: number } {
  const today = getCaracasTodayParts();
  const currentCaracasDate = buildCaracasDate(today.year, today.month, today.day, 'midday');

  switch (preset) {
    case 'today': {
      return {
        from: toTimestamp(buildCaracasDate(today.year, today.month, today.day, 'start')),
        to: toTimestamp(buildCaracasDate(today.year, today.month, today.day, 'end')),
      };
    }
    case 'this_week': {
      const start = new Date(currentCaracasDate);
      start.setUTCDate(start.getUTCDate() - start.getUTCDay());
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 6);
      return {
        from: toTimestamp(buildCaracasDate(start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate(), 'start')),
        to: toTimestamp(buildCaracasDate(end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate(), 'end')),
      };
    }
    case 'this_month': {
      return {
        from: toTimestamp(buildCaracasDate(today.year, today.month, 1, 'start')),
        to: toTimestamp(buildCaracasDate(today.year, today.month, getDaysInMonth(today.year, today.month), 'end')),
      };
    }
    case 'last_quarter': {
      const start = new Date(currentCaracasDate);
      start.setUTCDate(1);
      start.setUTCMonth(start.getUTCMonth() - 3);
      return {
        from: toTimestamp(buildCaracasDate(start.getUTCFullYear(), start.getUTCMonth() + 1, 1, 'start')),
        to: toTimestamp(buildCaracasDate(today.year, today.month, getDaysInMonth(today.year, today.month), 'end')),
      };
    }
    case 'this_year': {
      return {
        from: toTimestamp(buildCaracasDate(today.year, 1, 1, 'start')),
        to: toTimestamp(buildCaracasDate(today.year, 12, 31, 'end')),
      };
    }
    default:
      // Default to this month
      return getPeriodRange('this_month');
  }
}

/**
 * Clamp a number between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Calculate percentage change between two values.
 * Returns 0 if previous is 0 to avoid division by zero.
 */
export function percentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Truncate text with ellipsis.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}
