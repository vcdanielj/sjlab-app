// ============================================
// SJ Lab — Finances Page
// ============================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { formatCurrency, formatDate } from '@/lib/utils';
import styles from './page.module.css';

interface ClientFinance {
  id: string;
  name: string;
  clinicName: string | null;
  isActive: boolean;
  activeOrders: number;
  totalInvoiced: number;
  totalPaid: number;
  balance: number;
  lastPaymentDate: number | null;
}

interface Summary {
  totalCxC: number;
  totalSurplus: number;
  monthlyCollections: number;
}

// Sort Icon Component
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

export default function FinancesPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const [clients, setClients] = useState<ClientFinance[]>([]);
  const [summary, setSummary] = useState<Summary>({
    totalCxC: 0,
    totalSurplus: 0,
    monthlyCollections: 0,
  });
  const [loading, setLoading] = useState(true);

  // Sort
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Filters
  const [search, setSearch] = useState('');
  const [balanceFilter, setBalanceFilter] = useState('all'); // all, cxc, surplus, zero
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/finances/summary');
      const data = await res.json();
      if (data.data) {
        setSummary(data.data);
      }
    } catch {
      addToast('Error al cargar resumen financiero', 'error');
    }
  }, [addToast]);

  const fetchClients = useCallback(async (
    searchQuery = search,
    status = balanceFilter,
    currentSortBy = sortBy,
    currentSortOrder = sortOrder
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (status !== 'all') params.set('balanceStatus', status);
      params.set('sortBy', currentSortBy);
      params.set('sortOrder', currentSortOrder);

      const res = await fetch(`/api/finances/clients?${params}`);
      const data = await res.json();
      if (data.data) {
        setClients(data.data);
      }
    } catch {
      addToast('Error al cargar saldos de clientes', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast, search, balanceFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchSummary();
    fetchClients(search, balanceFilter);
  }, [fetchSummary, fetchClients]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearchChange(value: string) {
    setSearch(value);
    if (searchTimeout) clearTimeout(searchTimeout);
    const timeout = setTimeout(() => {
      fetchClients(value, balanceFilter);
    }, 400);
    setSearchTimeout(timeout);
  }

  function handleBalanceFilterChange(value: string) {
    setBalanceFilter(value);
    fetchClients(search, value);
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
          <h1 className={styles.title}>Finanzas</h1>
          <p className={styles.subtitle}>Resumen de cuentas por cobrar y saldo a favor de clientes</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Cuentas por Cobrar (CxC)</span>
          <span className={`${styles.kpiValue} ${styles.negative}`}>
            {formatCurrency(summary.totalCxC)}
          </span>
          <span className={styles.kpiSub}>Total adeudado al laboratorio</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total a Favor (Excedentes)</span>
          <span className={`${styles.kpiValue} ${styles.positive}`}>
            {formatCurrency(summary.totalSurplus)}
          </span>
          <span className={styles.kpiSub}>Saldos a favor disponibles</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Cobros del Mes</span>
          <span className={`${styles.kpiValue} ${styles.primary}`}>
            {formatCurrency(summary.monthlyCollections)}
          </span>
          <span className={styles.kpiSub}>Recaudación del mes en curso</span>
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
            placeholder="Buscar por odontólogo, clínica o teléfono..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
        <div className={styles.filterGroup}>
          <select
            className={styles.filterSelect}
            value={balanceFilter}
            onChange={(e) => handleBalanceFilterChange(e.target.value)}
          >
            <option value="all">Todos los Saldos</option>
            <option value="cxc">Con Deuda Pendiente</option>
            <option value="surplus">Con Saldo a Favor</option>
            <option value="zero">Al Día (Sin saldo)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {clients.length === 0 && !loading ? (
        <EmptyState
          title="Sin registros financieros"
          description={search ? 'Intenta con otro término de búsqueda.' : 'No hay información de saldos disponible.'}
        />
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th onClick={() => handleSort('name')} className={styles.sortableHeader}>
                  Cliente / Clínica <SortIcon active={sortBy === 'name'} order={sortOrder} />
                </th>
                <th onClick={() => handleSort('activeOrders')} className={styles.sortableHeader}>
                  Pedidos Activos <SortIcon active={sortBy === 'activeOrders'} order={sortOrder} />
                </th>
                <th onClick={() => handleSort('totalInvoiced')} className={styles.sortableHeader}>
                  Total Facturado <SortIcon active={sortBy === 'totalInvoiced'} order={sortOrder} />
                </th>
                <th onClick={() => handleSort('totalPaid')} className={styles.sortableHeader}>
                  Total Abonado <SortIcon active={sortBy === 'totalPaid'} order={sortOrder} />
                </th>
                <th onClick={() => handleSort('progress')} className={styles.sortableHeader}>
                  Progreso <SortIcon active={sortBy === 'progress'} order={sortOrder} />
                </th>
                <th onClick={() => handleSort('balance')} className={styles.sortableHeader}>
                  Saldo Neto <SortIcon active={sortBy === 'balance'} order={sortOrder} />
                </th>
                <th onClick={() => handleSort('lastPaymentDate')} className={styles.sortableHeader}>
                  Último Pago <SortIcon active={sortBy === 'lastPaymentDate'} order={sortOrder} />
                </th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const paidPct = c.totalInvoiced > 0
                  ? Math.min(100, (c.totalPaid / c.totalInvoiced) * 100)
                  : 0;
                const progressColor = paidPct >= 100
                  ? styles.progressFillFull
                  : paidPct >= 60
                    ? styles.progressFillGreen
                    : paidPct >= 30
                      ? styles.progressFillYellow
                      : styles.progressFillRed;

                return (
                <tr
                  key={c.id}
                  className={`${styles.row} ${!c.isActive ? styles.inactive : ''}`}
                  onClick={() => router.push(`/clients/${c.id}`)}
                >
                  <td>
                    <div className={styles.nameCell}>
                      <span className={styles.clientName}>{c.name}</span>
                      {c.clinicName && (
                        <span className={styles.clinicName}>{c.clinicName}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    {c.activeOrders > 0 ? (
                      <Badge variant="primary" size="sm">{c.activeOrders}</Badge>
                    ) : (
                      <span className={styles.muted}>0</span>
                    )}
                  </td>
                  <td className={styles.number}>{formatCurrency(c.totalInvoiced)}</td>
                  <td className={styles.number}>{formatCurrency(c.totalPaid)}</td>
                  <td>
                    <div className={styles.progressCell}>
                      <div className={styles.progressBar}>
                        <div
                          className={`${styles.progressFill} ${progressColor}`}
                          style={{ width: `${paidPct}%` }}
                        />
                      </div>
                      <span className={styles.progressLabel}>
                        {paidPct.toFixed(0)}% pagado
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`${styles.balance} ${c.balance > 0.005 ? styles.positive : c.balance < -0.005 ? styles.negative : ''}`}>
                      {c.balance > 0.005 && '+'}
                      {formatCurrency(Math.abs(c.balance))}
                      {c.balance > 0.005 && <span className={styles.balanceLabel}> a favor</span>}
                      {c.balance < -0.005 && <span className={styles.balanceLabel}> deuda</span>}
                      {Math.abs(c.balance) <= 0.005 && <span className={styles.balanceLabel}> al día</span>}
                    </span>
                  </td>
                  <td className={styles.date}>
                    {c.lastPaymentDate ? formatDate(c.lastPaymentDate) : '—'}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
