'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { formatCurrency, formatDate } from '@/lib/utils';
import styles from './page.module.css';

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  clinicName: string | null;
  isActive: boolean;
  orderCount: number;
  totalInvoiced: number;
  totalPaid: number;
  balance: number;
  lastOrderAt: number | null;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
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

export default function ClientsPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [loading, setLoading] = useState(true);

  // Filters — default 'active' to hide inactive clients
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Sort
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const fetchClients = useCallback(async (
    page = 1,
    searchQuery = search,
    status = statusFilter,
    currentSortBy = sortBy,
    currentSortOrder = sortOrder
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      if (searchQuery) params.set('search', searchQuery);
      if (status !== 'all') params.set('status', status);
      params.set('sortBy', currentSortBy);
      params.set('sortOrder', currentSortOrder);

      const res = await fetch(`/api/clients?${params}`);
      const data = await res.json();
      if (data.data) setClients(data.data);
      if (data.meta) setMeta(data.meta);
    } catch {
      addToast('Error al cargar clientes', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast, search, statusFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchClients(1, search, statusFilter);
  }, [fetchClients]);

  function handleSearchChange(value: string) {
    setSearch(value);
    if (searchTimeout) clearTimeout(searchTimeout);
    const timeout = setTimeout(() => {
      fetchClients(1, value, statusFilter);
    }, 400);
    setSearchTimeout(timeout);
  }

  function handleStatusChange(value: string) {
    setStatusFilter(value);
    fetchClients(1, search, value);
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
          <h1 className={styles.title}>Clientes</h1>
          <p className={styles.subtitle}>
            Directorio de odontólogos — {meta.total} cliente{meta.total !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => router.push('/clients/new')}>+ Nuevo Cliente</Button>
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
            placeholder="Buscar por nombre, clínica o email..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
        <div className={styles.filterGroup}>
          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
          >
            <option value="active">Solo activos</option>
            <option value="inactive">Solo inactivos</option>
            <option value="all">Todos</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {clients.length === 0 && !loading ? (
        <EmptyState
          title="No se encontraron clientes"
          description={search ? 'Intenta con otro término de búsqueda.' : 'Crea tu primer cliente para comenzar.'}
          action={!search ? <Button onClick={() => router.push('/clients/new')}>Crear Cliente</Button> : undefined}
        />
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th onClick={() => handleSort('name')} className={styles.sortableHeader}>
                  Nombre / Clínica <SortIcon active={sortBy === 'name'} order={sortOrder} />
                </th>
                <th onClick={() => handleSort('phone')} className={styles.sortableHeader}>
                  Teléfono <SortIcon active={sortBy === 'phone'} order={sortOrder} />
                </th>
                <th onClick={() => handleSort('orderCount')} className={styles.sortableHeader}>
                  Pedidos <SortIcon active={sortBy === 'orderCount'} order={sortOrder} />
                </th>
                <th onClick={() => handleSort('balance')} className={styles.sortableHeader}>
                  Saldo <SortIcon active={sortBy === 'balance'} order={sortOrder} />
                </th>
                <th onClick={() => handleSort('lastOrderAt')} className={styles.sortableHeader}>
                  Último Pedido <SortIcon active={sortBy === 'lastOrderAt'} order={sortOrder} />
                </th>
                <th onClick={() => handleSort('isActive')} className={styles.sortableHeader}>
                  Estado <SortIcon active={sortBy === 'isActive'} order={sortOrder} />
                </th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr
                  key={c.id}
                  className={`${styles.row} ${!c.isActive ? styles.inactive : ''}`}
                  onClick={() => router.push(`/clients/${c.id}`)}
                >
                  <td>
                    <div className={styles.nameCell}>
                      <div
                        className={styles.avatar}
                        style={{
                          background: `hsl(${c.name.charCodeAt(0) * 37 % 360}, 55%, 50%)`,
                        }}
                      >
                        {c.name.charAt(0)}
                      </div>
                      <div className={styles.nameGroup}>
                        <span className={styles.clientName}>{c.name}</span>
                        {c.clinicName && (
                          <span className={styles.clinicName}>{c.clinicName}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className={styles.phone}>{c.phone || '—'}</td>
                  <td>
                    {c.orderCount > 0 ? (
                      <Badge variant="primary" size="sm">{c.orderCount}</Badge>
                    ) : (
                      <span className={styles.muted}>0</span>
                    )}
                  </td>
                  <td>
                    <span className={`${styles.balance} ${c.balance > 0 ? styles.positive : c.balance < 0 ? styles.negative : ''}`}>
                      {formatCurrency(Math.abs(c.balance))}
                      {c.balance > 0 && <span className={styles.balanceLabel}> a favor</span>}
                      {c.balance < 0 && <span className={styles.balanceLabel}> deuda</span>}
                    </span>
                  </td>
                  <td className={styles.date}>
                    {c.lastOrderAt ? formatDate(c.lastOrderAt) : '—'}
                  </td>
                  <td>
                    <Badge variant={c.isActive ? 'success' : 'neutral'} size="sm">
                      {c.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
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
            onClick={() => fetchClients(meta.page - 1, search, statusFilter)}
          >
            Anterior
          </Button>
          <span className={styles.pageInfo}>
            Página {meta.page} de {meta.totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={meta.page >= meta.totalPages}
            onClick={() => fetchClients(meta.page + 1, search, statusFilter)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}
