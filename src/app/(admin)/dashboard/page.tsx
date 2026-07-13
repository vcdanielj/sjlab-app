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
import { formatCurrency, formatRelativeTime, getPeriodRange, percentageChange } from '@/lib/utils';
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

interface TopClient {
  name: string;
  total: number;
  orders: number;
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
  const [topClients, setTopClients] = useState<TopClient[]>([]);
  const [bottlenecks, setBottlenecks] = useState<BottleneckItem[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState('');
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

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
      const [kpiRes, revRes, prodRes, iveRes, topRes, actRes] = await Promise.all([
        fetch(`/api/dashboard/kpis?${expenseQs}`),
        fetch(`/api/dashboard/revenue?${qs}`),
        fetch(`/api/dashboard/production?${qs}`),
        fetch(`/api/dashboard/invoice-vs-expenses?${expenseQs}`),
        fetch(`/api/dashboard/top-clients?${qs}`),
        fetch('/api/dashboard/activity'),
      ]);

      const [kpiData, revData, prodData, iveData, topData, actData] = await Promise.all([
        kpiRes.json(),
        revRes.json(),
        prodRes.json(),
        iveRes.json(),
        topRes.json(),
        actRes.json(),
      ]);

      if (kpiData.data) setKpis(kpiData.data);
      if (revData.data) setRevenue(revData.data);
      if (prodData.data) setProduction(prodData.data);
      if (iveData.data) setInvoiceVsExpenses(iveData.data);
      if (topData.data) setTopClients(topData.data);
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
          <div className={styles.selectorBlock}>
            <span className={styles.selectorLabel}>Clasificacion de gastos</span>
            <div className={styles.periodSelector}>
              {EXPENSE_SCOPE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  className={`${styles.periodBtn} ${expenseScope === opt.key ? styles.periodBtnActive : ''}`}
                  onClick={() => setExpenseScope(opt.key)}
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
          {/* Total Invoiced */}
          <div className={styles.kpiCard}>
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
          <div className={styles.kpiCard}>
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

          {/* New Orders */}
          <div className={styles.kpiCard}>
            <div className={styles.kpiIconWrap} style={{ color: '#6366F1' }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M4 5h14M4 9h14M4 13h10M4 17h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
            <span className={styles.kpiLabel}>Pedidos Nuevos</span>
            <div className={styles.kpiRow}>
              <span className={styles.kpiValueAnimated}>{newOrdersDisplay}</span>
              {renderChange(kpis.newOrders.value, kpis.newOrders.previous)}
            </div>
          </div>

          {/* Completed Orders */}
          <div className={styles.kpiCard}>
            <div className={styles.kpiIconWrap} style={{ color: '#8B5CF6' }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5"/><path d="M8 11l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <span className={styles.kpiLabel}>Completados</span>
            <div className={styles.kpiRow}>
              <span className={styles.kpiValueAnimated}>{completedDisplay2}</span>
              {renderChange(kpis.completedOrders.value, kpis.completedOrders.previous)}
            </div>
          </div>

          {/* Expenses */}
          <div className={styles.kpiCard}>
            <div className={styles.kpiIconWrap} style={{ color: '#EF4444' }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M5 4h12a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5"/><path d="M7 8h8M7 11h6M7 14h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
            <span className={styles.kpiLabel}>{selectedExpenseLabel}</span>
            <div className={styles.kpiRow}>
              <span className={styles.kpiValueAnimated}>{expensesDisplay}</span>
              {kpis.totalExpenses && renderChange(kpis.totalExpenses.value, kpis.totalExpenses.previous, true)}
            </div>
          </div>

          <div className={styles.kpiCard}>
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

          <div className={styles.kpiCard}>
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
          <div className={styles.kpiCard}>
            <div className={styles.kpiIconWrap} style={{ color: (kpis.netMargin?.value ?? 0) >= 0 ? '#10B981' : '#EF4444' }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M3 17l4-4 3 3 5-5 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M15 7h4v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <span className={styles.kpiLabel}>Margen Neto</span>
            <div className={styles.kpiRow}>
              <span className={styles.kpiValueAnimated}>{marginDisplay}</span>
              {kpis.netMargin && renderChange(kpis.netMargin.value, kpis.netMargin.previous)}
            </div>
          </div>

          {/* Collection Rate */}
          <div className={styles.kpiCard}>
            <div className={styles.kpiIconWrap} style={{ color: '#F59E0B' }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5"/><path d="M11 7v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M8 10l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <span className={styles.kpiLabel}>Tasa de Cobranza</span>
            <div className={styles.kpiRow}>
              <span className={styles.kpiValueAnimated}>{collectionRateDisplay}%</span>
              {kpis.collectionRate && renderChange(kpis.collectionRate.value, kpis.collectionRate.previous)}
            </div>
          </div>

          {/* Active Clients */}
          <div className={styles.kpiCard}>
            <div className={styles.kpiIconWrap} style={{ color: '#14B8A6' }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5"/><path d="M4.5 19c0-3.59 2.91-6.5 6.5-6.5s6.5 2.91 6.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
            <span className={styles.kpiLabel}>Clientes Activos</span>
            <div className={styles.kpiRow}>
              <span className={styles.kpiValueAnimated}>{activeClientsDisplay}</span>
            </div>
          </div>

          {/* Average Order Value */}
          <div className={styles.kpiCard}>
            <div className={styles.kpiIconWrap} style={{ color: '#8B5CF6' }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M3 11h6l2 5 3-10 2 5h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <span className={styles.kpiLabel}>Ticket Promedio</span>
            <div className={styles.kpiRow}>
              <span className={styles.kpiValueAnimated}>{averageOrderDisplay}</span>
              {kpis.averageOrderValue && renderChange(kpis.averageOrderValue.value, kpis.averageOrderValue.previous)}
            </div>
          </div>

          {/* Active Orders (In Progress) */}
          <div className={styles.kpiCard}>
            <div className={styles.kpiIconWrap} style={{ color: '#EC4899' }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <span className={styles.kpiLabel}>Órdenes en Proceso</span>
            <div className={styles.kpiRow}>
              <span className={styles.kpiValueAnimated}>{activeOrdersDisplay}</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Charts Row 1 */}
      <div className={styles.chartGrid}>
        {/* Revenue: Invoiced vs Collected */}
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
                  <Bar dataKey="invoiced" name="invoiced" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="collected" name="collected" fill="#10B981" radius={[4, 4, 0, 0]} barSize={20} />
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

        {/* Production Distribution (Donut) */}
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>Distribución por Flujo</h3>
          </div>
          <div className={styles.chartContainer}>
            {production.length === 0 ? (
              <div className={styles.emptyChart}>
                <span className={styles.emptyIcon}>
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="10" stroke="currentColor" strokeWidth="1.5"/><path d="M16 6a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>
                </span>
                <span>Sin datos en el periodo</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    data={production}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                    label={(props: PieLabelRenderProps) =>
                      `${String(props.name || '')} (${((Number(props.percent) || 0) * 100).toFixed(0)}%)`
                    }
                    labelLine={false}
                  >
                    {production.map((_, idx) => (
                      <Cell key={idx} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: unknown) => [Number(value), 'Pedidos']}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Facturación vs Gastos (Bar + Line) */}
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

        {/* Top 5 Clients (Horizontal Bar) */}
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>Top 5 Clientes</h3>
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
                    tick={{ fontSize: 11, fill: '#6B7280' }}
                    width={100}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: unknown) => [formatCurrency(Number(value)), 'Facturado']}
                  />
                  <Bar dataKey="total" fill="#F59E0B" radius={[0, 4, 4, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Bottlenecks (Horizontal Bar) */}
        <div className={styles.chartCard}>
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
                <span>Sin datos de transiciones</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart
                  data={bottlenecks.filter((b) => b.avgHours > 0)}
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
                    tick={{ fontSize: 11, fill: '#6B7280' }}
                    width={100}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: unknown) => [`${Number(value)} horas`, 'Tiempo promedio']}
                  />
                  <Bar dataKey="avgHours" fill="#EF4444" radius={[0, 4, 4, 0]} barSize={18} />
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
    </div>
  );
}
