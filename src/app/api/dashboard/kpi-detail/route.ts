// ============================================
// SJ Lab — Dashboard KPI Detail API
// ============================================

import { sql, and, gte, lte, eq, ne, gt, desc } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { getSession } from '@/lib/session';

// GET /api/dashboard/kpi-detail?kpi=totalInvoiced&from=X&to=Y&expenseScope=all
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const url = new URL(request.url);
    const kpi = url.searchParams.get('kpi') || '';
    const from = Number(url.searchParams.get('from') || 0);
    const to = Number(url.searchParams.get('to') || Math.floor(Date.now() / 1000));
    const expenseScope = url.searchParams.get('expenseScope') || 'all';

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    switch (kpi) {
      case 'totalInvoiced':
      case 'newOrders':
      case 'averageOrderValue': {
        const rows = await db
          .select({
            id: schema.orders.id,
            orderNumber: schema.orders.orderNumber,
            patientName: schema.orders.patientName,
            clientName: schema.users.name,
            finalPriceUsd: schema.orders.finalPriceUsd,
            status: schema.orders.status,
            createdAt: schema.orders.createdAt,
          })
          .from(schema.orders)
          .innerJoin(schema.users, eq(schema.orders.clientId, schema.users.id))
          .where(and(
            gte(schema.orders.createdAt, from),
            lte(schema.orders.createdAt, to),
            ne(schema.orders.status, 'cancelled')
          ))
          .orderBy(desc(schema.orders.createdAt))
          .limit(20);

        return Response.json({ data: { rows, type: 'orders' } });
      }

      case 'totalCollected':
      case 'collectionRate': {
        const rows = await db
          .select({
            id: schema.payments.id,
            clientName: schema.users.name,
            amountUsd: schema.payments.amountRealUsd,
            paymentMethod: schema.payments.paymentMethod,
            reference: schema.payments.reference,
            paymentDate: schema.payments.paymentDate,
          })
          .from(schema.payments)
          .innerJoin(schema.users, eq(schema.payments.clientId, schema.users.id))
          .where(and(
            gte(schema.payments.paymentDate, from),
            lte(schema.payments.paymentDate, to),
            eq(schema.payments.status, 'active')
          ))
          .orderBy(desc(schema.payments.paymentDate))
          .limit(20);

        return Response.json({ data: { rows, type: 'payments' } });
      }

      case 'completedOrders': {
        const rows = await db
          .select({
            id: schema.orders.id,
            orderNumber: schema.orders.orderNumber,
            patientName: schema.orders.patientName,
            clientName: schema.users.name,
            finalPriceUsd: schema.orders.finalPriceUsd,
            completedAt: schema.orders.completedAt,
          })
          .from(schema.orders)
          .innerJoin(schema.users, eq(schema.orders.clientId, schema.users.id))
          .where(and(
            gte(schema.orders.completedAt, from),
            lte(schema.orders.completedAt, to)
          ))
          .orderBy(desc(schema.orders.completedAt))
          .limit(20);

        return Response.json({ data: { rows, type: 'completedOrders' } });
      }

      case 'totalExpenses':
      case 'personalExpenses':
      case 'labExpenses':
      case 'avgDailyExpense': {
        const conditions = [
          gte(schema.expenses.expenseDate, from),
          lte(schema.expenses.expenseDate, to),
        ];
        if (kpi === 'personalExpenses' || (kpi === 'totalExpenses' && expenseScope === 'personal')) {
          conditions.push(eq(schema.expenses.isPersonal, true));
        } else if (kpi === 'labExpenses' || (kpi === 'totalExpenses' && expenseScope === 'lab')) {
          conditions.push(eq(schema.expenses.isPersonal, false));
        }

        const rows = await db
          .select({
            id: schema.expenses.id,
            description: schema.expenses.description,
            amountUsd: schema.expenses.amountUsd,
            categoryName: schema.expenseCategories.name,
            isPersonal: schema.expenses.isPersonal,
            expenseDate: schema.expenses.expenseDate,
            paymentMethod: schema.expenses.paymentMethod,
          })
          .from(schema.expenses)
          .leftJoin(schema.expenseCategories, eq(schema.expenses.categoryId, schema.expenseCategories.id))
          .where(and(...conditions))
          .orderBy(desc(schema.expenses.expenseDate))
          .limit(20);

        return Response.json({ data: { rows, type: 'expenses' } });
      }

      case 'netMargin': {
        const [invoiced] = await db
          .select({ total: sql<number>`COALESCE(SUM(${schema.orders.finalPriceUsd}), 0)` })
          .from(schema.orders)
          .where(and(gte(schema.orders.createdAt, from), lte(schema.orders.createdAt, to), ne(schema.orders.status, 'cancelled')));

        const [collected] = await db
          .select({ total: sql<number>`COALESCE(SUM(${schema.payments.amountRealUsd}), 0)` })
          .from(schema.payments)
          .where(and(gte(schema.payments.paymentDate, from), lte(schema.payments.paymentDate, to), eq(schema.payments.status, 'active')));

        const [expenses] = await db
          .select({
            total: sql<number>`COALESCE(SUM(${schema.expenses.amountRealUsd}), 0)`,
            personal: sql<number>`COALESCE(SUM(CASE WHEN ${schema.expenses.isPersonal} = 1 THEN ${schema.expenses.amountRealUsd} ELSE 0 END), 0)`,
            lab: sql<number>`COALESCE(SUM(CASE WHEN ${schema.expenses.isPersonal} = 0 THEN ${schema.expenses.amountRealUsd} ELSE 0 END), 0)`,
          })
          .from(schema.expenses)
          .where(and(gte(schema.expenses.expenseDate, from), lte(schema.expenses.expenseDate, to)));

        return Response.json({
          data: {
            rows: {
              invoiced: invoiced.total,
              collected: collected.total,
              totalExpenses: expenses.total,
              personalExpenses: expenses.personal,
              labExpenses: expenses.lab,
              margin: collected.total - expenses.total,
            },
            type: 'margin',
          },
        });
      }

      case 'activeClients': {
        const rows = await db
          .select({
            id: schema.users.id,
            name: schema.users.name,
            clinicName: schema.users.clinicName,
            phone: schema.users.phone,
          })
          .from(schema.users)
          .where(and(eq(schema.users.role, 'client'), eq(schema.users.isActive, true)))
          .limit(20);

        return Response.json({ data: { rows, type: 'clients' } });
      }

      case 'activeOrders': {
        const rows = await db
          .select({
            id: schema.orders.id,
            orderNumber: schema.orders.orderNumber,
            patientName: schema.orders.patientName,
            clientName: schema.users.name,
            finalPriceUsd: schema.orders.finalPriceUsd,
            currentStepName: schema.workflowSteps.name,
            createdAt: schema.orders.createdAt,
          })
          .from(schema.orders)
          .innerJoin(schema.users, eq(schema.orders.clientId, schema.users.id))
          .innerJoin(schema.workflowSteps, eq(schema.orders.currentStepId, schema.workflowSteps.id))
          .where(eq(schema.orders.status, 'active'))
          .orderBy(desc(schema.orders.createdAt))
          .limit(20);

        return Response.json({ data: { rows, type: 'activeOrders' } });
      }

      case 'monthlyRecurringExpense': {
        const rawRows = await db
          .select({
            id: schema.expenses.id,
            description: schema.expenses.description,
            amountUsd: schema.expenses.amountUsd,
            amountRealUsd: schema.expenses.amountRealUsd,
            categoryName: schema.expenseCategories.name,
            isPersonal: schema.expenses.isPersonal,
            recurrenceInterval: schema.expenses.recurrenceInterval,
            expenseDate: schema.expenses.expenseDate,
          })
          .from(schema.expenses)
          .leftJoin(schema.expenseCategories, eq(schema.expenses.categoryId, schema.expenseCategories.id))
          .where(eq(schema.expenses.isRecurring, true))
          .orderBy(desc(schema.expenses.expenseDate))
          .limit(20);

        const rows = rawRows.map((r) => {
          const amt = r.amountRealUsd || r.amountUsd || 0;
          const interval = (r.recurrenceInterval || 'monthly').toLowerCase();
          let monthlyProrated = amt;
          if (interval === 'weekly') monthlyProrated = amt * (52 / 12);
          else if (interval === 'biweekly') monthlyProrated = amt * 2;
          else if (interval === 'monthly') monthlyProrated = amt;
          else if (interval === 'quarterly') monthlyProrated = amt / 3;
          else if (interval === 'yearly') monthlyProrated = amt / 12;

          return {
            ...r,
            amountUsd: amt,
            monthlyProrated,
          };
        });

        return Response.json({ data: { rows, type: 'recurringExpenses' } });
      }

      case 'pendingCollection': {
        const rows = await db
          .select({
            id: schema.orders.id,
            orderNumber: schema.orders.orderNumber,
            patientName: schema.orders.patientName,
            clientName: schema.users.name,
            finalPriceUsd: schema.orders.finalPriceUsd,
            amountPaidUsd: schema.orders.amountPaidUsd,
            pendingBalance: sql<number>`(${schema.orders.finalPriceUsd} - ${schema.orders.amountPaidUsd})`,
            createdAt: schema.orders.createdAt,
          })
          .from(schema.orders)
          .innerJoin(schema.users, eq(schema.orders.clientId, schema.users.id))
          .where(and(
            gte(schema.orders.createdAt, from),
            lte(schema.orders.createdAt, to),
            ne(schema.orders.status, 'cancelled'),
            gt(sql`(${schema.orders.finalPriceUsd} - ${schema.orders.amountPaidUsd})`, 0)
          ))
          .orderBy(desc(sql`(${schema.orders.finalPriceUsd} - ${schema.orders.amountPaidUsd})`))
          .limit(20);

        return Response.json({ data: { rows, type: 'pendingCollection' } });
      }

      case 'expenseRatio': {
        const [invoiced] = await db
          .select({ total: sql<number>`COALESCE(SUM(${schema.orders.finalPriceUsd}), 0)` })
          .from(schema.orders)
          .where(and(gte(schema.orders.createdAt, from), lte(schema.orders.createdAt, to), ne(schema.orders.status, 'cancelled')));

        const [collected] = await db
          .select({ total: sql<number>`COALESCE(SUM(${schema.payments.amountRealUsd}), 0)` })
          .from(schema.payments)
          .where(and(gte(schema.payments.paymentDate, from), lte(schema.payments.paymentDate, to), eq(schema.payments.status, 'active')));

        const [expenses] = await db
          .select({
            total: sql<number>`COALESCE(SUM(${schema.expenses.amountRealUsd}), 0)`,
            personal: sql<number>`COALESCE(SUM(CASE WHEN ${schema.expenses.isPersonal} = 1 THEN ${schema.expenses.amountRealUsd} ELSE 0 END), 0)`,
            lab: sql<number>`COALESCE(SUM(CASE WHEN ${schema.expenses.isPersonal} = 0 THEN ${schema.expenses.amountRealUsd} ELSE 0 END), 0)`,
          })
          .from(schema.expenses)
          .where(and(gte(schema.expenses.expenseDate, from), lte(schema.expenses.expenseDate, to)));

        const expenseRatio = invoiced.total > 0
          ? Math.round((expenses.total / invoiced.total) * 100)
          : 0;

        return Response.json({
          data: {
            rows: {
              invoiced: invoiced.total,
              collected: collected.total,
              totalExpenses: expenses.total,
              personalExpenses: expenses.personal,
              labExpenses: expenses.lab,
              margin: collected.total - expenses.total,
              expenseRatio,
            },
            type: 'expenseRatio',
          },
        });
      }

      default:
        return Response.json({ error: 'KPI no válido' }, { status: 400 });
    }
  } catch (err) {
    console.error('Error in GET /api/dashboard/kpi-detail:', err);
    return Response.json({ error: 'Error interno' }, { status: 500 });
  }
}
