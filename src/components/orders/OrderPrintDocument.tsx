// ============================================
// SJ Lab — Order Print Document (Letter 50/50)
// Top half: Lab work order · Bottom half: Client receipt
// ============================================

import QRCode from 'react-qr-code';
import { formatBs, formatCurrency, formatDate } from '@/lib/utils';
import { getOrderColorOption, ORDER_COLOR_STANDARDS } from '@/lib/order-colors';
import styles from './order-print.module.css';

// ---------- Lab corporate identity (edit here if contact data changes) ----------

const LAB_INFO = {
  name: 'SJ Lab',
  tagline: 'Laboratorio Dental',
  whatsapp: '',
  email: '',
  address: '',
};

// ---------- Types ----------

export interface OrderPrintJob {
  productName: string;
  categoryName: string | null;
  notes: string | null;
  patientName: string;
  isPatientException: boolean;
  exceptionReason: string | null;
}

export interface OrderPrintStep {
  id: string;
  name: string;
}

export interface OrderPrintData {
  id: string;
  orderNumber: number;
  status: string;
  patientName: string;
  color: string | null;
  notes: string | null;
  createdAt: number;
  completedAt: number | null;
  deliveredAt: number | null;
  finalPriceUsd: number;
  amountPaidUsd: number;
  clientName: string;
  clientClinic: string | null;
  clientPhone: string | null;
  productName: string;
  currentStepId: string;
  jobs: OrderPrintJob[];
  workflowSteps: OrderPrintStep[];
  bsRate: number | null;
}

/** Shape of GET /api/orders/[id] consumed by the mapper. */
export interface OrderDetailResponse {
  order: {
    id: string;
    orderNumber: number;
    status: string;
    patientName: string;
    color: string | null;
    notes: string | null;
    createdAt: number;
    completedAt: number | null;
    deliveredAt: number | null;
    finalPriceUsd: number;
    amountPaidUsd: number;
    clientName: string;
    clientClinic: string | null;
    clientPhone: string | null;
    productName: string;
    currentStepId: string;
  };
  prosthesisJobs: Array<{
    productName: string;
    categoryName: string | null;
    notes: string | null;
    patientName: string;
    isPatientException: boolean;
    exceptionReason: string | null;
  }>;
  workflowSteps: Array<{ id: string; name: string; isActive: boolean }>;
}

/** Map the order-detail API response to print-ready data. */
export function toOrderPrintData(detail: OrderDetailResponse, bsRate: number | null): OrderPrintData {
  return {
    id: detail.order.id,
    orderNumber: detail.order.orderNumber,
    status: detail.order.status,
    patientName: detail.order.patientName,
    color: detail.order.color,
    notes: detail.order.notes,
    createdAt: detail.order.createdAt,
    completedAt: detail.order.completedAt,
    deliveredAt: detail.order.deliveredAt,
    finalPriceUsd: detail.order.finalPriceUsd,
    amountPaidUsd: detail.order.amountPaidUsd,
    clientName: detail.order.clientName,
    clientClinic: detail.order.clientClinic,
    clientPhone: detail.order.clientPhone,
    productName: detail.order.productName,
    currentStepId: detail.order.currentStepId,
    jobs: detail.prosthesisJobs.map((job) => ({
      productName: job.productName,
      categoryName: job.categoryName,
      notes: job.notes,
      patientName: job.patientName,
      isPatientException: job.isPatientException,
      exceptionReason: job.exceptionReason,
    })),
    workflowSteps: detail.workflowSteps
      .filter((step) => step.isActive)
      .map((step) => ({ id: step.id, name: step.name })),
    bsRate,
  };
}

// ---------- Helpers ----------

const MAX_VISIBLE_JOBS = 5;

function deliveryLabel(data: OrderPrintData): string {
  if (data.deliveredAt) return formatDate(data.deliveredAt);
  if (data.completedAt) return formatDate(data.completedAt);
  return 'En producción';
}

function ScissorsIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M20 4 8.12 15.88" />
      <path d="M14.47 14.48 20 20" />
      <path d="M8.12 8.12 12 12" />
    </svg>
  );
}

function ColorBox({ color }: { color: string | null }) {
  const option = getOrderColorOption(color);
  if (!option) {
    return (
      <div className={styles.colorBox}>
        <span className={styles.colorEmpty}>Sin color especificado</span>
      </div>
    );
  }
  const standard = ORDER_COLOR_STANDARDS.find((s) => s.value === option.standard)?.label || '';
  return (
    <div className={styles.colorBox} title={`${option.code} · ${option.name} (${standard})`}>
      <span className={styles.colorSwatch} style={{ backgroundColor: option.hex }} />
      <div>
        <span className={styles.colorCode}>{option.code}</span>
        <span className={styles.colorName}>
          {' '}{option.name}{standard ? ` · ${standard}` : ''}
        </span>
      </div>
    </div>
  );
}

