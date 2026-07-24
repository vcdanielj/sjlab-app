// ============================================
// SJ Lab — Dashboard Page (Analytics)
// ============================================

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
  LineChart, Line, Area, AreaChart, ComposedChart,
} from 'recharts';
import type { PieLabelRenderProps } from 'recharts';
import { formatCurrency, formatDate, formatRelativeTime, getPeriodRange, percentageChange } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import styles from './page.module.css';

// ---------- Types ----------

interface KpiData {
  value: number;
  previous: number;
  sparkline?: number[];
}

interface KpisResponse {
  totalInvoiced: KpiData;
  totalCollected: KpiData;
  newOrders: KpiData;
  completedOrders: KpiData;
  totalExpenses?: KpiData;
  personalExpenses?: KpiData;
  labExpenses?: KpiData;
  netMargin?: KpiData;
  collectionRate?: KpiData;
  activeClients?: KpiData;
  averageOrderValue?: KpiData;
  activeOrders?: KpiData;
  monthlyRecurringExpense?: KpiData;
  pendingCollection?: KpiData;
  expenseRatio?: KpiData;
  avgDailyExpense?: KpiData;
}

interface RevenueItem {
  label: string;
  invoiced: number;
  collected: number;
}

interface ProductionItem {
  name: string;
  value: number;
}

interface InvoiceExpenseItem {
  label: string;
  invoiced: number;
  expenses: number;
  personalExpenses: number;
  labExpenses: number;
  margin: number;
}

interface ExpenseCategoryItem {
  name: string;
  value: number;
  color: string;
  percentage: number;
}

interface TopClient {
  name: string;
  total: number;
  orders: number;
}

interface TopProduct {
  name: string;
  total: number;
  orders: number;
}

interface PaymentMethodItem {
  name: string;
  value: number;
  color: string;
  count: number;
  percentage: number;
}

interface BottleneckItem {
  stepName: string;
  workflowName: string;
  avgHours: number;
  orderCount: number;
}

interface Workflow {
  id: string;
  name: string;
}

interface ActivityItem {
  id: string;
  type: 'move' | 'payment' | 'order';
  timestamp: number;
  description: string;
  actor: string;
}

// ---------- Constants ----------

const PERIOD_OPTIONS = [
  { key: 'today', label: 'Hoy' },
  { key: 'this_week', label: 'Semana' },
  { key: 'this_month', label: 'Mes' },
  { key: 'last_quarter', label: 'Trimestre' },
  { key: 'this_year', label: 'Año' },
  { key: 'custom', label: 'Personalizado' },
];

const EXPENSE_SCOPE_OPTIONS = [
  { key: 'all', label: 'Todos' },
  { key: 'lab', label: 'Laboratorio' },
  { key: 'personal', label: 'Personal' },
];

const DONUT_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
];

const RECURRENCE_MAP: Record<string, string> = {
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
  quarterly: 'Trimestral',
  yearly: 'Anual',
};

// ---------- Helpers ----------

