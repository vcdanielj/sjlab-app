// ============================================
// SJ Lab — Portal: Mis Pedidos
// ============================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/Toast';
import { formatCurrency, formatDate } from '@/lib/utils';
import styles from './page.module.css';

// ---------- Types ----------

interface ProgressStep {
  id: string;
  name: string;
}

interface OrderProgress {
  currentIndex: number;
  totalSteps: number;
  steps: ProgressStep[];
}

interface PortalOrder {
  id: string;
  orderNumber: number;
  patientName: string;
  finalPriceUsd: number;
  amountPaidUsd: number;
  status: string;
  currentStepName: string | null;
  productName: string | null;
  productSummary?: string | null;
  categorySummary?: string | null;
  createdAt: number;
  completedAt: number | null;
  deliveredAt: number | null;
  jobsProgress: {
    total: number;
    completed: number;
    pending: number;
    percent: number;
    ready: boolean;
  };
  progress: OrderProgress;
}

// ---------- Constants ----------

const FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'active', label: 'Activos' },
  { key: 'completed', label: 'Completados' },
  { key: 'delivered', label: 'Entregados' },
];

const STATUS_STYLES: Record<string, string> = {
  active: styles.statusActive,
  completed: styles.statusCompleted,
  delivered: styles.statusDelivered,
  cancelled: styles.statusCancelled,
};

