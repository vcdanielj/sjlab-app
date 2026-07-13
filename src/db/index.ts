// ============================================
// SJ Lab — Database Connection Helper
// ============================================

import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './schema';

export function getDb(d1: Parameters<typeof drizzle>[0]) {
  return drizzle(d1, { schema });
}

export type Database = ReturnType<typeof getDb>;
