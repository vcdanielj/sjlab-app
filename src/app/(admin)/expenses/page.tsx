// ============================================
// SJ Lab — Expenses Page (Enhanced)
// ============================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { formatCurrency, formatDate, getPeriodRange } from '@/lib/utils';
import { fetchRatesWithCache } from '@/lib/rates-client';
import styles from './page.module.css';

// ---------- Types ----------

interface ExpenseCategory {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
}

interface Expense {
  id: string;
  description: string;
  category: string;
  categoryId: string | null;
  isPersonal: boolean;
  currency: string;
  amountOriginal: number | null;
  exchangeRate: number | null;
  amountUsd: number;
  expenseDate: number;
  notes: string | null;
  isRecurring: boolean;
  recurrenceInterval: string | null;
  recurrenceTemplateId: string | null;
  createdAt: number;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface Summary {
  totalAmountUsd: number;
  averageAmountUsd: number;
  totalPersonalUsd: number;
  totalLabUsd: number;
}

// ---------- Constants ----------

const RECURRENCE_OPTIONS = [
  { key: 'weekly', label: 'Semanal' },
  { key: 'biweekly', label: 'Quincenal' },
  { key: 'monthly', label: 'Mensual' },
  { key: 'quarterly', label: 'Trimestral' },
  { key: 'yearly', label: 'Anual' },
];

const RECURRENCE_MAP: Record<string, string> = {};
RECURRENCE_OPTIONS.forEach((r) => { RECURRENCE_MAP[r.key] = r.label; });

const PERIOD_OPTIONS = [
  { key: 'all_time', label: 'Todo' },
  { key: 'today', label: 'Hoy' },
  { key: 'this_week', label: 'Semana' },
  { key: 'this_month', label: 'Mes' },
  { key: 'last_quarter', label: 'Trimestre' },
  { key: 'this_year', label: 'Año' },
  { key: 'custom', label: 'Personalizado' },
];

function dateInputToTs(value: string, endOfDay = false): number {
  const suffix = endOfDay ? 'T23:59:59-04:00' : 'T00:00:00-04:00';
  return Math.floor(new Date(`${value}${suffix}`).getTime() / 1000);
}

function tsToDateInput(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ---------- Component ---------// Sort Icon Component
function SortIcon({ active, order }: { active: boolean; order: 'asc' | 'desc' }) {
  return (
    <span className={styles.headerSortIcon} style={{
      transform: active && order === 'asc' ? 'rotate(180deg)' : 'none',
      color: active ? 'var(--color-primary)' : 'var(--color-text-tertiary)'
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {active ? (
          <>
            <path d="m19 12-7 7-7-7" />
            <path d="M12 19V5" />
          </>
        ) : (
          <>
            <path d="m7 15 5 5 5-5" />
            <path d="m7 9 5-5 5 5" />
          </>
        )}
      </svg>
    </span>
  );
}

export default function ExpensesPage() {
  const { addToast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [summary, setSummary] = useState<Summary>({
    totalAmountUsd: 0,
    averageAmountUsd: 0,
    totalPersonalUsd: 0,
    totalLabUsd: 0,
  });
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [templates, setTemplates] = useState<Expense[]>([]);

  // Sort
  const [sortBy, setSortBy] = useState('expenseDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filters
  const [period, setPeriod] = useState('all_time');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [recurringFilter, setRecurringFilter] = useState('');
  const [expenseScopeFilter, setExpenseScopeFilter] = useState('all');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formDesc, setFormDesc] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formCurrency, setFormCurrency] = useState('USD');
  const [formAmountOriginal, setFormAmountOriginal] = useState('');
  const [formExchangeRate, setFormExchangeRate] = useState('');
  const [formAmountUsd, setFormAmountUsd] = useState('');
  const [formAppliedExchangeRateType, setFormAppliedExchangeRateType] = useState<'USD_PARALLEL' | 'USD_BCV' | 'EUR_BCV' | 'MANUAL'>('USD_PARALLEL');
  const [dailyRates, setDailyRates] = useState<{ usdParallel: number; usdBcv: number; eurBcv: number } | null>(null);
  const [loadingRates, setLoadingRates] = useState(false);
  const [formDate, setFormDate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formIsPersonal, setFormIsPersonal] = useState<boolean | null>(null);
  const [formIsRecurring, setFormIsRecurring] = useState(false);
  const [formRecurrenceInterval, setFormRecurrenceInterval] = useState('monthly');
  const [saving, setSaving] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  // Confirm delete
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Current page subtotal kept only as supporting context.
  const totalThisPage = expenses.reduce((s, e) => s + e.amountUsd, 0);

  const getRange = useCallback((selectedPeriod = period, fromValue = customFrom, toValue = customTo) => {
    if (selectedPeriod === 'all_time') return null;
    if (selectedPeriod === 'custom') {
      if (!fromValue || !toValue) return null;
      return {
        from: dateInputToTs(fromValue),
        to: dateInputToTs(toValue, true),
      };
    }
    return getPeriodRange(selectedPeriod);
  }, [period, customFrom, customTo]);

  // ---------- Fetch ----------

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/expense-categories');
      const data = await res.json();
      if (data.data) setCategories(data.data.filter((c: ExpenseCategory) => c.isActive));
    } catch { /* silent */ }
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/expenses?templates=true&limit=50');
      const data = await res.json();
      if (data.data) {
        // Deduplicate by description
        const seen = new Set<string>();
        const unique: Expense[] = [];
        for (const t of data.data) {
          if (!seen.has(t.description)) {
            seen.add(t.description);
            unique.push(t);
          }
        }
        setTemplates(unique);
      }
    } catch { /* silent */ }
  }, []);

