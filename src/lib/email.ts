// ============================================
// SJ Lab — Email Core Helpers (Edge-Compatible)
// ============================================
// Centralized notification module utilizing Resend REST API
// compatible with Cloudflare Workers (Edge runtime) and Next.js.

import { eq, and, sql } from 'drizzle-orm';
import { DrizzleD1Database } from 'drizzle-orm/d1';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import * as schema from '@/db/schema';

// ---------- Format Helpers ----------

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

// ---------- Base Email Layout Wrapper (Less is More / Modern Grayscale) ----------

function getEmailLayout(title: string, contentHtml: string): string {
  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        background-color: #f9fafb;
        color: #111827;
        margin: 0;
        padding: 0;
        -webkit-font-smoothing: antialiased;
      }
      .wrapper {
        width: 100%;
        background-color: #f9fafb;
        padding: 40px 0;
      }
      .container {
        max-width: 580px;
        margin: 0 auto;
        background-color: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      }
      .header {
        background-color: #111827;
        padding: 28px 32px;
        text-align: center;
      }
      .header h1 {
        color: #ffffff;
        font-size: 18px;
        font-weight: 700;
        margin: 0;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      .content {
        padding: 32px;
      }
      .footer {
        padding: 24px 32px;
        background-color: #f9fafb;
        border-top: 1px solid #e5e7eb;
        text-align: center;
        font-size: 12px;
        color: #6b7280;
        line-height: 1.6;
      }
      h2 {
        font-size: 18px;
        font-weight: 600;
        margin-top: 0;
        margin-bottom: 16px;
        color: #111827;
        letter-spacing: -0.01em;
      }
      p {
        font-size: 14px;
        line-height: 1.6;
        margin-top: 0;
        margin-bottom: 16px;
        color: #374151;
      }
      .btn-container {
        text-align: center;
        margin: 28px 0;
      }
      .btn {
        display: inline-block;
        background-color: #111827;
        color: #ffffff !important;
        text-decoration: none;
        padding: 12px 28px;
        font-size: 14px;
        font-weight: 600;
        border-radius: 6px;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .financial-card {
        background-color: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 20px;
        margin: 24px 0;
      }
      .financial-title {
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #6b7280;
        margin-top: 0;
        margin-bottom: 14px;
        border-bottom: 1px solid #e5e7eb;
        padding-bottom: 8px;
      }
      .access-card {
        background-color: #f9fafb;
        border: 1px solid #e5e7eb;
        border-left: 4px solid #111827;
        padding: 16px;
        border-radius: 0 6px 6px 0;
        margin: 24px 0;
      }
      .access-title {
        font-weight: 600;
        color: #111827;
        font-size: 13px;
        margin-bottom: 6px;
      }
      .table-wrapper {
        width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        margin: 20px 0;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
      }
      .order-table {
        width: 100%;
        min-width: 450px;
        border-collapse: collapse;
      }
      .order-table th, .order-table td {
        padding: 10px 12px;
        font-size: 13px;
        text-align: left;
        border-bottom: 1px solid #e5e7eb;
      }
      .order-table th {
        background-color: #f9fafb;
        font-weight: 600;
        color: #4b5563;
        text-transform: uppercase;
        font-size: 11px;
        letter-spacing: 0.05em;
      }
      .order-table tr:last-child td {
        border-bottom: none;
      }
      .financial-table {
        width: 100%;
        border-collapse: collapse;
      }
      .financial-table td {
        padding: 6px 0;
        font-size: 13px;
        color: #4b5563;
      }
      .financial-table td.label {
        text-align: left;
      }
      .financial-table td.value {
        text-align: right;
        font-weight: 600;
        color: #111827;
      }
      .financial-table tr.highlight td {
        border-top: 1px dashed #e5e7eb;
        padding-top: 10px;
        margin-top: 8px;
      }
      .financial-table tr.highlight td.label {
        font-weight: 700;
        color: #111827;
      }
      .financial-table tr.highlight td.value {
        font-size: 15px;
        color: #dc2626; /* rojo semántico para deuda */
      }
      .financial-table tr.highlight-green td.value {
        font-size: 15px;
        color: #10b981; /* verde semántico para saldo a favor */
      }
      .financial-table tr.highlight-neutral td.value {
        font-size: 15px;
        color: #111827;
      }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="container">
        <div class="header">
          <h1>SJ LAB DENTAL</h1>
        </div>
        <div class="content">
          ${contentHtml}
        </div>
        <div class="footer">
          Este es un correo transaccional automático enviado por SJ Lab Dental.<br>
          Para cualquier consulta, por favor contáctenos a <a href="mailto:soporte@sjlabdental.com" style="color: #4b5563; text-decoration: underline;">soporte@sjlabdental.com</a>.
        </div>
      </div>
    </div>
  </body>
</html>
  `;
}

// ---------- Sub-Blocks ----------

function getAccessBlock(email: string, mustChangePassword: boolean, tempPassword?: string): string {
  const credentialsHtml = mustChangePassword
    ? `
<div class="access-card">
  <div class="access-title">Credenciales de Acceso Temporal</div>
  <p style="margin: 0; font-size: 13px; color: #4b5563; line-height: 1.5;">
    <strong>Usuario:</strong> ${email}<br>
    <strong>Contraseña temporal:</strong> <span style="font-family: monospace; background-color: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 13px; color: #111827; font-weight: bold; border: 1px solid #e5e7eb;">${tempPassword}</span>
  </p>
  <p style="margin: 8px 0 0 0; font-size: 11px; color: #dc2626; font-weight: 500;">
    * Por razones de seguridad, deberá modificar esta contraseña temporal al iniciar sesión por primera vez.
  </p>
</div>
    `
    : `
<div class="access-card">
  <div class="access-title">Acceso al Portal</div>
  <p style="margin: 0; font-size: 13px; color: #4b5563; line-height: 1.5;">
    Puede ingresar con su correo electrónico registrado (<strong>${email}</strong>) y su contraseña habitual.
  </p>
</div>
    `;

  return `
${credentialsHtml}
<div class="btn-container">
  <a href="https://sjlabdental.com/portal" class="btn" target="_blank">Acceder al Portal</a>
</div>
  `;
}

function getFinancialBlock(totalInvoiced: number, totalPaid: number, balance: number): string {
  let highlightClass = "highlight";
  let statusText = "Saldo Pendiente (Deuda)";
  let displayBalance = Math.abs(balance);
  
  if (balance > 0.005) {
    highlightClass = "highlight-green";
    statusText = "Saldo a Favor (Crédito)";
  } else if (Math.abs(balance) <= 0.005) {
    highlightClass = "highlight-neutral";
    statusText = "Saldo Pendiente";
    displayBalance = 0;
  }

  return `
<div class="financial-card">
  <div class="financial-title">Resumen Financiero (USD)</div>
  <table class="financial-table">
    <tr>
      <td class="label">Total Facturado:</td>
      <td class="value">${formatCurrency(totalInvoiced)}</td>
    </tr>
    <tr>
      <td class="label">Total Abonado:</td>
      <td class="value">${formatCurrency(totalPaid)}</td>
    </tr>
    <tr class="${highlightClass}">
      <td class="label">${statusText}:</td>
      <td class="value">${formatCurrency(displayBalance)}</td>
    </tr>
  </table>
</div>
  `;
}

// ---------- API REST Resend Dispatcher ----------

export async function sendEmailViaResend(
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    if (to.toLowerCase().endsWith("@sjlabdental.com")) {
      console.log(`[EMAIL] Omitiendo envío real a ${to} por pertenecer al dominio reservado de desarrollo (@sjlabdental.com)`);
      return { success: true, data: { id: "skipped_dev_domain" } };
    }

    const { env } = await getCloudflareContext({ async: true });
    const apiKey = (env as any).RESEND_API_KEY || process.env.RESEND_API_KEY;
    const sender = (env as any).RESEND_SENDER_EMAIL || process.env.RESEND_SENDER_EMAIL || "SJ Lab Dental <soporte@sjlabdental.com>";

    if (!apiKey) {
      console.error("[EMAIL] RESEND_API_KEY no configurada en las variables de entorno.");
      return { success: false, error: "RESEND_API_KEY is missing" };
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: sender,
        to: [to],
        subject: subject,
        html: html,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[EMAIL] Error al enviar correo a ${to}: ${response.status} ${response.statusText}`, errorText);
      return { success: false, error: errorText };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[EMAIL] Excepción al enviar correo a ${to}:`, message);
    return { success: false, error: message };
  }
}

// ---------- DB Financial Metrics Loader ----------

export async function getClientFinancials(db: DrizzleD1Database<typeof schema>, clientId: string) {
  const [invoicedRes] = await db
    .select({
      total: sql<number>`COALESCE(sum(${schema.orders.finalPriceUsd}), 0)`
    })
    .from(schema.orders)
    .where(and(
      eq(schema.orders.clientId, clientId),
      sql`${schema.orders.status} != 'cancelled'`
    ));

  const [paidRes] = await db
    .select({
      total: sql<number>`COALESCE(sum(${schema.payments.amountUsd}), 0)`
    })
    .from(schema.payments)
    .where(and(
      eq(schema.payments.clientId, clientId),
      eq(schema.payments.status, 'active')
    ));

  const totalInvoiced = Number(invoicedRes?.total || 0);
  const totalPaid = Number(paidRes?.total || 0);
  const balance = Number((totalPaid - totalInvoiced).toFixed(2));

  return { totalInvoiced, totalPaid, balance };
}

// ---------- Trigger Handlers ----------

// 1. Bienvenida / Onboarding Email Trigger
interface OnboardingEmailParams {
  email: string;
  name: string;
  tempPassword?: string;
}

export async function sendOnboardingEmail({ email, name, tempPassword }: OnboardingEmailParams) {
  console.log(`[EMAIL] Generando correo de bienvenida para: ${email}`);
  
  const contentHtml = `
<h2>Bienvenido a SJ Lab Dental</h2>
<p>Estimado(a) Dr(a). <strong>${name}</strong>,</p>
<p>Le damos la bienvenida a la plataforma de gestión digital de <strong>SJ Lab Dental</strong>. A partir de este momento, podrá realizar el seguimiento de sus pedidos de prótesis, revisar su historial de facturación y registrar sus pagos de manera ágil y transparente.</p>
<p>Para ingresar al portal de clientes, utilice el siguiente enlace y sus credenciales de acceso temporal:</p>

${getAccessBlock(email, true, tempPassword)}

<p>Si tiene alguna consulta o requiere asistencia técnica para su ingreso, no dude en comunicarse con nosotros respondiendo a este mensaje.</p>
  `;

  const html = getEmailLayout("Bienvenido a SJ Lab Dental", contentHtml);
  return sendEmailViaResend(email, "Bienvenido a la plataforma — SJ Lab Dental", html);
}

// 2. Pedido Listo Email Trigger
interface OrderReadyEmailParams {
  orderId: string;
  db: DrizzleD1Database<typeof schema>;
}

export async function sendOrderReadyEmail({ orderId, db }: OrderReadyEmailParams) {
  console.log(`[EMAIL] Generando correo de pedido listo para ID: ${orderId}`);

  // Fetch order information
  const orderList = await db
    .select({
      id: schema.orders.id,
      orderNumber: schema.orders.orderNumber,
      patientName: schema.orders.patientName,
      finalPriceUsd: schema.orders.finalPriceUsd,
      clientId: schema.orders.clientId,
      clientName: schema.users.name,
      clientEmail: schema.users.email,
      mustChangePassword: schema.users.mustChangePassword,
      productName: schema.products.name,
    })
    .from(schema.orders)
    .innerJoin(schema.users, eq(schema.orders.clientId, schema.users.id))
    .leftJoin(schema.products, eq(schema.orders.productId, schema.products.id))
    .where(eq(schema.orders.id, orderId))
    .limit(1);

  if (orderList.length === 0) {
    console.error(`[EMAIL] Pedido no encontrado para correo de listo: ${orderId}`);
    return { success: false, error: "Order not found" };
  }

  const order = orderList[0];
  
  // Calculate client balance
  const financials = await getClientFinancials(db, order.clientId);

  const contentHtml = `
<h2>Su trabajo está listo para entrega</h2>
<p>Estimado(a) Dr(a). <strong>${order.clientName}</strong>,</p>
<p>Le informamos que el siguiente trabajo ha sido completado con éxito en nuestro laboratorio y se encuentra listo para su entrega o despacho:</p>

<div class="table-wrapper">
  <table class="order-table">
    <thead>
      <tr>
        <th style="width: 15%">Pedido</th>
        <th style="width: 35%">Paciente</th>
        <th style="width: 35%">Detalle</th>
        <th style="width: 15%; text-align: right;">Precio</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="font-family: monospace; font-weight: bold;">#${order.orderNumber}</td>
        <td style="word-break: break-word;">${order.patientName}</td>
        <td>${order.productName || "Prótesis Dental"}</td>
        <td style="font-weight: 600; font-family: monospace; text-align: right;">${formatCurrency(order.finalPriceUsd)}</td>
      </tr>
    </tbody>
  </table>
</div>

${getFinancialBlock(financials.totalInvoiced, financials.totalPaid, financials.balance)}

<p>Para ver el desglose detallado de sus órdenes de trabajo, acceda al portal de clientes:</p>

${getAccessBlock(order.clientEmail, order.mustChangePassword)}

<p>Agradecemos su confianza en la calidad y precisión de nuestro servicio técnico.</p>
  `;

  const html = getEmailLayout(`Trabajo Listo — Pedido #${order.orderNumber}`, contentHtml);
  return sendEmailViaResend(order.clientEmail, `Trabajo Listo — Pedido #${order.orderNumber} (Paciente: ${order.patientName})`, html);
}

