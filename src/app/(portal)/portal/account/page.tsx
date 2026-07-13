// ============================================
// SJ Lab — Portal: Mi Cuenta
// ============================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/Toast';
import { formatCurrency, formatDate } from '@/lib/utils';
import styles from './page.module.css';

// ---------- Types ----------

interface AccountSummary {
  totalInvoiced: number;
  totalPaid: number;
  netBalance: number;
  orderCount: number;
  paymentCount: number;
}

interface Movement {
  id: string;
  date: number;
  type: 'charge' | 'credit';
  concept: string;
  amount: number;
}

// ---------- Component ----------

export default function PortalAccountPage() {
  const { addToast } = useToast();
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const fetchAccount = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/portal/account');
      const data = await res.json();
      if (data.data) {
        setSummary(data.data.summary);
        setMovements(data.data.movements);
      }
    } catch {
      addToast('Error al cargar cuenta', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  const handleDownloadPdf = useCallback(async () => {
    setDownloadingPdf(true);
    try {
      // Get own session to get the user ID
      const sessionRes = await fetch('/api/auth/session');
      const sessionData = await sessionRes.json();
      if (!sessionData.data?.user?.id) {
        addToast('Error al obtener sesión', 'error');
        return;
      }

      const clientId = sessionData.data.user.id;
      const res = await fetch(`/api/clients/${clientId}/statement`);
      if (!res.ok) {
        addToast('Error al generar PDF', 'error');
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'estado_de_cuenta.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast('PDF descargado', 'success');
    } catch {
      addToast('Error al descargar PDF', 'error');
    } finally {
      setDownloadingPdf(false);
    }
  }, [addToast]);

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (!summary) return null;

  const balanceClass = summary.netBalance > 0.005
    ? styles.balancePositive
    : summary.netBalance < -0.005
      ? styles.balanceNegative
      : styles.balanceZero;

  const balanceLabel = summary.netBalance > 0.005
    ? 'Saldo a tu favor'
    : summary.netBalance < -0.005
      ? 'Saldo pendiente'
      : 'Cuenta al día';

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>Mi Cuenta</h1>
        <p className={styles.subtitle}>Estado de pagos y saldo</p>
      </div>

      {/* Balance Card */}
      <div className={styles.balanceCard}>
        <div className={styles.balanceLabel}>Saldo Neto</div>
        <div className={`${styles.balanceValue} ${balanceClass}`}>
          {formatCurrency(Math.abs(summary.netBalance))}
        </div>
        <div className={styles.balanceStatus}>{balanceLabel}</div>
      </div>

      {/* Summary Grid */}
      <div className={styles.summaryGrid}>
        <div className={styles.summaryItem}>
          <div className={styles.summaryItemLabel}>Facturado</div>
          <div className={styles.summaryItemValue}>{formatCurrency(summary.totalInvoiced)}</div>
        </div>
        <div className={styles.summaryItem}>
          <div className={styles.summaryItemLabel}>Abonado</div>
          <div className={styles.summaryItemValue}>{formatCurrency(summary.totalPaid)}</div>
        </div>
        <div className={styles.summaryItem}>
          <div className={styles.summaryItemLabel}>Pedidos</div>
          <div className={styles.summaryItemValue}>{summary.orderCount}</div>
        </div>
        <div className={styles.summaryItem}>
          <div className={styles.summaryItemLabel}>Pagos</div>
          <div className={styles.summaryItemValue}>{summary.paymentCount}</div>
        </div>
      </div>

      {/* PDF Download */}
      <div className={styles.actions}>
        <button
          className={styles.pdfBtn}
          onClick={handleDownloadPdf}
          disabled={downloadingPdf}
        >
          <span className={styles.pdfIcon}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 2v8M4.5 7.5L8 10l3.5-2.5" />
              <path d="M3 11v1.5A1.5 1.5 0 004.5 14h7a1.5 1.5 0 001.5-1.5V11" />
            </svg>
          </span>
          {downloadingPdf ? 'Generando...' : 'Descargar Estado de Cuenta'}
        </button>
      </div>

      {/* Movements */}
      <div className={styles.movementsSection}>
        <div className={styles.movementsTitle}>Movimientos</div>
        {movements.length === 0 ? (
          <div className={styles.emptyMovements}>
            Sin movimientos registrados
          </div>
        ) : (
          <div className={styles.movementsList}>
            {movements.map((mov) => {
              const isCharge = mov.type === 'charge';
              return (
                <div key={mov.id} className={styles.movementItem}>
                  <div
                    className={`${styles.movementIcon} ${
                      isCharge ? styles.movementIconCharge : styles.movementIconCredit
                    }`}
                  >
                    {isCharge ? '−' : '+'}
                  </div>
                  <div className={styles.movementContent}>
                    <div className={styles.movementConcept}>{mov.concept}</div>
                    <div className={styles.movementDate}>{formatDate(mov.date)}</div>
                  </div>
                  <div
                    className={`${styles.movementAmount} ${
                      isCharge ? styles.movementAmountCharge : styles.movementAmountCredit
                    }`}
                  >
                    {isCharge ? '-' : '+'}{formatCurrency(mov.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