const STATUS_LABELS: Record<string, string> = {
  active: 'En proceso',
  completed: 'Completado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

// ---------- Component ----------

export default function PortalOrdersPage() {
  const { addToast } = useToast();
  const [orders, setOrders] = useState<PortalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [historyOpen, setHistoryOpen] = useState(false);

  const fetchOrders = useCallback(async (status: string) => {
    setLoading(true);
    try {
      const qs = status !== 'all' ? `?status=${status}` : '';
      const res = await fetch(`/api/portal/orders${qs}`);
      const data = await res.json();
      if (data.data) setOrders(data.data);
    } catch {
      addToast('Error al cargar pedidos', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchOrders(filter);
  }, [filter, fetchOrders]);

  // Split active vs history
  const activeOrders = orders.filter((o) => o.status === 'active');
  const historyOrders = orders.filter((o) => o.status !== 'active');

  function renderProgressBar(progress: OrderProgress, status: string) {
    if (progress.totalSteps === 0) return null;

    const isCompleted = status === 'completed' || status === 'delivered';
    const filledPercentage = isCompleted
      ? 100
      : progress.currentIndex >= 0
        ? (progress.currentIndex / Math.max(progress.totalSteps - 1, 1)) * 100
        : 0;

    return (
      <div className={styles.progressSection}>
        <div className={styles.progressBar} style={{ position: 'relative' }}>
          {/* Background line */}
          <div className={styles.progressLine} />
          {/* Filled line */}
          <div
            className={styles.progressLineFilled}
            style={{ width: `${filledPercentage}%` }}
          />
          {/* Step dots */}
          {progress.steps.map((step, idx) => {
            const isDone = isCompleted || idx < progress.currentIndex;
            const isCurrent = !isCompleted && idx === progress.currentIndex;
            const dotCls = isDone
              ? styles.progressDotDone
              : isCurrent
                ? styles.progressDotCurrent
                : styles.progressDotPending;
            const nameCls = isCurrent ? styles.progressStepNameActive : '';

            return (
              <div key={step.id} className={styles.progressStep}>
                <div className={`${styles.progressDot} ${dotCls}`}>
                  {isDone ? (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5.5L4 7.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  ) : isCurrent ? (
                    <svg width="6" height="6" viewBox="0 0 6 6" fill="currentColor"><circle cx="3" cy="3" r="3"/></svg>
                  ) : ''}
                </div>
                <span className={`${styles.progressStepName} ${nameCls}`}>
                  {step.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderOrderCard(order: PortalOrder) {
    const statusCls = STATUS_STYLES[order.status] || '';
    const statusLabel = STATUS_LABELS[order.status] || order.status;

    return (
      <div key={order.id} className={styles.orderCard}>
        <div className={styles.orderTop}>
          <div className={styles.orderInfo}>
            <div className={styles.orderNumber}>Pedido #{order.orderNumber}</div>
            <div className={styles.patientName}>{order.patientName}</div>
            {(order.productSummary || order.productName) && (
              <div className={styles.productName}>
                {order.productSummary || order.productName}
                {order.categorySummary ? ` · ${order.categorySummary}` : ''}
              </div>
            )}
            <div className={styles.productName}>
              {order.jobsProgress.completed}/{order.jobsProgress.total} trabajos finalizados
            </div>
          </div>
          <span className={`${styles.statusBadge} ${statusCls}`}>
            {statusLabel}
          </span>
        </div>

        {order.status === 'active' && renderProgressBar(order.progress, order.status)}
        {(order.status === 'completed' || order.status === 'delivered') &&
          renderProgressBar(order.progress, order.status)
        }

        <div className={styles.orderMeta}>
          <span className={styles.orderDate}>{formatDate(order.createdAt)}</span>
          <span className={styles.orderPrice}>{formatCurrency(order.finalPriceUsd)}</span>
        </div>
      </div>
    );
  }

  // Calculate financial summary from orders
  const totalInvoiced = orders.reduce((sum, o) => sum + o.finalPriceUsd, 0);
  const totalPaid = orders.reduce((sum, o) => sum + o.amountPaidUsd, 0);
  const balance = totalPaid - totalInvoiced;

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>Mis Pedidos</h1>
        <p className={styles.subtitle}>Estado de tus trabajos en el laboratorio</p>
      </div>

      {/* Financial Summary */}
      {!loading && orders.length > 0 && (
        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Total Facturado</span>
            <span className={styles.summaryValue}>{formatCurrency(totalInvoiced)}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Total Abonado</span>
            <span className={`${styles.summaryValue} ${styles.summaryValueGreen}`}>{formatCurrency(totalPaid)}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>{balance >= 0 ? 'Saldo a Favor' : 'Saldo Pendiente'}</span>
            <span className={`${styles.summaryValue} ${balance >= 0 ? styles.summaryValueGreen : styles.summaryValueRed}`}>
              {formatCurrency(Math.abs(balance))}
            </span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className={styles.filters}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`${styles.filterBtn} ${filter === f.key ? styles.filterBtnActive : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading ? (
        <div className={styles.loadingWrap}>
          <div className={styles.spinner} />
        </div>
      ) : orders.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="1" />
            </svg>
          </span>
          <span className={styles.emptyTitle}>Sin pedidos</span>
          <span className={styles.emptyDesc}>
            {filter !== 'all'
              ? 'No hay pedidos con este filtro.'
              : 'No tienes pedidos registrados aún.'}
          </span>
        </div>
      ) : (
        <>
          {/* Active Orders */}
          {filter === 'all' && activeOrders.length > 0 && (
            <>
              <div className={styles.orderList}>
                {activeOrders.map(renderOrderCard)}
              </div>
            </>
          )}

          {/* Non-all filter: show all */}
          {filter !== 'all' && (
            <div className={styles.orderList}>
              {orders.map(renderOrderCard)}
            </div>
          )}

          {/* History Section (for 'all' filter) */}
          {filter === 'all' && historyOrders.length > 0 && (
            <>
              <button
                className={styles.historyToggle}
                onClick={() => setHistoryOpen(!historyOpen)}
              >
                <span>
                  Historial
                  <span className={styles.counterBadge}>{historyOrders.length}</span>
                </span>
                <span className={`${styles.historyArrow} ${historyOpen ? styles.historyArrowOpen : ''}`}>
                  ▼
                </span>
              </button>
              {historyOpen && (
                <div className={styles.orderList}>
                  {historyOrders.map(renderOrderCard)}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
