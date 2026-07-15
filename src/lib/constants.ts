// ============================================
// SJ Lab — Constants
// ============================================

export { ORDER_STATUS, PAYMENT_STATUS, CURRENCY, PAYMENT_METHOD, USER_ROLE } from '@/types';

// Payment methods available per currency
export const PAYMENT_METHODS_BY_CURRENCY = {
  USD: ['Efectivo', 'Zelle', 'Binance', 'Transferencia'],
  VES: ['Transferencia', 'Pago Móvil'],
} as const;

// Dashboard period presets
export const PERIOD_PRESETS = {
  TODAY: 'today',
  THIS_WEEK: 'this_week',
  THIS_MONTH: 'this_month',
  LAST_QUARTER: 'last_quarter',
  THIS_YEAR: 'this_year',
  CUSTOM: 'custom',
} as const;
export type PeriodPreset = typeof PERIOD_PRESETS[keyof typeof PERIOD_PRESETS];

// Order status labels in Spanish
export const ORDER_STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  completed: 'Completado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

// Order status colors (CSS variable names)
export const ORDER_STATUS_COLORS: Record<string, string> = {
  active: 'var(--color-warning)',
  completed: 'var(--color-success)',
  delivered: 'var(--color-primary)',
  cancelled: 'var(--color-danger)',
};

// Payment status labels in Spanish
export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  voided: 'Anulado',
};

// Max rows per PDF page
export const PDF_MAX_ROWS = 50;

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
