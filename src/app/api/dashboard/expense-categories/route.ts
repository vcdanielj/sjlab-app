// ============================================
// SJ Lab — Dashboard Expense Categories API
// ============================================

import { sql, and, gte, lte, eq } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';

const LEGACY_LABELS: Record<string, { name: string; color: string }> = {
  material: { name: 'Materiales', color: '#3B82F6' },
  equipo: { name: 'Equipos', color: '#10B981' },
  servicios: { name: 'Servicios', color: '#F59E0B' },
  nomina: { name: 'Nómina', color: '#8B5CF6' },
  otro: { name: 'Otros', color: '#6B7280' },
};

const LAB_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#06B6D4', '#6B7280'];
const PERSONAL_COLORS = ['#EC4899', '#F97316', '#EF4444', '#A855F7', '#14B8A6', '#6B7280'];

interface CategoryBucket {
  name: string;
  color: string;
  value: number;
  percentage: number;
}

function buildCategories(
  rows: Array<{ catId: string | null; legacyCat: string | null; catName: string | null; catColor: string | null; total: number }>,
  palette: string[],
  maxSlices: number = 5
): { items: CategoryBucket[]; totalSum: number } {
  const categoryMap = new Map<string, { name: string; color: string; value: number }>();
  let totalSum = 0;

  for (const r of rows) {
    if (r.total <= 0) continue;
    totalSum += r.total;
    const key = r.catId || r.legacyCat || 'otro';
    const name = r.catName || LEGACY_LABELS[r.legacyCat as string]?.name || r.legacyCat || 'Otros';
    const color = r.catColor || LEGACY_LABELS[r.legacyCat as string]?.color || '#6B7280';

    const existing = categoryMap.get(key);
    if (existing) {
      existing.value += r.total;
    } else {
      categoryMap.set(key, { name, color, value: r.total });
    }
  }

  const sorted = Array.from(categoryMap.values()).sort((a, b) => b.value - a.value);

  // Group small categories into "Otros" if more than maxSlices
  let items: CategoryBucket[];
  if (sorted.length <= maxSlices) {
    items = sorted.map((item, idx) => ({
      name: item.name,
      color: palette[idx % palette.length],
      value: Number(item.value.toFixed(2)),
      percentage: totalSum > 0 ? Number(((item.value / totalSum) * 100).toFixed(1)) : 0,
    }));
  } else {
    const top = sorted.slice(0, maxSlices);
    const rest = sorted.slice(maxSlices);
    const restValue = rest.reduce((sum, r) => sum + r.value, 0);

    items = top.map((item, idx) => ({
      name: item.name,
      color: palette[idx % palette.length],
      value: Number(item.value.toFixed(2)),
      percentage: totalSum > 0 ? Number(((item.value / totalSum) * 100).toFixed(1)) : 0,
    }));

    if (restValue > 0) {
      items.push({
        name: `Otros (${rest.length})`,
        color: palette[palette.length - 1],
        value: Number(restValue.toFixed(2)),
        percentage: totalSum > 0 ? Number(((restValue / totalSum) * 100).toFixed(1)) : 0,
      });
    }
  }

  return { items, totalSum: Number(totalSum.toFixed(2)) };
}

// GET /api/dashboard/expense-categories?from=X&to=Y&expenseScope=all|lab|personal
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const url = new URL(request.url);
    const from = Number(url.searchParams.get('from') || 0);
    const to = Number(url.searchParams.get('to') || Math.floor(Date.now() / 1000));

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const baseConditions = [
      gte(schema.expenses.expenseDate, from),
      lte(schema.expenses.expenseDate, to),
    ];

    // Fetch lab expenses
    const labRows = await db
      .select({
        catId: schema.expenses.categoryId,
        legacyCat: schema.expenses.category,
        catName: schema.expenseCategories.name,
        catColor: schema.expenseCategories.color,
        total: sql<number>`COALESCE(SUM(${schema.expenses.amountUsd}), 0)`,
      })
      .from(schema.expenses)
      .leftJoin(schema.expenseCategories, eq(schema.expenses.categoryId, schema.expenseCategories.id))
      .where(and(...baseConditions, eq(schema.expenses.isPersonal, false)))
      .groupBy(
        schema.expenses.categoryId,
        schema.expenses.category,
        schema.expenseCategories.name,
        schema.expenseCategories.color
      );

    // Fetch personal expenses
    const personalRows = await db
      .select({
        catId: schema.expenses.categoryId,
        legacyCat: schema.expenses.category,
        catName: schema.expenseCategories.name,
        catColor: schema.expenseCategories.color,
        total: sql<number>`COALESCE(SUM(${schema.expenses.amountUsd}), 0)`,
      })
      .from(schema.expenses)
      .leftJoin(schema.expenseCategories, eq(schema.expenses.categoryId, schema.expenseCategories.id))
      .where(and(...baseConditions, eq(schema.expenses.isPersonal, true)))
      .groupBy(
        schema.expenses.categoryId,
        schema.expenses.category,
        schema.expenseCategories.name,
        schema.expenseCategories.color
      );

    const lab = buildCategories(labRows, LAB_COLORS);
    const personal = buildCategories(personalRows, PERSONAL_COLORS);

    return Response.json({
      lab: { data: lab.items, totalSum: lab.totalSum },
      personal: { data: personal.items, totalSum: personal.totalSum },
      // Keep backward compat: merge both for legacy "data" key
      data: [...lab.items, ...personal.items],
      totalSum: lab.totalSum + personal.totalSum,
    });
  } catch (err) {
    console.error('Error in GET /api/dashboard/expense-categories:', err);
    return Response.json({ error: 'Error interno' }, { status: 500 });
  }
}