function tsToDateInput(ts: number): string {
  const d = new Date(ts * 1000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function dateInputToTs(val: string): number {
  return Math.floor(new Date(val + 'T00:00:00').getTime() / 1000);
}

// ---------- Component ----------

export default function DashboardPage() {
  const [period, setPeriod] = useState('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [expenseScope, setExpenseScope] = useState('all');

  const [kpis, setKpis] = useState<KpisResponse | null>(null);
  const [revenue, setRevenue] = useState<RevenueItem[]>([]);
  const [production, setProduction] = useState<ProductionItem[]>([]);
  const [invoiceVsExpenses, setInvoiceVsExpenses] = useState<InvoiceExpenseItem[]>([]);
  const [expenseLabData, setExpenseLabData] = useState<ExpenseCategoryItem[]>([]);
  const [expenseLabTotal, setExpenseLabTotal] = useState(0);
  const [expensePersonalData, setExpensePersonalData] = useState<ExpenseCategoryItem[]>([]);
  const [expensePersonalTotal, setExpensePersonalTotal] = useState(0);
  const [topClients, setTopClients] = useState<TopClient[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>([]);
  const [paymentMethodsTotal, setPaymentMethodsTotal] = useState(0);
  const [bottlenecks, setBottlenecks] = useState<BottleneckItem[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState('');
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  // KPI Detail Modal state
  const [kpiModalOpen, setKpiModalOpen] = useState(false);
  const [kpiModalTitle, setKpiModalTitle] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [kpiModalData, setKpiModalData] = useState<any>(null);
  const [kpiModalLoading, setKpiModalLoading] = useState(false);

  const getRange = useCallback((): { from: number; to: number } => {
    if (period === 'custom' && customFrom && customTo) {
      return { from: dateInputToTs(customFrom), to: dateInputToTs(customTo) + 86400 };
    }
    return getPeriodRange(period);
  }, [period, customFrom, customTo]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { from, to } = getRange();
    const qs = `from=${from}&to=${to}`;
    const expenseQs = `${qs}&expenseScope=${expenseScope}`;

    try {
      const [kpiRes, revRes, prodRes, iveRes, expCatRes, topRes, topProdRes, payMethodRes, actRes] = await Promise.all([
        fetch(`/api/dashboard/kpis?${expenseQs}`),
        fetch(`/api/dashboard/revenue?${qs}`),
        fetch(`/api/dashboard/production?${qs}`),
        fetch(`/api/dashboard/invoice-vs-expenses?${expenseQs}`),
        fetch(`/api/dashboard/expense-categories?${expenseQs}`),
        fetch(`/api/dashboard/top-clients?${qs}`),
        fetch(`/api/dashboard/top-products?${qs}`),
        fetch(`/api/dashboard/payment-methods?${qs}`),
        fetch('/api/dashboard/activity'),
      ]);

      const [kpiData, revData, prodData, iveData, expCatData, topData, topProdData, payMethodData, actData] = await Promise.all([
        kpiRes.json(),
        revRes.json(),
        prodRes.json(),
        iveRes.json(),
        expCatRes.json(),
        topRes.json(),
        topProdRes.json(),
        payMethodRes.json(),
        actRes.json(),
      ]);

      if (kpiData.data) setKpis(kpiData.data);
      if (revData.data) setRevenue(revData.data);
      if (prodData.data) setProduction(prodData.data);
      if (iveData.data) setInvoiceVsExpenses(iveData.data);
      if (expCatData.lab) {
        setExpenseLabData(expCatData.lab.data || []);
        setExpenseLabTotal(expCatData.lab.totalSum || 0);
      }
      if (expCatData.personal) {
        setExpensePersonalData(expCatData.personal.data || []);
        setExpensePersonalTotal(expCatData.personal.totalSum || 0);
      }
      if (topData.data) setTopClients(topData.data);
      if (topProdData.data) setTopProducts(topProdData.data);
      if (payMethodData.data) {
        setPaymentMethods(payMethodData.data);
        setPaymentMethodsTotal(payMethodData.totalSum || 0);
      }
      if (actData.data) setActivity(actData.data);
    } catch {
      // Silent fail — individual charts show empty states
    } finally {
      setLoading(false);
    }
  }, [getRange, expenseScope]);

  const fetchBottlenecks = useCallback(async (workflowId: string) => {
    try {
      const qs = workflowId ? `workflowId=${workflowId}` : '';
      const res = await fetch(`/api/dashboard/bottlenecks?${qs}`);
      const data = await res.json();
      if (data.data) setBottlenecks(data.data);
      if (data.workflows) setWorkflows(data.workflows);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    fetchBottlenecks(selectedWorkflow);
  }, [selectedWorkflow, fetchBottlenecks]);

  // KPI Detail Modal handler
  async function openKpiDetail(kpiKey: string, title: string) {
    setKpiModalTitle(title);
    setKpiModalOpen(true);
    setKpiModalLoading(true);
    setKpiModalData(null);
    try {
      const { from, to } = getRange();
      const qs = `kpi=${kpiKey}&from=${from}&to=${to}&expenseScope=${expenseScope}`;
      const res = await fetch(`/api/dashboard/kpi-detail?${qs}`);
      const json = await res.json();
      if (json.data) setKpiModalData(json.data);
    } catch {
      // silent
    } finally {
      setKpiModalLoading(false);
    }
  }

  function handlePeriodChange(key: string) {
    setPeriod(key);
    if (key === 'custom') {
      const { from, to } = getPeriodRange('this_month');
      setCustomFrom(tsToDateInput(from));
      setCustomTo(tsToDateInput(to));
    }
  }

  // ---------- Render Helpers ----------

  function renderChange(current: number, previous: number, inverted = false) {
    const change = percentageChange(current, previous);
    const isUp = change > 0;
    const isDown = change < 0;
    const cls = inverted
      ? (isUp ? styles.kpiChangeDown : isDown ? styles.kpiChangeUp : styles.kpiChangeNeutral)
      : (isUp ? styles.kpiChangeUp : isDown ? styles.kpiChangeDown : styles.kpiChangeNeutral);
    const arrow = isUp ? '↑' : isDown ? '↓' : '→';
    return (
      <span className={`${styles.kpiChange} ${cls}`}>
        {arrow} {Math.abs(change).toFixed(0)}%
      </span>
    );
  }

  function renderSparkline(data: number[] | undefined, color: string) {
    if (!data || data.length === 0) return null;
    const sparkData = data.map((v, i) => ({ v, i }));
    return (
      <div className={styles.sparklineContainer}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <AreaChart data={sparkData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`sparkGrad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#sparkGrad-${color.replace('#', '')})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const selectedExpenseLabel = expenseScope === 'personal'
    ? 'Gastos Personales'
    : expenseScope === 'lab'
      ? 'Gastos Laboratorio'
      : 'Gastos Totales';

  const activityIcons: Record<string, { emoji: string; cls: string }> = {
    move: { emoji: '↗', cls: styles.activityIconMove },
    payment: { emoji: '$', cls: styles.activityIconPayment },
    order: { emoji: '+', cls: styles.activityIconOrder },
  };

  // Custom tooltip styling
  const tooltipStyle = {
    backgroundColor: '#fff',
    border: '1px solid #E5E7EB',
    borderRadius: '8px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.04)',
    padding: '8px 12px',
    fontSize: '12px',
  };

  // Count-up animation hook
  function useCountUp(target: number, isCurrency = false, duration = 600) {
    const [display, setDisplay] = useState('0');
    const animRef = useRef<number>(0);
    const prevRef = useRef<number>(0);

    useEffect(() => {
      if (target === prevRef.current) return;
      const start = prevRef.current;
      const startTime = performance.now();
      prevRef.current = target;

      function animate(now: number) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
        const current = start + (target - start) * eased;

        if (isCurrency) {
          setDisplay(formatCurrency(current));
        } else {
          setDisplay(Math.round(current).toString());
        }

        if (progress < 1) {
          animRef.current = requestAnimationFrame(animate);
        }
      }

      animRef.current = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(animRef.current);
    }, [target, isCurrency, duration]);

    return display;
  }

  // KPI animated values
  const invoicedDisplay = useCountUp(kpis?.totalInvoiced.value ?? 0, true);
  const collectedDisplay = useCountUp(kpis?.totalCollected.value ?? 0, true);
  const newOrdersDisplay = useCountUp(kpis?.newOrders.value ?? 0);
  const completedDisplay2 = useCountUp(kpis?.completedOrders.value ?? 0);
  const expensesDisplay = useCountUp(kpis?.totalExpenses?.value ?? 0, true);
  const personalExpensesDisplay = useCountUp(kpis?.personalExpenses?.value ?? 0, true);
  const labExpensesDisplay = useCountUp(kpis?.labExpenses?.value ?? 0, true);
  const marginDisplay = useCountUp(kpis?.netMargin?.value ?? 0, true);
  const collectionRateDisplay = useCountUp(kpis?.collectionRate?.value ?? 0);
  const activeClientsDisplay = useCountUp(kpis?.activeClients?.value ?? 0);
  const averageOrderDisplay = useCountUp(kpis?.averageOrderValue?.value ?? 0, true);
  const activeOrdersDisplay = useCountUp(kpis?.activeOrders?.value ?? 0);
  const monthlyRecurringDisplay = useCountUp(kpis?.monthlyRecurringExpense?.value ?? 0, true);
  const pendingCollectionDisplay = useCountUp(kpis?.pendingCollection?.value ?? 0, true);
  const expenseRatioDisplay = useCountUp(kpis?.expenseRatio?.value ?? 0);
  const avgDailyExpenseDisplay = useCountUp(kpis?.avgDailyExpense?.value ?? 0, true);

  // Skeleton component
  function renderSkeleton() {
    return (
      <>
        <div className={styles.skeletonGrid}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={styles.skeletonCard}>
              <div className={`${styles.skeletonLine} ${styles.skeletonSmall}`} />
              <div className={`${styles.skeletonLine} ${styles.skeletonLarge}`} />
              <div className={`${styles.skeletonLine} ${styles.skeletonBar}`} />
            </div>
          ))}
        </div>
        <div className={styles.chartGrid}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={styles.skeletonChartCard}>
              <div className={`${styles.skeletonLine} ${styles.skeletonSmall}`} style={{ width: '40%' }} />
              <div className={styles.skeletonChartBody}>
                {[0, 1, 2, 3, 4].map((j) => (
                  <div key={j} className={styles.skeletonChartLine} style={{ width: `${60 + Math.random() * 40}%` }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  // ---------- Render ----------

  return (
    <div>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>Vista analítica del laboratorio</p>
        </div>
        <div className={styles.headerControls}>
          <div className={styles.selectorBlock}>
            <span className={styles.selectorLabel}>Periodo</span>
            <div className={styles.periodSelector}>
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  className={`${styles.periodBtn} ${period === opt.key ? styles.periodBtnActive : ''}`}
                  onClick={() => handlePeriodChange(opt.key)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Custom date range */}
      {period === 'custom' && (
        <div className={styles.periodSelector} style={{ marginBottom: 20 }}>
          <input
            type="date"
            className={styles.dateInput}
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
          />
          <span className={styles.dateSep}>→</span>
          <input
            type="date"
            className={styles.dateInput}
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
          />
        </div>
      )}

      {/* KPI Cards */}
      {loading && !kpis ? (
        renderSkeleton()
      ) : kpis ? (
        <div className={styles.kpiGrid}>
          {/* Fila 1: Ventas & Cobranza */}
          {/* Total Invoiced */}
          <div className={`${styles.kpiCard} ${styles.kpiCardClickable}`} onClick={() => openKpiDetail('totalInvoiced', 'Total Facturado')}>
            <div className={styles.kpiIconWrap} style={{ color: '#3B82F6' }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="3" y="5" width="16" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M3 9h16" stroke="currentColor" strokeWidth="1.5"/><path d="M7 13h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
            <span className={styles.kpiLabel}>Total Facturado</span>
            <div className={styles.kpiRow}>
              <span className={styles.kpiValueAnimated}>{invoicedDisplay}</span>
              {renderChange(kpis.totalInvoiced.value, kpis.totalInvoiced.previous)}
            </div>
            {renderSparkline(kpis.totalInvoiced.sparkline, '#3B82F6')}
          </div>

          {/* Total Collected */}
          <div className={`${styles.kpiCard} ${styles.kpiCardClickable}`} onClick={() => openKpiDetail('totalCollected', 'Total Cobrado')}>
            <div className={styles.kpiIconWrap} style={{ color: '#10B981' }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5"/><path d="M11 7v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <span className={styles.kpiLabel}>Total Cobrado</span>
            <div className={styles.kpiRow}>
              <span className={styles.kpiValueAnimated}>{collectedDisplay}</span>
              {renderChange(kpis.totalCollected.value, kpis.totalCollected.previous)}
            </div>
            {renderSparkline(kpis.totalCollected.sparkline, '#10B981')}
          </div>

          {/* Pendiente por Cobrar */}
          <div className={`${styles.kpiCard} ${styles.kpiCardClickable}`} onClick={() => openKpiDetail('pendingCollection', 'Pendiente por Cobrar')}>
            <div className={styles.kpiIconWrap} style={{ color: '#F59E0B' }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <span className={styles.kpiLabel}>Pendiente por Cobrar</span>
            <div className={styles.kpiRow}>
              <span className={styles.kpiValueAnimated}>{pendingCollectionDisplay}</span>
              {kpis.pendingCollection && renderChange(kpis.pendingCollection.value, kpis.pendingCollection.previous, true)}
            </div>
          </div>

          {/* Collection Rate */}
          <div className={`${styles.kpiCard} ${styles.kpiCardClickable}`} onClick={() => openKpiDetail('collectionRate', 'Tasa de Cobranza')}>
            <div className={styles.kpiIconWrap} style={{ color: '#10B981' }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5"/><path d="M11 7v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M8 10l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <span className={styles.kpiLabel}>Tasa de Cobranza</span>
            <div className={styles.kpiRow}>
              <span className={styles.kpiValueAnimated}>{collectionRateDisplay}%</span>
              {kpis.collectionRate && renderChange(kpis.collectionRate.value, kpis.collectionRate.previous)}
            </div>
          </div>

          {/* Fila 2: Operación & Producción */}
          {/* New Orders */}
          <div className={`${styles.kpiCard} ${styles.kpiCardClickable}`} onClick={() => openKpiDetail('newOrders', 'Pedidos Nuevos')}>
            <div className={styles.kpiIconWrap} style={{ color: '#6366F1' }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M4 5h14M4 9h14M4 13h10M4 17h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
            <span className={styles.kpiLabel}>Pedidos Nuevos</span>
            <div className={styles.kpiRow}>
              <span className={styles.kpiValueAnimated}>{newOrdersDisplay}</span>
              {renderChange(kpis.newOrders.value, kpis.newOrders.previous)}
            </div>
          </div>

          {/* Active Orders (In Progress) */}
          <div className={`${styles.kpiCard} ${styles.kpiCardClickable}`} onClick={() => openKpiDetail('activeOrders', 'Órdenes en Proceso')}>
            <div className={styles.kpiIconWrap} style={{ color: '#EC4899' }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <span className={styles.kpiLabel}>Órdenes en Proceso</span>
            <div className={styles.kpiRow}>
              <span className={styles.kpiValueAnimated}>{activeOrdersDisplay}</span>
            </div>
          </div>

          {/* Completed Orders */}
          <div className={`${styles.kpiCard} ${styles.kpiCardClickable}`} onClick={() => openKpiDetail('completedOrders', 'Pedidos Completados')}>
            <div className={styles.kpiIconWrap} style={{ color: '#8B5CF6' }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5"/><path d="M8 11l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <span className={styles.kpiLabel}>Completados</span>
            <div className={styles.kpiRow}>
              <span className={styles.kpiValueAnimated}>{completedDisplay2}</span>
              {renderChange(kpis.completedOrders.value, kpis.completedOrders.previous)}
            </div>
          </div>

          {/* Average Order Value */}
          <div className={`${styles.kpiCard} ${styles.kpiCardClickable}`} onClick={() => openKpiDetail('averageOrderValue', 'Ticket Promedio')}>
            <div className={styles.kpiIconWrap} style={{ color: '#8B5CF6' }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M3 11h6l2 5 3-10 2 5h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <span className={styles.kpiLabel}>Ticket Promedio</span>
            <div className={styles.kpiRow}>
              <span className={styles.kpiValueAnimated}>{averageOrderDisplay}</span>
              {kpis.averageOrderValue && renderChange(kpis.averageOrderValue.value, kpis.averageOrderValue.previous)}
            </div>
          </div>

          {/* Fila 3: Gastos & Rentabilidad */}
          {/* Expenses */}
          <div className={`${styles.kpiCard} ${styles.kpiCardClickable}`} onClick={() => openKpiDetail('totalExpenses', selectedExpenseLabel)}>
            <div className={styles.kpiIconWrap} style={{ color: '#EF4444' }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M5 4h12a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5"/><path d="M7 8h8M7 11h6M7 14h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
            <span className={styles.kpiLabel}>{selectedExpenseLabel}</span>
            <div className={styles.kpiRow}>
              <span className={styles.kpiValueAnimated}>{expensesDisplay}</span>
              {kpis.totalExpenses && renderChange(kpis.totalExpenses.value, kpis.totalExpenses.previous, true)}
            </div>
          </div>

          {/* Lab Expenses */}
          <div className={`${styles.kpiCard} ${styles.kpiCardClickable}`} onClick={() => openKpiDetail('labExpenses', 'Gastos Laboratorio')}>
            <div className={styles.kpiIconWrap} style={{ color: '#3B82F6' }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="4" y="5" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M7 9h8M7 12h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
            <span className={styles.kpiLabel}>Gastos Laboratorio</span>
            <div className={styles.kpiRow}>
              <span className={styles.kpiValueAnimated}>{labExpensesDisplay}</span>
              {kpis.labExpenses && renderChange(kpis.labExpenses.value, kpis.labExpenses.previous, true)}
            </div>
            {renderSparkline(kpis.labExpenses?.sparkline, '#3B82F6')}
          </div>

          {/* Personal Expenses */}
          <div className={`${styles.kpiCard} ${styles.kpiCardClickable}`} onClick={() => openKpiDetail('personalExpenses', 'Gastos Personales')}>
            <div className={styles.kpiIconWrap} style={{ color: '#EC4899' }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M11 18s-5-3.35-7-6.29C2.42 9.3 3.2 6 6.48 6c1.74 0 2.86.92 3.52 2 .66-1.08 1.78-2 3.52-2C16.8 6 17.58 9.3 18 11.71 16 14.65 11 18 11 18z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <span className={styles.kpiLabel}>Gastos Personales</span>
            <div className={styles.kpiRow}>
              <span className={styles.kpiValueAnimated}>{personalExpensesDisplay}</span>
              {kpis.personalExpenses && renderChange(kpis.personalExpenses.value, kpis.personalExpenses.previous, true)}
            </div>
            {renderSparkline(kpis.personalExpenses?.sparkline, '#EC4899')}
          </div>

          {/* Net Margin */}
          <div className={`${styles.kpiCard} ${styles.kpiCardClickable}`} onClick={() => openKpiDetail('netMargin', 'Margen Neto')}>
            <div className={styles.kpiIconWrap} style={{ color: (kpis.netMargin?.value ?? 0) >= 0 ? '#10B981' : '#EF4444' }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M3 17l4-4 3 3 5-5 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M15 7h4v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <span className={styles.kpiLabel}>Margen Neto</span>
            <div className={styles.kpiRow}>
              <span className={styles.kpiValueAnimated}>{marginDisplay}</span>
              {kpis.netMargin && renderChange(kpis.netMargin.value, kpis.netMargin.previous)}
            </div>
          </div>

          {/* Fila 4: Gastos Recurrentes & Eficiencia (Nueva Fila) */}
          {/* Gasto Recurrente Mensual (Prorrateado) */}
          <div className={`${styles.kpiCard} ${styles.kpiCardClickable}`} onClick={() => openKpiDetail('monthlyRecurringExpense', 'Gasto Recurrente Mensual')}>
            <div className={styles.kpiIconWrap} style={{ color: '#8B5CF6' }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <span className={styles.kpiLabel}>Gasto Recurrente Mensual</span>
            <div className={styles.kpiRow}>
              <span className={styles.kpiValueAnimated}>{monthlyRecurringDisplay}</span>
            </div>
          </div>

          {/* Ratio Gastos / Ingresos */}
          <div className={`${styles.kpiCard} ${styles.kpiCardClickable}`} onClick={() => openKpiDetail('expenseRatio', 'Ratio Gastos / Ingresos')}>
            <div className={styles.kpiIconWrap} style={{ color: '#EF4444' }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M7 17L17 7M9 7h8v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <span className={styles.kpiLabel}>Ratio Gastos / Ingresos</span>
            <div className={styles.kpiRow}>
              <span className={styles.kpiValueAnimated}>{expenseRatioDisplay}%</span>
              {kpis.expenseRatio && renderChange(kpis.expenseRatio.value, kpis.expenseRatio.previous, true)}
            </div>
          </div>

          {/* Active Clients */}
          <div className={`${styles.kpiCard} ${styles.kpiCardClickable}`} onClick={() => openKpiDetail('activeClients', 'Clientes Activos')}>
            <div className={styles.kpiIconWrap} style={{ color: '#14B8A6' }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5"/><path d="M4.5 19c0-3.59 2.91-6.5 6.5-6.5s6.5 2.91 6.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
            <span className={styles.kpiLabel}>Clientes Activos</span>
            <div className={styles.kpiRow}>
              <span className={styles.kpiValueAnimated}>{activeClientsDisplay}</span>
            </div>
          </div>

          {/* Promedio Gasto Diario */}
          <div className={`${styles.kpiCard} ${styles.kpiCardClickable}`} onClick={() => openKpiDetail('totalExpenses', 'Gasto Diario Promedio')}>
            <div className={styles.kpiIconWrap} style={{ color: '#F97316' }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="4" y="5" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M7 9h8M7 12h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
            <span className={styles.kpiLabel}>Gasto Diario Promedio</span>
            <div className={styles.kpiRow}>
              <span className={styles.kpiValueAnimated}>{avgDailyExpenseDisplay}</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Charts Grid */}
      <div className={styles.chartGrid}>
        {/* Row 1 (Full): Revenue: Invoiced vs Collected */}
        <div className={`${styles.chartCard} ${styles.chartFull}`}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>Facturación vs Cobranza</h3>
          </div>
          <div className={styles.chartContainer}>
            {revenue.length === 0 ? (
              <div className={styles.emptyChart}>
                <span className={styles.emptyIcon}>
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><rect x="4" y="8" width="7" height="16" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="13" y="12" width="7" height="12" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="22" y="6" width="7" height="18" rx="1" stroke="currentColor" strokeWidth="1.5"/></svg>
                </span>
                <span>Sin datos en el periodo</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={revenue} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorInvoiced" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#2563EB" stopOpacity={0.8}/>
                    </linearGradient>
                    <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#059669" stopOpacity={0.8}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v}`} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: unknown, name: unknown) => [
                      formatCurrency(Number(value)),
                      String(name) === 'invoiced' ? 'Facturado' : 'Cobrado'
                    ]}
                  />
                  <Bar dataKey="invoiced" name="invoiced" fill="url(#colorInvoiced)" radius={[6, 6, 0, 0]} barSize={20} />
                  <Bar dataKey="collected" name="collected" fill="url(#colorCollected)" radius={[6, 6, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className={styles.chartLegend}>
            <span className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: '#3B82F6' }} /> Facturado
            </span>
            <span className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: '#10B981' }} /> Cobrado
            </span>
          </div>
        </div>

        {/* Row 2 (Pair Col 1): Facturación vs Gastos */}
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>Facturación vs {selectedExpenseLabel}</h3>
          </div>
          <div className={styles.chartContainer}>
            {invoiceVsExpenses.length === 0 ? (
              <div className={styles.emptyChart}>
                <span className={styles.emptyIcon}>
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><rect x="4" y="8" width="24" height="18" rx="3" stroke="currentColor" strokeWidth="1.5"/><path d="M4 14h24" stroke="currentColor" strokeWidth="1.5"/><path d="M10 20h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </span>
                <span>Sin datos en el periodo</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <ComposedChart data={invoiceVsExpenses} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v}`} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: unknown, name: unknown) => [
                      formatCurrency(Number(value)),
                      String(name) === 'invoiced'
                        ? 'Facturado'
                        : String(name) === 'expenses'
                          ? selectedExpenseLabel
                          : 'Margen'
                    ]}
                  />
                  <Bar dataKey="invoiced" name="invoiced" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={18} />
                  <Bar dataKey="expenses" name="expenses" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={18} />
                  <Line type="monotone" dataKey="margin" name="margin" stroke="#10B981" strokeWidth={2} dot={{ r: 3, fill: '#10B981', stroke: '#fff', strokeWidth: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className={styles.chartLegend}>
            <span className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: '#3B82F6' }} /> Facturado
            </span>
            <span className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: '#EF4444' }} /> {selectedExpenseLabel}
            </span>
            <span className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: '#10B981' }} /> Margen
            </span>
          </div>
        </div>

        {/* Row 2 (Pair Col 2): Gastos Personales vs Laboratorio */}
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>Gastos Personales vs Laboratorio</h3>
          </div>
          <div className={styles.chartContainer}>
            {invoiceVsExpenses.length === 0 ? (
              <div className={styles.emptyChart}>
                <span className={styles.emptyIcon}>
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M6 24l6-8 5 4 9-12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="6" cy="24" r="2" fill="currentColor"/><circle cx="12" cy="16" r="2" fill="currentColor"/><circle cx="17" cy="20" r="2" fill="currentColor"/><circle cx="26" cy="8" r="2" fill="currentColor"/></svg>
                </span>
                <span>Sin datos en el periodo</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <LineChart data={invoiceVsExpenses} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v}`} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: unknown, name: unknown) => [
                      formatCurrency(Number(value)),
                      String(name) === 'labExpenses' ? 'Laboratorio' : 'Personal'
                    ]}
                  />
                  <Line type="monotone" dataKey="labExpenses" name="labExpenses" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3, fill: '#3B82F6' }} />
                  <Line type="monotone" dataKey="personalExpenses" name="personalExpenses" stroke="#EC4899" strokeWidth={2} dot={{ r: 3, fill: '#EC4899' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className={styles.chartLegend}>
            <span className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: '#3B82F6' }} /> Laboratorio
            </span>
            <span className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: '#EC4899' }} /> Personal
            </span>
          </div>
        </div>

        {/* Row 3 (Col 1): Gastos de Laboratorio (Donut Card Separada) */}
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>Gastos de Laboratorio</h3>
            <span style={{ color: '#3B82F6', fontWeight: 600, fontSize: '13px' }}>
              {formatCurrency(expenseLabTotal)}
            </span>
          </div>
          <div className={styles.chartContainer} style={{ position: 'relative' }}>
            {expenseLabData.length === 0 ? (
              <div className={styles.emptyChart}>
                <span>Sin gastos de laboratorio</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    data={expenseLabData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                  >
                    {expenseLabData.map((item, idx) => (
                      <Cell key={idx} fill={item.color || DONUT_COLORS[idx % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: unknown) => [formatCurrency(Number(value)), 'Monto']}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          {expenseLabData.length > 0 && (
            <div className={styles.chartLegend} style={{ flexWrap: 'wrap', gap: '8px 12px', marginTop: '12px' }}>
              {expenseLabData.map((item, idx) => (
                <span key={idx} className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ background: item.color || DONUT_COLORS[idx % DONUT_COLORS.length] }} />
                  {item.name}: {formatCurrency(item.value)} ({item.percentage}%)
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Row 3 (Col 2): Gastos Personales (Donut Card Separada) */}
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>Gastos Personales</h3>
            <span style={{ color: '#EC4899', fontWeight: 600, fontSize: '13px' }}>
              {formatCurrency(expensePersonalTotal)}
            </span>
          </div>
          <div className={styles.chartContainer} style={{ position: 'relative' }}>
            {expensePersonalData.length === 0 ? (
              <div className={styles.emptyChart}>
                <span>Sin gastos personales</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    data={expensePersonalData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                  >
                    {expensePersonalData.map((item, idx) => (
                      <Cell key={idx} fill={item.color || DONUT_COLORS[idx % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: unknown) => [formatCurrency(Number(value)), 'Monto']}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          {expensePersonalData.length > 0 && (
            <div className={styles.chartLegend} style={{ flexWrap: 'wrap', gap: '8px 12px', marginTop: '12px' }}>
              {expensePersonalData.map((item, idx) => (
                <span key={idx} className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ background: item.color || DONUT_COLORS[idx % DONUT_COLORS.length] }} />
                  {item.name}: {formatCurrency(item.value)} ({item.percentage}%)
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Row 4 (Pair Col 1): Production Distribution (Donut) */}
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>Distribución por Flujo</h3>
          </div>
          <div className={styles.chartContainer} style={{ position: 'relative' }}>
            {production.length === 0 ? (
              <div className={styles.emptyChart}>
                <span className={styles.emptyIcon}>
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="10" stroke="currentColor" strokeWidth="1.5"/><path d="M16 6a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>
                </span>
                <span>Sin datos en el periodo</span>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Pie
                      data={production}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                      nameKey="name"
                    >
                      {production.map((_, idx) => (
                        <Cell key={idx} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value: unknown) => [`${Number(value)} pedidos`, 'Cantidad']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className={styles.donutCenter} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}>
                  <span className={styles.donutCenterValue}>
                    {production.reduce((acc, curr) => acc + curr.value, 0)}
                  </span>
                  <span className={styles.donutCenterLabel}>Pedidos</span>
                </div>
              </>
            )}
          </div>
          {production.length > 0 && (
            <div className={styles.chartLegend} style={{ flexWrap: 'wrap', gap: '8px 12px' }}>
              {production.map((item, idx) => (
                <span key={idx} className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ background: DONUT_COLORS[idx % DONUT_COLORS.length] }} />
                  {item.name}: {item.value}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Row 4 (Pair Col 2): Métodos de Cobro (Payment Methods Donut) */}
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>Métodos de Cobro</h3>
          </div>
          <div className={styles.chartContainer} style={{ position: 'relative' }}>
            {paymentMethods.length === 0 ? (
              <div className={styles.emptyChart}>
                <span className={styles.emptyIcon}>
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><rect x="4" y="8" width="24" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M4 14h24" stroke="currentColor" strokeWidth="1.5"/></svg>
                </span>
                <span>Sin cobros en el periodo</span>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Pie
                      data={paymentMethods}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                      nameKey="name"
                    >
                      {paymentMethods.map((item, idx) => (
                        <Cell key={idx} fill={item.color || DONUT_COLORS[idx % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value: unknown) => [formatCurrency(Number(value)), 'Monto Cobrado']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className={styles.donutCenter} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}>
                  <span className={styles.donutCenterValue}>{formatCurrency(paymentMethodsTotal)}</span>
                  <span className={styles.donutCenterLabel}>Total Cobrado</span>
                </div>
              </>
            )}
          </div>
          {paymentMethods.length > 0 && (
            <div className={styles.chartLegend} style={{ flexWrap: 'wrap', gap: '8px 12px' }}>
              {paymentMethods.map((item, idx) => (
                <span key={idx} className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ background: item.color || DONUT_COLORS[idx % DONUT_COLORS.length] }} />
                  {item.name}: {formatCurrency(item.value)} ({item.percentage}%)
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Row 5 (Pair Col 1): Top 5 Productos / Trabajos */}
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>Top 5 Productos más Solicitados</h3>
          </div>
          <div className={styles.chartContainer}>
            {topProducts.length === 0 ? (
              <div className={styles.emptyChart}>
                <span className={styles.emptyIcon}>
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M4 8h24M4 16h24M4 24h24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </span>
                <span>Sin datos en el periodo</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart
                  data={topProducts}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `$${v}`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#4B5563' }}
                    width={110}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: unknown, _: unknown, entry: { payload?: TopProduct }) => [
                      `${formatCurrency(Number(value))} (${entry.payload?.orders || 0} pedidos)`,
                      'Total Facturado'
                    ]}
                  />
                  <Bar dataKey="total" fill="#8B5CF6" radius={[0, 6, 6, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Row 5 (Pair Col 2): Top 5 Clientes */}
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>Top 5 Clientes (Facturación)</h3>
          </div>
          <div className={styles.chartContainer}>
            {topClients.length === 0 ? (
              <div className={styles.emptyChart}>
                <span className={styles.emptyIcon}>
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="12" cy="10" r="4" stroke="currentColor" strokeWidth="1.5"/><path d="M4 26c0-4.42 3.58-8 8-8s8 3.58 8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="22" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M22 18c3.31 0 6 2.69 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </span>
                <span>Sin datos en el periodo</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart
                  data={topClients}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `$${v}`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#4B5563' }}
                    width={110}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: unknown, _: unknown, entry: { payload?: TopClient }) => [
                      `${formatCurrency(Number(value))} (${entry.payload?.orders || 0} pedidos)`,
                      'Total Facturado'
                    ]}
                  />
                  <Bar dataKey="total" fill="#F59E0B" radius={[0, 6, 6, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Row 6 (Full): Bottlenecks */}
        <div className={`${styles.chartCard} ${styles.chartFull}`}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>Cuellos de Botella</h3>
            <select
              className={styles.chartSelect}
              value={selectedWorkflow}
              onChange={(e) => setSelectedWorkflow(e.target.value)}
            >
              <option value="">Todos los flujos</option>
              {workflows.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div className={styles.chartContainer}>
            {bottlenecks.length === 0 ? (
              <div className={styles.emptyChart}>
                <span className={styles.emptyIcon}>
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="10" stroke="currentColor" strokeWidth="1.5"/><path d="M16 10v6l4 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
                <span>Sin datos suficientes para calcular cuellos de botella</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart
                  data={bottlenecks}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v}h`}
                  />
                  <YAxis
                    type="category"
                    dataKey="stepName"
                    tick={{ fontSize: 11, fill: '#4B5563' }}
                    width={130}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: unknown, _: unknown, entry: { payload?: BottleneckItem }) => [
                      `${Number(value)} hrs promedio (${entry.payload?.orderCount || 0} trabajos)`,
                      'Tiempo en paso'
                    ]}
                  />
                  <Bar dataKey="avgHours" fill="#EF4444" radius={[0, 6, 6, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <div className={styles.activityCard}>
        <h3 className={styles.activityTitle}>Actividad Reciente</h3>
        {activity.length === 0 ? (
          <div className={styles.emptyChart}>
            <span className={styles.emptyIcon}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><rect x="5" y="4" width="22" height="24" rx="3" stroke="currentColor" strokeWidth="1.5"/><path d="M10 12h12M10 17h8M10 22h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </span>
            <span>Sin actividad reciente</span>
          </div>
        ) : (
          <div className={styles.activityList}>
            {activity.map((item) => {
              const icon = activityIcons[item.type] || activityIcons.order;
              return (
                <div key={item.id} className={styles.activityItem}>
                  <div className={`${styles.activityIcon} ${icon.cls}`}>
                    {icon.emoji}
                  </div>
                  <div className={styles.activityContent}>
                    <div className={styles.activityDesc}>{item.description}</div>
                    <div className={styles.activityMeta}>
                      {item.actor} · {formatRelativeTime(item.timestamp)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* KPI Detail Modal */}
      <Modal
        isOpen={kpiModalOpen}
        onClose={() => setKpiModalOpen(false)}
        title={kpiModalTitle}
        size="lg"
      >
        {kpiModalLoading ? (
          <div className={styles.loadingSpinner}>
            <div className={styles.spinner} />
          </div>
        ) : kpiModalData ? (
          <div className={styles.kpiModalContent}>
            {/* Orders table (totalInvoiced, newOrders, averageOrderValue) */}
            {kpiModalData.type === 'orders' && (
              <table className={styles.kpiModalTable}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Paciente</th>
                    <th>Cliente</th>
                    <th>Precio</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {kpiModalData.rows.map((r: { id: string; orderNumber: number; patientName: string; clientName: string; finalPriceUsd: number; createdAt: number }) => (
                    <tr key={r.id}>
                      <td>{r.orderNumber}</td>
                      <td>{r.patientName}</td>
                      <td>{r.clientName}</td>
                      <td>{formatCurrency(r.finalPriceUsd)}</td>
                      <td>{formatDate(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Payments table (totalCollected, collectionRate) */}
            {kpiModalData.type === 'payments' && (
              <table className={styles.kpiModalTable}>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Monto</th>
                    <th>Método</th>
                    <th>Referencia</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {kpiModalData.rows.map((r: { id: string; clientName: string; amountUsd: number; paymentMethod: string; reference: string; paymentDate: number }) => (
                    <tr key={r.id}>
                      <td>{r.clientName}</td>
                      <td>{formatCurrency(r.amountUsd)}</td>
                      <td>{r.paymentMethod || '—'}</td>
                      <td>{r.reference || '—'}</td>
                      <td>{formatDate(r.paymentDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Completed Orders table */}
            {kpiModalData.type === 'completedOrders' && (
              <table className={styles.kpiModalTable}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Paciente</th>
                    <th>Cliente</th>
                    <th>Precio</th>
                    <th>Completado</th>
                  </tr>
                </thead>
                <tbody>
                  {kpiModalData.rows.map((r: { id: string; orderNumber: number; patientName: string; clientName: string; finalPriceUsd: number; completedAt: number }) => (
                    <tr key={r.id}>
                      <td>{r.orderNumber}</td>
                      <td>{r.patientName}</td>
                      <td>{r.clientName}</td>
                      <td>{formatCurrency(r.finalPriceUsd)}</td>
                      <td>{formatDate(r.completedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Expenses table */}
            {kpiModalData.type === 'expenses' && (
              <table className={styles.kpiModalTable}>
                <thead>
                  <tr>
                    <th>Descripción</th>
                    <th>Categoría</th>
                    <th>Monto</th>
                    <th>Método</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {kpiModalData.rows.map((r: { id: string; description: string; categoryName: string; amountUsd: number; paymentMethod: string; expenseDate: number; isPersonal: boolean }) => (
                    <tr key={r.id}>
                      <td>{r.description}</td>
                      <td>
                        {r.categoryName || '—'}
                        {r.isPersonal && <span className={styles.kpiModalBadge}>Personal</span>}
                      </td>
                      <td>{formatCurrency(r.amountUsd)}</td>
                      <td>{r.paymentMethod || '—'}</td>
                      <td>{formatDate(r.expenseDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Recurring Expenses table */}
            {kpiModalData.type === 'recurringExpenses' && (
              <table className={styles.kpiModalTable}>
                <thead>
                  <tr>
                    <th>Descripción</th>
                    <th>Categoría</th>
                    <th>Frecuencia</th>
                    <th>Monto Recurrente</th>
                    <th>Prorrateo Mensual</th>
                  </tr>
                </thead>
                <tbody>
                  {kpiModalData.rows.map((r: { id: string; description: string; categoryName: string; amountUsd: number; recurrenceInterval: string; monthlyProrated: number; isPersonal: boolean }) => (
                    <tr key={r.id}>
                      <td>{r.description || 'Sin descripción'}</td>
                      <td>
                        {r.categoryName || '—'}
                        {r.isPersonal && <span className={styles.kpiModalBadge} style={{ marginLeft: 6 }}>Personal</span>}
                      </td>
                      <td>
                        <span className={styles.recurringBadge}>
                          {RECURRENCE_MAP[r.recurrenceInterval || 'monthly'] || r.recurrenceInterval || 'Mensual'}
                        </span>
                      </td>
                      <td>{formatCurrency(r.amountUsd || 0)}</td>
                      <td style={{ fontWeight: 600, color: '#8B5CF6' }}>
                        {formatCurrency(r.monthlyProrated || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Margin breakdown */}
            {(kpiModalData.type === 'margin' || kpiModalData.type === 'expenseRatio') && (
              <div className={styles.kpiModalBreakdown}>
                <div className={styles.kpiModalBreakdownItem}>
                  <span className={styles.kpiModalBreakdownLabel}>Total Facturado</span>
                  <span className={styles.kpiModalBreakdownValue}>{formatCurrency(kpiModalData.rows.invoiced)}</span>
                </div>
                <div className={styles.kpiModalBreakdownItem}>
                  <span className={styles.kpiModalBreakdownLabel}>Total Cobrado</span>
                  <span className={styles.kpiModalBreakdownValue} style={{ color: '#10B981' }}>{formatCurrency(kpiModalData.rows.collected)}</span>
                </div>
                <div className={styles.kpiModalBreakdownDivider} />
                <div className={styles.kpiModalBreakdownItem}>
                  <span className={styles.kpiModalBreakdownLabel}>Gastos Laboratorio</span>
                  <span className={styles.kpiModalBreakdownValue} style={{ color: '#EF4444' }}>−{formatCurrency(kpiModalData.rows.labExpenses)}</span>
                </div>
                <div className={styles.kpiModalBreakdownItem}>
                  <span className={styles.kpiModalBreakdownLabel}>Gastos Personales</span>
                  <span className={styles.kpiModalBreakdownValue} style={{ color: '#EF4444' }}>−{formatCurrency(kpiModalData.rows.personalExpenses)}</span>
                </div>
                <div className={styles.kpiModalBreakdownItem}>
                  <span className={styles.kpiModalBreakdownLabel}>Total Gastos</span>
                  <span className={styles.kpiModalBreakdownValue} style={{ color: '#EF4444' }}>−{formatCurrency(kpiModalData.rows.totalExpenses)}</span>
                </div>
                {kpiModalData.type === 'expenseRatio' && (
                  <div className={styles.kpiModalBreakdownItem}>
                    <span className={styles.kpiModalBreakdownLabel}>Ratio Gastos / Ingresos</span>
                    <span className={styles.kpiModalBreakdownValue} style={{ color: '#EF4444', fontWeight: 600 }}>
                      {kpiModalData.rows.expenseRatio}%
                    </span>
                  </div>
                )}
                <div className={styles.kpiModalBreakdownDivider} />
                <div className={`${styles.kpiModalBreakdownItem} ${styles.kpiModalBreakdownTotal}`}>
                  <span className={styles.kpiModalBreakdownLabel}>Margen Neto</span>
                  <span className={styles.kpiModalBreakdownValue} style={{ color: kpiModalData.rows.margin >= 0 ? '#10B981' : '#EF4444', fontWeight: 700, fontSize: '1.25rem' }}>
                    {formatCurrency(kpiModalData.rows.margin)}
                  </span>
                </div>
              </div>
            )}

            {/* Pending Collection table */}
            {kpiModalData.type === 'pendingCollection' && (
              <table className={styles.kpiModalTable}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Paciente</th>
                    <th>Cliente</th>
                    <th>Total</th>
                    <th>Pagado</th>
                    <th>Saldo Pendiente</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {kpiModalData.rows.map((r: { id: string; orderNumber: number; patientName: string; clientName: string; finalPriceUsd: number; amountPaidUsd: number; pendingBalance: number; createdAt: number }) => (
                    <tr key={r.id}>
                      <td>{r.orderNumber}</td>
                      <td>{r.patientName}</td>
                      <td>{r.clientName}</td>
                      <td>{formatCurrency(r.finalPriceUsd)}</td>
                      <td style={{ color: '#10B981' }}>{formatCurrency(r.amountPaidUsd || 0)}</td>
                      <td style={{ color: '#F59E0B', fontWeight: 600 }}>{formatCurrency(r.pendingBalance || 0)}</td>
                      <td>{formatDate(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Clients list */}
            {kpiModalData.type === 'clients' && (
              <table className={styles.kpiModalTable}>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Clínica</th>
                    <th>Teléfono</th>
                  </tr>
                </thead>
                <tbody>
                  {kpiModalData.rows.map((r: { id: string; name: string; clinicName: string; phone: string }) => (
                    <tr key={r.id}>
                      <td>{r.name}</td>
                      <td>{r.clinicName || '—'}</td>
                      <td>{r.phone || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Active Orders table */}
            {kpiModalData.type === 'activeOrders' && (
              <table className={styles.kpiModalTable}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Paciente</th>
                    <th>Cliente</th>
                    <th>Paso Actual</th>
                    <th>Precio</th>
                    <th>Creado</th>
                  </tr>
                </thead>
                <tbody>
                  {kpiModalData.rows.map((r: { id: string; orderNumber: number; patientName: string; clientName: string; currentStepName: string; finalPriceUsd: number; createdAt: number }) => (
                    <tr key={r.id}>
                      <td>{r.orderNumber}</td>
                      <td>{r.patientName}</td>
                      <td>{r.clientName}</td>
                      <td><span className={styles.kpiModalBadgeStep}>{r.currentStepName}</span></td>
                      <td>{formatCurrency(r.finalPriceUsd)}</td>
                      <td>{formatDate(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Empty state */}
            {kpiModalData.rows && Array.isArray(kpiModalData.rows) && kpiModalData.rows.length === 0 && (
              <div className={styles.emptyChart}>
                <span>Sin datos en el periodo seleccionado</span>
              </div>
            )}
          </div>
        ) : (
          <div className={styles.emptyChart}>
            <span>No se pudieron cargar los datos</span>
          </div>
        )}
      </Modal>
    </div>
  );
}
