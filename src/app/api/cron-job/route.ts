// ============================================
// SJ Lab — Automated Collections Cron API
// ============================================
// Triggered by Cloudflare Scheduled Worker event.
// Identifies clients with net debt and sends statement reminders.

import { eq, and, sql } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { sendStatementReminderEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const { env, ctx } = await getCloudflareContext({ async: true });
    
    // Auth validation
    const authHeader = request.headers.get('x-cron-secret');
    const systemSecret = env.CRON_SECRET || "default_cron_secret";

    if (!authHeader || authHeader !== systemSecret) {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const db = getDb(env.DB);

    // Read the frequency setting from the system_settings table
    const frequencySetting = await db.query.systemSettings.findFirst({
      where: eq(schema.systemSettings.key, 'billing_frequency'),
    });
    const frequency = frequencySetting?.value || 'weekly';

    // Get Caracas date components
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Caracas',
      weekday: 'short', // "Mon", "Tue", etc.
      day: 'numeric', // "1" to "31"
    });
    const parts = formatter.formatToParts(new Date());
    const caracasWeekday = parts.find(p => p.type === 'weekday')?.value || 'Mon';
    const caracasDay = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10);

    let shouldRun = false;
    if (frequency === 'daily') {
      shouldRun = true;
    } else if (frequency === 'weekly') {
      shouldRun = caracasWeekday === 'Fri';
    } else if (frequency === 'fortnightly') {
      const isFeb = new Date().getMonth() === 1;
      const isLastOfFeb = isFeb && (caracasDay === 28 || caracasDay === 29);
      shouldRun = caracasDay === 15 || caracasDay === 30 || isLastOfFeb;
    }

    if (!shouldRun) {
      console.log(`[CRON] Omitiendo ejecución hoy. Frecuencia configurada: ${frequency}. Día actual en Caracas: ${caracasWeekday} ${caracasDay}`);
      return Response.json({
        success: true,
        message: `Cron omitido. Frecuencia: ${frequency}. Día en Caracas: ${caracasWeekday} ${caracasDay}`,
        executed: false
      });
    }

    // 1. Sub-aggregations for order stats (excluding cancelled orders)
    const orderStats = db
      .select({
        clientId: schema.orders.clientId,
        totalInvoiced: sql<number>`COALESCE(sum(CASE WHEN ${schema.orders.status} != 'cancelled' THEN ${schema.orders.finalPriceUsd} ELSE 0 END), 0)`.as('total_invoiced'),
      })
      .from(schema.orders)
      .groupBy(schema.orders.clientId)
      .as('orderStats');

    // 2. Sub-aggregation for payment stats (active payments only)
    const paymentStats = db
      .select({
        clientId: schema.payments.clientId,
        totalPaid: sql<number>`COALESCE(sum(CASE WHEN ${schema.payments.status} = 'active' THEN ${schema.payments.amountUsd} ELSE 0 END), 0)`.as('total_paid'),
      })
      .from(schema.payments)
      .groupBy(schema.payments.clientId)
      .as('paymentStats');

    // 3. Select all active clients who have automatic billing enabled, and join with their stats
    const activeClients = await db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        totalInvoiced: sql<number>`COALESCE(${orderStats.totalInvoiced}, 0)`,
        totalPaid: sql<number>`COALESCE(${paymentStats.totalPaid}, 0)`,
      })
      .from(schema.users)
      .leftJoin(orderStats, eq(schema.users.id, orderStats.clientId))
      .leftJoin(paymentStats, eq(schema.users.id, paymentStats.clientId))
      .where(and(
        eq(schema.users.role, 'client'),
        eq(schema.users.isActive, true),
        eq(schema.users.autoBillingEnabled, true)
      ));

    // Filter clients with a net negative balance (debt > 0 USD)
    const debtors = activeClients
      .map(c => {
        const invoiced = Number(c.totalInvoiced);
        const paid = Number(c.totalPaid);
        const balance = Number((paid - invoiced).toFixed(2));
        return {
          id: c.id,
          name: c.name,
          email: c.email,
          balance,
        };
      })
      .filter(c => c.balance < -0.005); // Balance < -0.005 means client owes money

    console.log(`[CRON] Se identificaron ${debtors.length} clientes con deudas pendientes.`);

    if (debtors.length > 0) {
      // Process email sending sequentially in background to avoid Resend rate-limiting
      ctx.waitUntil((async () => {
        for (const debtor of debtors) {
          try {
            console.log(`[CRON] Procesando recordatorio para ${debtor.name} (${debtor.email}) - Deuda: ${Math.abs(debtor.balance)} USD`);
            await sendStatementReminderEmail({
              clientId: debtor.id,
              db,
            });
            // Wait 250ms between sends to stay safe under Resend's free tier rate limit
            await new Promise(resolve => setTimeout(resolve, 250));
          } catch (emailError) {
            console.error(`[CRON] Error al enviar recordatorio a ${debtor.email}:`, emailError);
          }
        }
        console.log(`[CRON] Proceso de recordatorios automáticos de cobro finalizado.`);
      })());
    }

    return Response.json({
      success: true,
      message: `Procesamiento de recordatorios de cobro iniciado en segundo plano para ${debtors.length} clientes.`,
      debtorsCount: debtors.length
    });
  } catch (error) {
    console.error('[CRON] Error crítico en el endpoint de cron job:', error);
    return Response.json({ error: 'Error interno en cron job de cobranza' }, { status: 500 });
  }
}