  const fetchExpenses = useCallback(async (
    page = 1,
    searchQ = search,
    catId = categoryFilter,
    recurring = recurringFilter,
    expenseScope = expenseScopeFilter,
    selectedPeriod = period,
    fromValue = customFrom,
    toValue = customTo,
    currentSortBy = sortBy,
    currentSortOrder = sortOrder
  ) => {
    if (selectedPeriod === 'custom' && (!fromValue || !toValue)) {
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      if (searchQ) params.set('search', searchQ);
      if (catId) params.set('categoryId', catId);
      if (recurring) params.set('isRecurring', recurring);
      if (expenseScope !== 'all') params.set('expenseScope', expenseScope);
      params.set('sortBy', currentSortBy);
      params.set('sortOrder', currentSortOrder);

      const range = getRange(selectedPeriod, fromValue, toValue);
      if (range) {
        params.set('from', String(range.from));
        params.set('to', String(range.to));
      }

      const res = await fetch(`/api/expenses?${params}`);
      const data = await res.json();
      if (data.data) setExpenses(data.data);
      if (data.meta) setMeta(data.meta);
      if (data.summary) setSummary(data.summary);
    } catch {
      addToast('Error al cargar gastos', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast, search, categoryFilter, recurringFilter, expenseScopeFilter, period, customFrom, customTo, getRange, sortBy, sortOrder]);

  useEffect(() => {
    fetchCategories();
    fetchTemplates();
  }, [fetchCategories, fetchTemplates]);

  useEffect(() => {
    if (period === 'custom' && (!customFrom || !customTo)) return;
    fetchExpenses(1, search, categoryFilter, recurringFilter, expenseScopeFilter, period, customFrom, customTo);
  }, [fetchExpenses, period, customFrom, customTo, categoryFilter, recurringFilter, expenseScopeFilter]);

  useEffect(() => {
    if (period === 'custom' && (!customFrom || !customTo)) return;
    const timeout = setTimeout(() => {
      fetchExpenses(1, search, categoryFilter, recurringFilter, expenseScopeFilter, period, customFrom, customTo);
    }, 400);
    return () => clearTimeout(timeout);
  }, [search, fetchExpenses, period, customFrom, customTo, categoryFilter, recurringFilter, expenseScopeFilter]);

  // Helpers
  const getCategoryName = (catId: string | null) => {
    if (!catId) return '—';
    return categories.find((c) => c.id === catId)?.name || '—';
  };

  const getCategoryColor = (catId: string | null) => {
    if (!catId) return '#6B7280';
    return categories.find((c) => c.id === catId)?.color || '#6B7280';
  };

  function handleSearchChange(value: string) {
    setSearch(value);
  }

  function handleCategoryChange(value: string) {
    setCategoryFilter(value);
  }

  function handleRecurringChange(value: string) {
    setRecurringFilter(value);
  }

  function handleExpenseScopeChange(value: string) {
    setExpenseScopeFilter(value);
  }

  function handlePeriodChange(nextPeriod: string) {
    setPeriod(nextPeriod);
    if (nextPeriod === 'custom') {
      const { from, to } = getPeriodRange('this_month');
      setCustomFrom(tsToDateInput(from));
      setCustomTo(tsToDateInput(to));
    }
  }

  // ---------- Currency logic ----------

  // Fetch exchange rates for the selected date
  useEffect(() => {
    if (showModal && formDate) {
      const timer = setTimeout(() => {
        setLoadingRates(true);
        fetchRatesWithCache(formDate)
          .then((rates) => {
            setDailyRates(rates);
          })
          .catch((err) => console.error('Error fetching rates:', err))
          .finally(() => setLoadingRates(false));
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [showModal, formDate]);

  // Update exchange rate value when dailyRates completes loading
  useEffect(() => {
    if (dailyRates) {
      const timer = setTimeout(() => {
        if (formAppliedExchangeRateType === 'USD_PARALLEL') {
          setFormExchangeRate(String(dailyRates.usdParallel));
        } else if (formAppliedExchangeRateType === 'USD_BCV') {
          setFormExchangeRate(String(dailyRates.usdBcv));
        } else if (formAppliedExchangeRateType === 'EUR_BCV') {
          setFormExchangeRate(String(dailyRates.eurBcv));
        } else if (formAppliedExchangeRateType === 'MANUAL') {
          setFormExchangeRate('');
        }
      }, 0);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyRates]);

  useEffect(() => {
    if (formCurrency === 'VES') {
      const rate = parseFloat(formExchangeRate);
      const orig = parseFloat(formAmountOriginal);
      if (rate > 0 && orig > 0) {
        setFormAmountUsd((orig / rate).toFixed(2));
      } else {
        setFormAmountUsd('');
      }
    } else {
      setFormAmountUsd(formAmountOriginal);
    }
  }, [formCurrency, formAmountOriginal, formExchangeRate]);

  // Derived real USD amount for info display
  const getRealUsdValue = () => {
    const orig = parseFloat(formAmountOriginal) || 0;
    if (formCurrency === 'VES') {
      const parallelRate = dailyRates?.usdParallel || 1.0;
      return orig > 0 ? (orig / parallelRate).toFixed(2) : '0.00';
    }
    return orig > 0 ? orig.toFixed(2) : '0.00';
  };
  const formAmountRealUsd = getRealUsdValue();

  // ---------- Modals ----------

  function resetForm() {
    setEditingId(null);
    setFormDesc('');
    setFormCategoryId(categories[0]?.id || '');
    setFormCurrency('USD');
    setFormAmountOriginal('');
    setFormExchangeRate('');
    setFormAmountUsd('');
    setFormAppliedExchangeRateType('USD_PARALLEL');
    setDailyRates(null);
    // Caracas time zone alignment for new entries
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Caracas',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      setFormDate(formatter.format(new Date()));
    } catch {
      setFormDate(new Date().toISOString().slice(0, 10));
    }
    setFormNotes('');
    setFormIsPersonal(null);
    setFormIsRecurring(false);
    setFormRecurrenceInterval('monthly');
    setShowTemplates(false);
  }

  function openCreateModal() {
    resetForm();
    setShowModal(true);
  }

  function openEditModal(exp: Expense) {
    setEditingId(exp.id);
    setFormDesc(exp.description);
    setFormCategoryId(exp.categoryId || '');
    setFormCurrency(exp.currency || 'USD');
    setFormAmountOriginal(exp.amountOriginal ? String(exp.amountOriginal) : '');
    setFormAppliedExchangeRateType((exp as any).appliedExchangeRateType || 'USD_PARALLEL');
    setFormExchangeRate(exp.exchangeRate ? String(exp.exchangeRate) : '');
    setFormAmountUsd(String(exp.amountUsd));
    setFormDate(tsToDateInput(exp.expenseDate));
    setFormNotes(exp.notes || '');
    setFormIsPersonal(exp.isPersonal);
    setFormIsRecurring(exp.isRecurring || false);
    setFormRecurrenceInterval(exp.recurrenceInterval || 'monthly');
    setShowTemplates(false);
    setShowModal(true);
  }

  function applyTemplate(t: Expense) {
    setFormDesc(t.description);
    setFormCategoryId(t.categoryId || '');
    setFormCurrency(t.currency || 'USD');
    setFormAmountOriginal(t.amountOriginal ? String(t.amountOriginal) : '');
    setFormAppliedExchangeRateType((t as any).appliedExchangeRateType || 'USD_PARALLEL');
    setFormExchangeRate(t.exchangeRate ? String(t.exchangeRate) : '');
    setFormAmountUsd(String(t.amountUsd));
    setFormIsPersonal(t.isPersonal);
    setFormIsRecurring(t.isRecurring || false);
    setFormRecurrenceInterval(t.recurrenceInterval || 'monthly');
    setShowTemplates(false);
    addToast(`Plantilla "${t.description}" aplicada`, 'success');
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!formDesc.trim() || !formAmountUsd || !formDate) {
      addToast('Descripción, monto y fecha son requeridos', 'warning');
      return;
    }
    if (formIsPersonal === null) {
      addToast('Debes clasificar el gasto como personal o del laboratorio', 'warning');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        description: formDesc.trim(),
        category: 'otro',
        categoryId: formCategoryId || null,
        currency: formCurrency,
        amountOriginal: parseFloat(formAmountOriginal) || parseFloat(formAmountUsd) || null,
        appliedExchangeRateType: formCurrency === 'VES' ? formAppliedExchangeRateType : null,
        exchangeRate: formCurrency === 'VES' ? parseFloat(formExchangeRate) : null,
        amountUsd: parseFloat(formAmountUsd),
        expenseDate: Math.floor(new Date(formDate + 'T12:00:00').getTime() / 1000),
        notes: formNotes.trim() || undefined,
        isPersonal: formIsPersonal,
        isRecurring: formIsRecurring,
        recurrenceInterval: formIsRecurring ? formRecurrenceInterval : null,
      };

      const url = editingId ? `/api/expenses/${editingId}` : '/api/expenses';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        addToast(editingId ? 'Gasto actualizado' : 'Gasto registrado', 'success');
        setShowModal(false);
        fetchExpenses(meta.page, search, categoryFilter, recurringFilter, expenseScopeFilter, period, customFrom, customTo);
        if (formIsRecurring) fetchTemplates();
      } else {
        const data = await res.json();
        addToast(data.error || 'Error al guardar', 'error');
      }
    } catch {
      addToast('Error de red', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/expenses/${deleteId}`, { method: 'DELETE' });
      if (res.ok) {
        addToast('Gasto eliminado', 'success');
        setDeleteId(null);
        fetchExpenses(meta.page, search, categoryFilter, recurringFilter, expenseScopeFilter, period, customFrom, customTo);
      }
    } catch {
      addToast('Error al eliminar', 'error');
    }
  }

  function handleSort(field: string) {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  }

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Gastos</h1>
          <p className={styles.subtitle}>
            Control de gastos operativos — {meta.total} registro{meta.total !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={openCreateModal}>+ Registrar Gasto</Button>
      </div>

      <div className={styles.periodSection}>
        <div className={styles.periodSelector}>
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`${styles.periodBtn} ${period === option.key ? styles.periodBtnActive : ''}`}
              onClick={() => handlePeriodChange(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className={styles.customDateRange}>
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
      </div>

      {/* KPIs */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total Registrado</span>
          <span className={styles.kpiValue}>{formatCurrency(summary.totalAmountUsd)}</span>
          <span className={styles.kpiSub}>
            {meta.total} gasto{meta.total !== 1 ? 's' : ''} coinciden con los filtros
          </span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Registros Totales</span>
          <span className={styles.kpiValue}>{meta.total}</span>
          <span className={styles.kpiSub}>{expenses.length} gasto{expenses.length !== 1 ? 's' : ''} en esta página</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Promedio por Gasto</span>
          <span className={styles.kpiValue}>
            {meta.total > 0 ? formatCurrency(summary.averageAmountUsd) : '$0.00'}
          </span>
          <span className={styles.kpiSub}>Subtotal visible: {formatCurrency(totalThisPage)}</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Clasificación del Periodo</span>
          <div className={styles.classificationSummary}>
            <div className={styles.classificationRow}>
              <span className={`${styles.scopeBadge} ${styles.scopeBadgeLab}`}>Laboratorio</span>
              <strong className={styles.classificationValue}>{formatCurrency(summary.totalLabUsd)}</strong>
            </div>
            <div className={styles.classificationRow}>
              <span className={`${styles.scopeBadge} ${styles.scopeBadgePersonal}`}>Personal</span>
              <strong className={styles.classificationValue}>{formatCurrency(summary.totalPersonalUsd)}</strong>
            </div>
          </div>
          <span className={styles.kpiSub}>Comparativo según el periodo y filtros aplicados</span>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            className={styles.searchInput}
            placeholder="Buscar por descripción..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        <div className={styles.filterGroup}>
          <select
            className={styles.filterSelect}
            value={period}
            onChange={(e) => handlePeriodChange(e.target.value)}
          >
            {PERIOD_OPTIONS.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>

          <select
            className={styles.filterSelect}
            value={categoryFilter}
            onChange={(e) => handleCategoryChange(e.target.value)}
          >
            <option value="">Todas las Categorías</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            className={styles.filterSelect}
            value={expenseScopeFilter}
            onChange={(e) => handleExpenseScopeChange(e.target.value)}
          >
            <option value="all">Todo Destino</option>
            <option value="lab">Laboratorio</option>
            <option value="personal">Personal</option>
          </select>

          <select
            className={styles.filterSelect}
            value={recurringFilter}
            onChange={(e) => handleRecurringChange(e.target.value)}
          >
            <option value="">Todos los Tipos</option>
            <option value="true">Solo Recurrentes</option>
            <option value="false">Solo Únicos</option>
          </select>
        </div>
      </div>

      {/* Custom Date Range Picker */}
      {period === 'custom' && (
        <div className={styles.customDateRange}>
          <div className={styles.dateField}>
            <label className={styles.dateLabel}>Desde:</label>
            <input
              type="date"
              className={styles.dateInput}
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
          </div>
          <div className={styles.dateField}>
            <label className={styles.dateLabel}>Hasta:</label>
            <input
              type="date"
              className={styles.dateInput}
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Table */}
      {expenses.length === 0 && !loading ? (
        <EmptyState
          title="Sin gastos registrados"
          description={search || categoryFilter ? 'Intenta con otros filtros.' : 'Registra tu primer gasto para comenzar.'}
          action={!search && !categoryFilter ? <Button onClick={openCreateModal}>Registrar Gasto</Button> : undefined}
        />
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th onClick={() => handleSort('expenseDate')} className={styles.sortableHeader}>
                  Fecha <SortIcon active={sortBy === 'expenseDate'} order={sortOrder} />
                </th>
                <th onClick={() => handleSort('description')} className={styles.sortableHeader}>
                  Descripción <SortIcon active={sortBy === 'description'} order={sortOrder} />
                </th>
                <th onClick={() => handleSort('categoryId')} className={styles.sortableHeader}>
                  Categoría <SortIcon active={sortBy === 'categoryId'} order={sortOrder} />
                </th>
                <th onClick={() => handleSort('isPersonal')} className={styles.sortableHeader}>
                  Clasificación <SortIcon active={sortBy === 'isPersonal'} order={sortOrder} />
                </th>
                <th onClick={() => handleSort('currency')} className={styles.sortableHeader}>
                  Moneda <SortIcon active={sortBy === 'currency'} order={sortOrder} />
                </th>
                <th onClick={() => handleSort('amountUsd')} className={styles.sortableHeader} style={{ textAlign: 'right' }}>
                  Monto <SortIcon active={sortBy === 'amountUsd'} order={sortOrder} />
                </th>
                <th onClick={() => handleSort('isRecurring')} className={styles.sortableHeader}>
                  Tipo <SortIcon active={sortBy === 'isRecurring'} order={sortOrder} />
                </th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp) => (
                <tr key={exp.id} className={styles.row}>
                  <td className={styles.date}>{formatDate(exp.expenseDate)}</td>
                  <td>
                    <span className={styles.descText}>{exp.description}</span>
                    {exp.notes && <span className={styles.notesPreview}>{exp.notes}</span>}
                  </td>
                  <td>
                    <span className={styles.categoryBadge} style={{ background: `${getCategoryColor(exp.categoryId)}18`, color: getCategoryColor(exp.categoryId), borderColor: `${getCategoryColor(exp.categoryId)}40` }}>
                      {getCategoryName(exp.categoryId)}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.scopeBadge} ${exp.isPersonal ? styles.scopeBadgePersonal : styles.scopeBadgeLab}`}>
                      {exp.isPersonal ? 'Personal' : 'Laboratorio'}
                    </span>
                  </td>
                  <td>
                    <span className={styles.currencyTag}>{exp.currency}</span>
                    {exp.currency === 'VES' && exp.exchangeRate && (
                      <span className={styles.rateNote}>@{exp.exchangeRate}</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span className={styles.amount}>{formatCurrency(exp.amountUsd)}</span>
                    {exp.currency === 'VES' && exp.amountOriginal && (
                      <span className={styles.originalAmount}>Bs {exp.amountOriginal.toLocaleString()}</span>
                    )}
                  </td>
                  <td>
                    {exp.isRecurring ? (
                      <span className={styles.recurringBadge}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 6a5 5 0 019.5-1.5M11 6a5 5 0 01-9.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M10 2v3h-3M2 10V7h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        {RECURRENCE_MAP[exp.recurrenceInterval || ''] || 'Recurrente'}
                      </span>
                    ) : (
                      <span className={styles.oneTimeBadge}>Único</span>
                    )}
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button className={styles.actionBtn} onClick={() => openEditModal(exp)} title="Editar">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M8.5 2.5l3 3M2 9l5.5-5.5 3 3L5 12H2V9z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                      <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={() => setDeleteId(exp.id)} title="Eliminar">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 4h9M5 4V2.5a1 1 0 011-1h2a1 1 0 011 1V4M6 6.5v3M8 6.5v3M3.5 4l.5 7.5a1 1 0 001 1h4a1 1 0 001-1L10.5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className={styles.pagination}>
          <Button
            variant="secondary"
            size="sm"
            disabled={meta.page <= 1}
            onClick={() => fetchExpenses(meta.page - 1, search, categoryFilter, recurringFilter, expenseScopeFilter, period, customFrom, customTo)}
          >
            Anterior
          </Button>
          <span className={styles.pageInfo}>Página {meta.page} de {meta.totalPages}</span>
          <Button
            variant="secondary"
            size="sm"
            disabled={meta.page >= meta.totalPages}
            onClick={() => fetchExpenses(meta.page + 1, search, categoryFilter, recurringFilter, expenseScopeFilter, period, customFrom, customTo)}
          >
            Siguiente
          </Button>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <form className={styles.modal} onSubmit={handleSave}>
            <h3 className={styles.modalTitle}>{editingId ? 'Editar Gasto' : 'Registrar Gasto'}</h3>

            {/* Template selector */}
            {!editingId && templates.length > 0 && (
              <div className={styles.templateSection}>
                <button
                  type="button"
                  className={styles.templateToggle}
                  onClick={() => setShowTemplates(!showTemplates)}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 6a5 5 0 019.5-1.5M13 8a5 5 0 01-9.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                  {showTemplates ? 'Ocultar plantillas' : 'Usar gasto recurrente'}
                </button>
                {showTemplates && (
                  <div className={styles.templateList}>
                    {templates.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className={styles.templateItem}
                        onClick={() => applyTemplate(t)}
                      >
                        <span className={styles.templateName}>{t.description}</span>
                        <span className={styles.templateMeta}>
                          {formatCurrency(t.amountUsd)} · {RECURRENCE_MAP[t.recurrenceInterval || ''] || ''}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className={styles.modalFields}>
              <Input label="Descripción *" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Compra de materiales..." autoFocus required />
              <div className={styles.modalRow}>
                <Select label="Categoría" value={formCategoryId} onChange={(e) => setFormCategoryId(e.target.value)}>
                  <option value="">Sin categoría</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
                <Input label="Fecha *" type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} required />
              </div>

              <div className={styles.currencySection}>
                <label className={styles.fieldLabel}>Clasificación *</label>
                <div className={styles.currencyTabs}>
                  <button
                    type="button"
                    className={`${styles.currencyTab} ${formIsPersonal === false ? styles.currencyTabActive : ''}`}
                    onClick={() => setFormIsPersonal(false)}
                  >
                    Laboratorio
                  </button>
                  <button
                    type="button"
                    className={`${styles.currencyTab} ${formIsPersonal === true ? styles.currencyTabActive : ''}`}
                    onClick={() => setFormIsPersonal(true)}
                  >
                    Personal
                  </button>
                </div>
              </div>

              {/* Currency selection */}
              <div className={styles.currencySection}>
                <label className={styles.fieldLabel}>Moneda</label>
                <div className={styles.currencyTabs}>
                  <button type="button" className={`${styles.currencyTab} ${formCurrency === 'USD' ? styles.currencyTabActive : ''}`} onClick={() => setFormCurrency('USD')}>
                    USD ($)
                  </button>
                  <button type="button" className={`${styles.currencyTab} ${formCurrency === 'VES' ? styles.currencyTabActive : ''}`} onClick={() => setFormCurrency('VES')}>
                    VES (Bs)
                  </button>
                </div>
              </div>

              {formCurrency === 'VES' ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <Input label="Monto Bs *" type="number" value={formAmountOriginal} onChange={(e) => setFormAmountOriginal(e.target.value)} placeholder="0.00" min="0" step="0.01" required />
                    
                    <Select
                      label="Tipo de Tasa"
                      value={formAppliedExchangeRateType}
                      onChange={(e) => {
                        const type = e.target.value as 'USD_PARALLEL' | 'USD_BCV' | 'EUR_BCV' | 'MANUAL';
                        setFormAppliedExchangeRateType(type);
                        if (dailyRates) {
                          if (type === 'USD_PARALLEL') setFormExchangeRate(String(dailyRates.usdParallel));
                          else if (type === 'USD_BCV') setFormExchangeRate(String(dailyRates.usdBcv));
                          else if (type === 'EUR_BCV') setFormExchangeRate(String(dailyRates.eurBcv));
                          else if (type === 'MANUAL') setFormExchangeRate('');
                        }
                      }}
                      disabled={loadingRates}
                    >
                      <option value="USD_PARALLEL">USD Parallel {dailyRates?.usdParallel ? `(${dailyRates.usdParallel})` : ''}</option>
                      <option value="USD_BCV">USD BCV {dailyRates?.usdBcv ? `(${dailyRates.usdBcv})` : ''}</option>
                      <option value="EUR_BCV">EUR BCV {dailyRates?.eurBcv ? `(${dailyRates.eurBcv})` : ''}</option>
                      <option value="MANUAL">Manual</option>
                    </Select>

                    <Input
                      label="Tasa ÷"
                      type="number"
                      value={formExchangeRate}
                      onChange={(e) => {
                        if (formAppliedExchangeRateType === 'MANUAL') {
                          setFormExchangeRate(e.target.value);
                        }
                      }}
                      placeholder="Bs/USD"
                      min="0"
                      step="0.01"
                      disabled={formAppliedExchangeRateType !== 'MANUAL' || loadingRates}
                      required
                    />
                  </div>
                </>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <Input label="Monto USD *" type="number" value={formAmountOriginal} onChange={(e) => {
                    setFormAmountOriginal(e.target.value);
                    setFormAmountUsd(e.target.value);
                  }} placeholder="0.00" min="0" step="0.01" required />
                  <div className={styles.usdReadOnlyCard} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#F9FAFB', padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #E5E7EB' }}>
                    <span style={{ fontSize: '0.8rem', color: '#6B7280' }}>Monto Nominado (USD)</span>
                    <strong style={{ fontSize: '1.1rem', color: '#374151' }}>{formAmountOriginal ? formatCurrency(parseFloat(formAmountOriginal)) : '$0.00'}</strong>
                  </div>
                </div>
              )}

              {/* Dual Math Info Card */}
              {formAmountOriginal && parseFloat(formAmountOriginal) > 0 && (
                <div style={{ background: '#F0F9FF', border: '1px solid #B9E6FE', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <span style={{ fontSize: '0.85rem', color: '#0369A1', display: 'block', marginBottom: '0.25rem' }}>Gasto Nominal</span>
                      <strong style={{ fontSize: '1.2rem', color: '#0284C7' }}>{formatCurrency(parseFloat(formAmountUsd || '0'))} USD</strong>
                      <span style={{ fontSize: '0.75rem', color: '#0284C7', display: 'block', marginTop: '0.25rem' }}>
                        {formCurrency === 'VES' 
                          ? `Convertido a tasa ${formAppliedExchangeRateType} (${parseFloat(formExchangeRate || '1').toFixed(2)} Bs./$)`
                          : 'Pago directo en dólares'
                        }
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.85rem', color: '#047857', display: 'block', marginBottom: '0.25rem' }}>Gasto Real (Consolidado)</span>
                      <strong style={{ fontSize: '1.2rem', color: '#059669' }}>{formatCurrency(parseFloat(formAmountRealUsd))} USD</strong>
                      <span style={{ fontSize: '0.75rem', color: '#059669', display: 'block', marginTop: '0.25rem' }}>
                        {formCurrency === 'VES' 
                          ? `Convertido a tasa Paralela (${dailyRates?.usdParallel || '—'} Bs./$)`
                          : 'Pago directo en dólares'
                        }
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <Input label="Notas" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Opcional..." />

              {/* Recurring toggle */}
              <div className={styles.recurringSection}>
                <label className={styles.checkboxLabel}>
                  <input type="checkbox" checked={formIsRecurring} onChange={(e) => setFormIsRecurring(e.target.checked)} className={styles.checkbox} />
                  <span>Gasto recurrente</span>
                </label>
                {formIsRecurring && (
                  <Select label="Frecuencia" value={formRecurrenceInterval} onChange={(e) => setFormRecurrenceInterval(e.target.value)}>
                    {RECURRENCE_OPTIONS.map((r) => (
                      <option key={r.key} value={r.key}>{r.label}</option>
                    ))}
                  </Select>
                )}
              </div>
            </div>
            <div className={styles.modalActions}>
              <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button type="submit" loading={saving}>{editingId ? 'Guardar Cambios' : 'Registrar'}</Button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <ConfirmDialog
          isOpen={true}
          title="Eliminar Gasto"
          message="¿Estás seguro de que deseas eliminar este gasto? Esta acción no se puede deshacer."
          confirmLabel="Eliminar"
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