// 3. Recordatorio de Pago / Estado de Cuenta Trigger
interface StatementReminderEmailParams {
  clientId: string;
  db: DrizzleD1Database<typeof schema>;
}

export async function sendStatementReminderEmail({ clientId, db }: StatementReminderEmailParams) {
  console.log(`[EMAIL] Generando correo de recordatorio de cobro para cliente ID: ${clientId}`);

  const client = await db.query.users.findFirst({
    where: eq(schema.users.id, clientId),
  });

  if (!client) {
    console.error(`[EMAIL] Cliente no encontrado para recordatorio de cobro: ${clientId}`);
    return { success: false, error: "Client not found" };
  }

  const financials = await getClientFinancials(db, clientId);

  if (financials.balance >= 0) {
    console.log(`[EMAIL] El cliente ${client.name} no tiene deudas pendientes (${financials.balance} USD). Omitiendo envío.`);
    return { success: false, error: "No debt" };
  }

  const contentHtml = `
<h2>Recordatorio de Estado de Cuenta</h2>
<p>Estimado(a) Dr(a). <strong>${client.name}</strong>,</p>
<p>Esperamos que se encuentre muy bien. Le hacemos llegar un resumen actualizado del estado de cuenta de sus trabajos en **SJ Lab Dental**. Agradecemos de antemano su gestión para mantener el balance de su cuenta al día:</p>

${getFinancialBlock(financials.totalInvoiced, financials.totalPaid, financials.balance)}

<p>Para revisar el detalle cronológico de sus pedidos y pagos, descargar sus estados de cuenta en PDF o notificar sus abonos, ingrese a su portal personal:</p>

${getAccessBlock(client.email, client.mustChangePassword)}

<p>Agradecemos su valiosa colaboración y permanencia.</p>
  `;

  const html = getEmailLayout("Estado de Cuenta Pendiente — SJ Lab Dental", contentHtml);
  return sendEmailViaResend(client.email, `Estado de Cuenta Pendiente — SJ Lab Dental`, html);
}