function JobsList({ jobs }: { jobs: OrderPrintJob[] }) {
  const visible = jobs.slice(0, MAX_VISIBLE_JOBS);
  return (
    <ul className={styles.jobsList}>
      {visible.map((job, index) => (
        <li key={index} className={styles.jobItem}>
          <span className={styles.jobIndex}>{index + 1}.</span>
          <div className={styles.jobBody}>
            <span className={styles.jobName}>{job.productName}</span>
            <span className={styles.jobMeta}>
              {[
                job.categoryName,
                job.isPatientException && job.patientName ? `Paciente: ${job.patientName}` : null,
                job.isPatientException && job.exceptionReason ? `(${job.exceptionReason})` : null,
              ].filter(Boolean).join(' · ') || ' '}
            </span>
            {job.notes && <span className={styles.jobNotes} title={job.notes}>⚠ {job.notes}</span>}
          </div>
        </li>
      ))}
      {jobs.length > MAX_VISIBLE_JOBS && (
        <li className={styles.jobsMore}>+ {jobs.length - MAX_VISIBLE_JOBS} trabajo(s) más (ver sistema)</li>
      )}
    </ul>
  );
}

// ---------- Main Document ----------

export function OrderPrintDocument({ data, origin }: { data: OrderPrintData; origin: string }) {
  const labUrl = `${origin}/orders?order=${data.id}`;
  const clientUrl = `${origin}/portal?orderId=${data.id}`;
  const balance = data.finalPriceUsd - data.amountPaidUsd;
  const isPaid = balance <= 0.005;
  const currentStepIndex = data.workflowSteps.findIndex((s) => s.id === data.currentStepId);
  const contactParts = [
    LAB_INFO.whatsapp ? `WhatsApp: ${LAB_INFO.whatsapp}` : null,
    LAB_INFO.email || null,
    LAB_INFO.address || null,
  ].filter(Boolean);

  return (
    <div className={styles.sheet}>
      {/* ================= TOP HALF — LAB COPY ================= */}
      <section className={styles.half}>
        <div className={styles.halfHeader}>
          <div>
            <div className={styles.brandName}>{LAB_INFO.name}</div>
            <div className={styles.brandSub}>{LAB_INFO.tagline}</div>
            <div className={styles.docType}>Orden de Trabajo · Copia Laboratorio</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className={styles.orderBadge}>
              <span className={styles.orderBadgeLabel}>Pedido</span>
              <span className={styles.orderBadgeNumber}>#{data.orderNumber}</span>
            </div>
            <div className={styles.headerDates}>
              <div><span>Ingreso: </span><strong>{formatDate(data.createdAt)}</strong></div>
              <div><span>Entrega: </span><strong>{deliveryLabel(data)}</strong></div>
            </div>
          </div>
        </div>

        <div className={styles.infoRow}>
          <div className={styles.infoCell}>
            <span className={styles.infoLabel}>Odontólogo / Clínica</span>
            <span className={styles.infoValue} title={`${data.clientName}${data.clientClinic ? ` · ${data.clientClinic}` : ''}`}>
              {data.clientName}{data.clientClinic ? ` · ${data.clientClinic}` : ''}
            </span>
          </div>
          <div className={styles.infoCell}>
            <span className={styles.infoLabel}>Teléfono</span>
            <span className={styles.infoValue}>{data.clientPhone || '—'}</span>
          </div>
          <div className={styles.infoCell}>
            <span className={styles.infoLabel}>Paciente</span>
            <span className={styles.infoValue} title={data.patientName}>{data.patientName || '—'}</span>
          </div>
          <div className={styles.infoCell}>
            <span className={styles.infoLabel}>Color / Guía de tono</span>
            <ColorBox color={data.color} />
          </div>
        </div>

        <div className={styles.bodyGrid}>
          <div>
            <h4 className={styles.sectionTitle}>Trabajos a realizar</h4>
            <JobsList jobs={data.jobs} />
            {data.notes && (
              <div className={styles.notesBox}>
                <p className={styles.notesTitle}>⚠ Notas clínicas / indicaciones</p>
                <p className={styles.notesText} title={data.notes}>{data.notes}</p>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <h4 className={styles.sectionTitle}>Control de producción</h4>
            <ul className={styles.stepsList}>
              {data.workflowSteps.map((step, index) => {
                const isDone = currentStepIndex >= 0 && index < currentStepIndex;
                const isCurrent = index === currentStepIndex;
                return (
                  <li
                    key={step.id}
                    className={`${styles.stepItem} ${isDone ? styles.stepDone : ''} ${isCurrent ? styles.stepCurrent : ''}`}
                  >
                    <span className={styles.stepCheckbox}>{isDone ? '✓' : ''}</span>
                    <span className={styles.stepName}>{step.name}</span>
                    <span className={styles.stepInitials} />
                  </li>
                );
              })}
            </ul>
            <div className={styles.qrBlock}>
              <div className={styles.qrImage}>
                <QRCode value={labUrl} bgColor="#FFFFFF" fgColor="#0F172A" />
              </div>
              <p className={styles.qrText}>
                <strong>QR Laboratorio</strong>
                Escanear para abrir la orden en el sistema y actualizar el paso de trabajo.
              </p>
            </div>
          </div>
        </div>

        <div className={styles.halfFooter}>
          <span>{LAB_INFO.name} · Copia Laboratorio · Pedido #{data.orderNumber}</span>
          <span>Técnico responsable: <span className={styles.signatureLine} /></span>
        </div>
      </section>

      {/* ================= CUT LINE ================= */}
      <div className={styles.cutLine}>
        <span className={styles.cutDash} />
        <span className={styles.cutLabel}><ScissorsIcon /> Línea de corte</span>
        <span className={styles.cutDash} />
      </div>

      {/* ================= BOTTOM HALF — CLIENT COPY ================= */}
      <section className={styles.half}>
        <div className={styles.halfHeader}>
          <div>
            <div className={styles.brandName}>{LAB_INFO.name}</div>
            <div className={styles.brandSub}>{LAB_INFO.tagline}</div>
            {contactParts.length > 0 && (
              <div className={styles.contactLine}>{contactParts.join(' · ')}</div>
            )}
            <div className={styles.docType}>Comprobante de Recepción · Copia Cliente</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className={styles.orderBadge}>
              <span className={styles.orderBadgeLabel}>Pedido</span>
              <span className={styles.orderBadgeNumber}>#{data.orderNumber}</span>
            </div>
            <div className={styles.headerDates}>
              <div><span>Recepción: </span><strong>{formatDate(data.createdAt)}</strong></div>
              <div><span>Entrega est.: </span><strong>{deliveryLabel(data)}</strong></div>
            </div>
          </div>
        </div>

        <div className={styles.infoRow}>
          <div className={styles.infoCell}>
            <span className={styles.infoLabel}>Doctor / Clínica</span>
            <span className={styles.infoValue} title={`${data.clientName}${data.clientClinic ? ` · ${data.clientClinic}` : ''}`}>
              {data.clientName}{data.clientClinic ? ` · ${data.clientClinic}` : ''}
            </span>
          </div>
          <div className={styles.infoCell}>
            <span className={styles.infoLabel}>Paciente</span>
            <span className={styles.infoValue} title={data.patientName}>{data.patientName || '—'}</span>
          </div>
          <div className={styles.infoCell}>
            <span className={styles.infoLabel}>Tipo de restauración</span>
            <span className={styles.infoValue} title={data.productName}>{data.productName}</span>
          </div>
          <div className={styles.infoCell}>
            <span className={styles.infoLabel}>Color</span>
            <ColorBox color={data.color} />
          </div>
        </div>

        <div className={styles.bodyGrid}>
          <div>
            <h4 className={styles.sectionTitle}>Resumen del pedido</h4>
            <JobsList jobs={data.jobs} />
            <div style={{ marginTop: '2mm' }}>
              <h4 className={styles.sectionTitle}>Términos y condiciones</h4>
              <p className={styles.termsText}>
                Este comprobante certifica la recepción del trabajo descrito. Los trabajos tienen garantía
                por defectos de laboratorio dentro de los 30 días posteriores a la entrega. Las pruebas
                clínicas deben solicitarse dentro del plazo acordado; vencido el plazo de entrega sin
                observaciones, el trabajo se considera aceptado. Conserve este comprobante para retirar
                su pedido o realizar reclamos.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <h4 className={styles.sectionTitle}>Estado de cuenta</h4>
            <div className={styles.financeBox}>
              <div className={styles.financeRow}>
                <span>Total del pedido</span>
                <strong>
                  {formatCurrency(data.finalPriceUsd)}
                  {data.bsRate ? <small>≈ {formatBs(data.finalPriceUsd * data.bsRate)}</small> : null}
                </strong>
              </div>
              <div className={styles.financeRow}>
                <span>Monto abonado</span>
                <strong>
                  {formatCurrency(data.amountPaidUsd)}
                  {data.bsRate ? <small>≈ {formatBs(data.amountPaidUsd * data.bsRate)}</small> : null}
                </strong>
              </div>
              <div className={`${styles.balanceRow} ${isPaid ? styles.balancePaid : ''}`}>
                <span>{isPaid ? 'Pagado en su totalidad' : 'Saldo pendiente'}</span>
                <strong>{formatCurrency(Math.abs(balance))}</strong>
              </div>
            </div>
            <div className={styles.qrBlock}>
              <div className={styles.qrImage}>
                <QRCode value={clientUrl} bgColor="#FFFFFF" fgColor="#0F172A" />
              </div>
              <p className={styles.qrText}>
                <strong>QR Cliente</strong>
                Escanee para consultar el estado de su trabajo en tiempo real desde el portal web.
              </p>
            </div>
          </div>
        </div>

        <div className={styles.halfFooter}>
          <span>{LAB_INFO.name} · Copia Cliente · Pedido #{data.orderNumber}</span>
          <span>Recibido por: <span className={styles.signatureLine} /></span>
        </div>
      </section>
    </div>
  );
}
