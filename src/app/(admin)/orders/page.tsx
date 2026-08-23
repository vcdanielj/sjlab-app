// ============================================
// SJ Lab — Orders Page (FIFO Table + Detail Drawer)
// ============================================

'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { PaymentModal } from '@/components/finances/PaymentModal';
import { OrderPrintModal } from '@/components/orders/OrderPrintModal';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';
import { getOrderColorOption, ORDER_COLOR_STANDARDS, ORDER_COLOR_OPTIONS, OrderColorStandard } from '@/lib/order-colors';
import { Input } from '@/components/ui/Input';
import { ClientCombobox } from '@/components/ui/ClientCombobox';
import styles from './page.module.css';

// ---------- Types ----------

interface WorkflowStep {
  id: string;
  workflowId: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

interface Workflow {
  id: string;
  name: string;
  isActive: boolean;
  steps: WorkflowStep[];
}

interface Order {
  id: string;
  orderNumber: number;
  clientId: string;
  patientName: string;
  color?: string | null;
  finalPriceUsd: number;
  amountPaidUsd: number;
  status: string;
  createdAt: number;
  currentStepId: string;
  clientName: string;
  clientClinic: string | null;
  clientPhone: string | null;
  productName: string;
  productSummary?: string;
  categorySummary?: string;
  jobsCount?: number;
  completedJobsCount?: number;
  jobsProgressPercent?: number;
  jobsReady?: boolean;
  workflowId: string;
  currentStepName: string;
  currentStepOrder: number;
}

interface StepHistoryItem {
  id: string;
  fromStepName: string | null;
  toStepName: string;
  movedByName: string;
  movedAt: number;
}

interface NoteItem {
  id: string;
  content: string;
  createdAt: number;
  userName: string;
}

interface OrderDetail {
  order: Order & {
    notes: string | null;
    completedAt: number | null;
    deliveredAt: number | null;
  };
  prosthesisJobs: Array<{
    id: string;
    patientName: string;
    isPatientException: boolean;
    exceptionReason: string | null;
    status: 'pending' | 'completed';
    notes: string | null;
    sortOrder: number;
    completedAt: number | null;
    productId: string;
    productName: string;
    categoryId: string | null;
    categoryName: string | null;
  }>;
  progress: {
    total: number;
    completed: number;
    pending: number;
    percent: number;
    ready: boolean;
  };
  stepHistory: StepHistoryItem[];
  notes: NoteItem[];
  workflowSteps: WorkflowStep[];
}

interface Client {
  id: string;
  name: string;
  clinicName: string | null;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ---------- Constants ----------

const STATUS_TABS = [
  { key: 'active', label: 'Activos' },
  { key: 'completed', label: 'Completados' },
  { key: 'delivered', label: 'Entregados' },
  { key: 'cancelled', label: 'Cancelados' },
  { key: 'all', label: 'Todos' },
];

const WORKFLOW_COLORS = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B',
  '#10B981', '#6366F1', '#EF4444', '#14B8A6',
];

const STATUS_BADGE: Record<string, string> = {
  active: styles.statusActive,
  completed: styles.statusCompleted,
  delivered: styles.statusDelivered,
  cancelled: styles.statusCancelled,
};

// ---------- Helpers ----------

function daysInStep(createdAt: number): { text: string; cls: string } {
  const diff = Math.floor((Date.now() - createdAt) / 86400000);
  if (diff <= 1) return { text: `${diff}d`, cls: '' };
  if (diff <= 4) return { text: `${diff}d`, cls: styles.timeWarning };
  return { text: `${diff}d`, cls: styles.timeDanger };
}

function balanceClass(balance: number): string {
  if (balance > 0.01) return styles.cellDebt;
  if (balance < -0.01) return styles.cellPaid;
  return styles.cellZero;
}

// ---------- Page Component ----------

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

export default function OrdersPage() {
  const router = useRouter();
  const { addToast } = useToast();

  // Data
  const [orders, setOrders] = useState<Order[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [loading, setLoading] = useState(true);

  // Sort
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Filters
  const [activeTab, setActiveTab] = useState('active');
  const [selectedWorkflows, setSelectedWorkflows] = useState<Set<string>>(new Set());
  const [searchText, setSearchText] = useState('');
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchHighlight, setSearchHighlight] = useState(-1);

  // Drawer
  const [drawerOrder, setDrawerOrder] = useState<OrderDetail | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ orderId: string; status: string } | null>(null);
  const [confirmDeleteOrderId, setConfirmDeleteOrderId] = useState<string | null>(null);

  // Payment Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [payingOrder, setPayingOrder] = useState<any>(null);

  // Print Modal
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);

  // Edit basic fields state
  const [isEditing, setIsEditing] = useState(false);
  const [editClientId, setEditClientId] = useState('');
  const [editPatientName, setEditPatientName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [savingBasicFields, setSavingBasicFields] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);

  // Color modal state
  const [colorModalOpen, setColorModalOpen] = useState(false);
  const [activeColorStandard, setActiveColorStandard] = useState<OrderColorStandard>('vita-classical');

  // ---- Data Fetching ----

  const fetchOrders = useCallback(async (
    page = 1,
    statusFilter = activeTab,
    search = searchText,
    currentSortBy = sortBy,
    currentSortOrder = sortOrder
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('status', statusFilter);
      params.set('page', String(page));
      params.set('limit', '20');
      if (selectedWorkflows.size > 0) {
        params.set('workflows', Array.from(selectedWorkflows).join(','));
      }
      if (search) params.set('search', search);
      params.set('sortBy', currentSortBy);
      params.set('sortOrder', currentSortOrder);

      const res = await fetch(`/api/orders?${params}`);
      const data = await res.json();
      if (data.data) {
        setOrders(data.data.orders);
        setWorkflows(data.data.workflows);
        if (data.data.statusCounts) setStatusCounts(data.data.statusCounts);
        if (data.data.meta) setMeta(data.data.meta);
      }
    } catch {
      addToast('Error al cargar pedidos', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedWorkflows, searchText, addToast, sortBy, sortOrder]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  function handleSort(field: string) {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  }

  // ---- Workflow Color Map ----

  const workflowColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    workflows.forEach((w, i) => {
      map[w.id] = WORKFLOW_COLORS[i % WORKFLOW_COLORS.length];
    });
    return map;
  }, [workflows]);

  // ---- Helpers to find steps ----

  function getWorkflowForOrder(order: Order): Workflow | undefined {
    return workflows.find((w) => w.id === order.workflowId);
  }

  function getNextStep(order: Order): WorkflowStep | null {
    const wf = getWorkflowForOrder(order);
    if (!wf) return null;
    const idx = wf.steps.findIndex((s) => s.id === order.currentStepId);
    return idx < wf.steps.length - 1 ? wf.steps[idx + 1] : null;
  }

  function isLastStep(order: Order): boolean {
    const wf = getWorkflowForOrder(order);
    if (!wf || wf.steps.length === 0) return false;
    return wf.steps[wf.steps.length - 1].id === order.currentStepId;
  }

  // ---- Actions ----

  function toggleWorkflow(id: string) {
    setSelectedWorkflows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSearchChange(value: string) {
    setSearchText(value);
    if (searchTimeout) clearTimeout(searchTimeout);
    const timeout = setTimeout(() => fetchOrders(1, activeTab, value), 300);
    setSearchTimeout(timeout);
  }

  function handleTabChange(tab: string) {
    setActiveTab(tab);
    fetchOrders(1, tab, searchText);
  }

  function handlePageChange(page: number) {
    fetchOrders(page, activeTab, searchText);
  }

  async function handleMoveOrder(orderId: string, toStepId: string) {
    try {
      const res = await fetch(`/api/orders/${orderId}/step`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toStepId }),
      });
      if (res.ok) {
        addToast('Paso avanzado', 'success');
        fetchOrders(meta.page, activeTab, searchText);
        // Refresh drawer if open for this order
        if (drawerOrder?.order.id === orderId) {
          openDrawer(orderId);
        }
      } else {
        const data = await res.json();
        addToast(data.error || 'Error al mover pedido', 'error');
      }
    } catch {
      addToast('Error al mover pedido', 'error');
    }
  }

  async function handleQuickAdvance(e: React.MouseEvent, order: Order) {
    e.stopPropagation();
    const next = getNextStep(order);
    if (next) {
      await handleMoveOrder(order.id, next.id);
    }
  }

  function requestStatusChange(orderId: string, status: string) {
    if (status === 'cancelled') {
      setConfirmAction({ orderId, status });
      return;
    }
    executeStatusChange(orderId, status);
  }

  async function executeStatusChange(orderId: string, status: string) {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (res.ok) {
        setDrawerOpen(false);
        addToast(
          `Pedido ${status === 'completed' ? 'completado' : status === 'delivered' ? 'entregado' : 'cancelado'}`,
          'success'
        );
        fetchOrders(meta.page, activeTab, searchText);
      } else if (data.incompleteJobs?.length) {
        addToast(`Trabajos incompletos: ${data.incompleteJobs.join(', ')}`, 'warning');
      } else {
        addToast(data.error || 'Error al cambiar estado', 'error');
      }
    } catch {
      addToast('Error al cambiar estado', 'error');
    }
  }

  async function handleDeleteOrder(orderId: string) {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (res.ok) {
        setDrawerOpen(false);
        setDrawerOrder(null);
        addToast('Pedido eliminado', 'success');
        fetchOrders(meta.page, activeTab, searchText);
        return;
      }

      if (res.status === 409 && data.details?.paymentAllocations) {
        addToast('No se puede eliminar: el pedido tiene pagos aplicados', 'warning');
        return;
      }

      addToast(data.error || 'Error al eliminar pedido', 'error');
    } catch {
      addToast('Error al eliminar pedido', 'error');
    } finally {
      setConfirmDeleteOrderId(null);
    }
  }

  async function handleJobStatusChange(orderId: string, jobId: string, status: 'pending' | 'completed') {
    try {
      const res = await fetch(`/api/orders/${orderId}/jobs/${jobId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();

      if (!res.ok) {
        addToast(data.error || 'Error al actualizar trabajo', 'error');
        return;
      }

      addToast(status === 'completed' ? 'Trabajo marcado como finalizado' : 'Trabajo reabierto', 'success');
      await openDrawer(orderId);
      fetchOrders(meta.page, activeTab, searchText);
    } catch {
      addToast('Error al actualizar trabajo', 'error');
    }
  }

  async function handleQuickFinish(e: React.MouseEvent, order: Order) {
    e.stopPropagation();
    requestStatusChange(order.id, 'completed');
  }

  // ---- Drawer ----

  useEffect(() => {
    async function loadClients() {
      try {
        const res = await fetch('/api/clients?limit=200&status=active');
        const data = await res.json();
        if (data.data) setClients(data.data);
      } catch {
        console.error('Error al cargar clientes');
      }
    }
    loadClients();
  }, []);

  async function openDrawer(orderId: string) {
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      const data = await res.json();
      if (data.data) {
        setDrawerOrder(data.data);
        setDrawerOpen(true);
        setIsEditing(false); // Reset edit state when opening/refreshing drawer
      }
    } catch {
      addToast('Error al cargar detalle', 'error');
    }
  }

  // Deep link: open the order drawer via ?order=<id> (used by the lab QR code)
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (deepLinkHandled.current) return;
    deepLinkHandled.current = true;
    const orderId = new URLSearchParams(window.location.search).get('order');
    if (orderId) {
      openDrawer(orderId);
      window.history.replaceState(null, '', '/orders');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSaveBasicFields(e: React.FormEvent) {
    e.preventDefault();
    if (!drawerOrder) return;
    
    if (!editClientId || !editPrice) {
      addToast('Cliente y precio son requeridos', 'warning');
      return;
    }

    const finalPrice = parseFloat(editPrice);
    if (isNaN(finalPrice) || finalPrice < 0) {
      addToast('El precio debe ser un número válido', 'warning');
      return;
    }

    setSavingBasicFields(true);
    try {
      const res = await fetch(`/api/orders/${drawerOrder.order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: editClientId,
          patientName: editPatientName.trim(),
          color: editColor || null,
          finalPriceUsd: finalPrice,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || 'Error al actualizar pedido', 'error');
        return;
      }

      addToast('Pedido actualizado', 'success');
      setIsEditing(false);
      
      // Reload details and list
      await openDrawer(drawerOrder.order.id);
      fetchOrders(meta.page, activeTab, searchText);
    } catch {
      addToast('Error al actualizar pedido', 'error');
    } finally {
      setSavingBasicFields(false);
    }
  }

  async function handleAddNote() {
    if (!newNote.trim() || !drawerOrder) return;
    setAddingNote(true);
    try {
      const res = await fetch(`/api/orders/${drawerOrder.order.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNote }),
      });
      const data = await res.json();
      if (res.ok) {
        setDrawerOrder((prev) =>
          prev ? { ...prev, notes: [data.data, ...prev.notes] } : null
        );
        setNewNote('');
        addToast('Nota agregada', 'success');
      }
    } catch {
      addToast('Error al agregar nota', 'error');
    } finally {
      setAddingNote(false);
    }
  }

  // Close drawer on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && drawerOpen) setDrawerOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  // ---- Search suggestions ----
  const searchSuggestions = useMemo(() => {
    if (!searchText.trim() || searchText.length < 2) return [];
    const q = searchText.toLowerCase();
    const seen = new Set<string>();
    const suggestions: Array<{ type: 'client' | 'patient'; name: string; sub?: string }> = [];
    for (const o of orders) {
      if (!seen.has(`c-${o.clientName}`) && o.clientName.toLowerCase().includes(q)) {
        seen.add(`c-${o.clientName}`);
        suggestions.push({ type: 'client', name: o.clientName, sub: o.clientClinic || undefined });
      }
      if (o.patientName && !seen.has(`p-${o.patientName}`) && o.patientName.toLowerCase().includes(q)) {
        seen.add(`p-${o.patientName}`);
        suggestions.push({ type: 'patient', name: o.patientName });
      }
    }
    return suggestions.slice(0, 6);
  }, [searchText, orders]);

  function selectSuggestion(name: string) {
    setSearchText(name);
    setSearchOpen(false);
    setSearchHighlight(-1);
    fetchOrders(1, activeTab, name);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (!searchOpen || searchSuggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSearchHighlight(i => Math.min(i + 1, searchSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSearchHighlight(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && searchHighlight >= 0) {
      e.preventDefault();
      selectSuggestion(searchSuggestions[searchHighlight].name);
    } else if (e.key === 'Escape') {
      setSearchOpen(false);
    }
  }

  // ---- Render ----
  const selectedOrderColor = getOrderColorOption(drawerOrder?.order.color);

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Pedidos</h1>
          <p className={styles.subtitle}>
            {meta.total} pedido{meta.total !== 1 ? 's' : ''} {activeTab !== 'all' ? STATUS_TABS.find(t => t.key === activeTab)?.label.toLowerCase() : 'en total'}
          </p>
        </div>
        <Button onClick={() => router.push('/orders/new')}>+ Nuevo Pedido</Button>
      </div>

      {/* Filters bar */}
      <div className={styles.filterBar}>
        {/* Status Tabs */}
        <div className={styles.statusTabs}>
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              className={`${styles.statusTab} ${activeTab === tab.key ? styles.tabActive : ''}`}
              onClick={() => handleTabChange(tab.key)}
            >
              {tab.label}
              {statusCounts[tab.key] !== undefined && (
                <span className={styles.tabCount}>{statusCounts[tab.key]}</span>
              )}
            </button>
          ))}
        </div>

        {/* Search combobox */}
        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            className={styles.searchInput}
            placeholder="Buscar paciente u odontólogo..."
            value={searchText}
            onChange={(e) => { handleSearchChange(e.target.value); setSearchOpen(true); setSearchHighlight(-1); }}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
            onKeyDown={handleSearchKeyDown}
          />
          {searchText && (
            <button
              type="button"
              className={styles.searchClear}
              onClick={() => { setSearchText(''); setSearchOpen(false); fetchOrders(1, activeTab, ''); }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
          )}

          {/* Suggestions dropdown */}
          {searchOpen && searchSuggestions.length > 0 && (
            <div className={styles.searchDropdown}>
              {searchSuggestions.map((s, i) => (
                <button
                  key={`${s.type}-${s.name}`}
                  type="button"
                  className={`${styles.searchOption} ${i === searchHighlight ? styles.searchOptionActive : ''}`}
                  onMouseDown={() => selectSuggestion(s.name)}
                  onMouseEnter={() => setSearchHighlight(i)}
                >
                  <span className={styles.searchOptionIcon}>
                    {s.type === 'client' ? (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.2"/><path d="M2.5 12.5c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 10.5h6M5 7.5h4M7 1.5l5 3.5v7H2v-7l5-3.5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    )}
                  </span>
                  <span className={styles.searchOptionText}>
                    <span className={styles.searchOptionName}>{s.name}</span>
                    {s.sub && <span className={styles.searchOptionSub}>{s.sub}</span>}
                  </span>
                  <span className={styles.searchOptionType}>
                    {s.type === 'client' ? 'Odontólogo' : 'Paciente'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Workflow Chips */}
      {workflows.length > 0 && (
        <div className={styles.workflowBar}>
          {workflows.map((w) => (
            <button
              key={w.id}
              className={`${styles.workflowChip} ${selectedWorkflows.has(w.id) ? styles.chipSelected : selectedWorkflows.size === 0 ? styles.chipActive : ''}`}
              style={{ '--chip-color': workflowColorMap[w.id] } as React.CSSProperties}
              onClick={() => toggleWorkflow(w.id)}
            >
              <span className={styles.chipDot} style={{ background: workflowColorMap[w.id] }} />
              {w.name}
            </button>
          ))}
          {selectedWorkflows.size > 0 && (
            <button className={styles.chipClear} onClick={() => setSelectedWorkflows(new Set())}>
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {/* FIFO Table */}
      {loading ? (
        <p className={styles.loading}>Cargando pedidos...</p>
      ) : orders.length === 0 ? (
        <EmptyState
          title="Sin pedidos"
          description={activeTab === 'active' ? 'No hay pedidos activos. Crea uno nuevo para comenzar.' : 'No hay pedidos en esta categoría.'}
          action={activeTab === 'active' ? <Button onClick={() => router.push('/orders/new')}>+ Nuevo Pedido</Button> : undefined}
        />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th onClick={() => handleSort('orderNumber')}>
                  # <SortIcon active={sortBy === 'orderNumber'} order={sortOrder} />
                </th>
                <th onClick={() => handleSort('patientName')}>
                  Paciente <SortIcon active={sortBy === 'patientName'} order={sortOrder} />
                </th>
                <th onClick={() => handleSort('clientName')}>
                  Odontólogo <SortIcon active={sortBy === 'clientName'} order={sortOrder} />
                </th>
                <th onClick={() => handleSort('productName')}>
                  Producto <SortIcon active={sortBy === 'productName'} order={sortOrder} />
                </th>
                <th onClick={() => handleSort('currentStep')}>
                  Paso Actual <SortIcon active={sortBy === 'currentStep'} order={sortOrder} />
                </th>
                <th onClick={() => handleSort('finalPriceUsd')} style={{ textAlign: 'right' }}>
                  Precio <SortIcon active={sortBy === 'finalPriceUsd'} order={sortOrder} />
                </th>
                <th onClick={() => handleSort('balance')} style={{ textAlign: 'right' }}>
                  Saldo <SortIcon active={sortBy === 'balance'} order={sortOrder} />
                </th>
                <th onClick={() => handleSort('createdAt')}>
                  Creado <SortIcon active={sortBy === 'createdAt'} order={sortOrder} />
                </th>
                <th onClick={() => handleSort('status')}>
                  Estado <SortIcon active={sortBy === 'status'} order={sortOrder} />
                </th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const balance = order.finalPriceUsd - order.amountPaidUsd;
                const timeInfo = daysInStep(order.createdAt);
                return (
                  <tr key={order.id} onClick={() => openDrawer(order.id)}>
                    <td>
                      <span className={styles.cellOrder}>
                        <span
                          className={styles.workflowDot}
                          style={{ background: workflowColorMap[order.workflowId] }}
                        />
                        {order.orderNumber}
                      </span>
                    </td>
                    <td>
                      <span className={styles.cellPatient}>{order.patientName}</span>
                    </td>
                    <td>
                      <span className={styles.cellClient}>
                        {order.clientName}
                        {order.clientClinic ? ` · ${order.clientClinic}` : ''}
                      </span>
                    </td>
                    <td>
                      <span className={styles.cellProduct}>
                        {order.productSummary || order.productName}
                        {order.categorySummary ? ` · ${order.categorySummary}` : ''}
                        {order.jobsCount ? ` · ${order.completedJobsCount || 0}/${order.jobsCount} listos` : ''}
                      </span>
                    </td>
                    <td>
                      <span className={styles.cellStep}>
                        <span className={styles.stepBadge}>{order.currentStepName}</span>
                      </span>
                    </td>
                    <td>
                      <span className={styles.cellMoney}>{formatCurrency(order.finalPriceUsd)}</span>
                    </td>
                    <td>
                      <span className={`${styles.cellMoney} ${balanceClass(balance)}`}>
                        {balance > 0.01
                          ? `-${formatCurrency(balance)}`
                          : balance < -0.01
                            ? `+${formatCurrency(Math.abs(balance))}`
                            : formatCurrency(0)}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.cellTime} ${timeInfo.cls}`}>
                        {formatRelativeTime(order.createdAt)}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${STATUS_BADGE[order.status] || ''}`}>
                        {order.status === 'active' ? 'Activo' : order.status === 'completed' ? 'Completado' : order.status === 'delivered' ? 'Entregado' : 'Cancelado'}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className={styles.quickActions}>
                        <button
                          className={`${styles.quickBtn} ${styles.quickPrint}`}
                          onClick={(e) => { e.stopPropagation(); setPrintingOrderId(order.id); }}
                          title="Imprimir orden (Carta 50/50)"
                        >
                          🖨️ Imprimir
                        </button>
                        {activeTab === 'active' && !isLastStep(order) && (
                          <button
                            className={`${styles.quickBtn} ${styles.quickAdvance}`}
                            onClick={(e) => handleQuickAdvance(e, order)}
                            title={`Avanzar a: ${getNextStep(order)?.name || ''}`}
                          >
                            ▶ Avanzar
                          </button>
                        )}
                        {activeTab === 'active' && isLastStep(order) && (
                          <button
                            className={`${styles.quickBtn} ${styles.quickFinish}`}
                            onClick={(e) => handleQuickFinish(e, order)}
                            title="Marcar como completado"
                          >
                            ✓ Finalizar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {meta.totalPages > 1 && (
            <div className={styles.pagination}>
              <span>
                Mostrando {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)} de {meta.total}
              </span>
              <div className={styles.paginationBtns}>
                <button
                  className={styles.pageBtn}
                  disabled={meta.page <= 1}
                  onClick={() => handlePageChange(meta.page - 1)}
                >
                  ← Anterior
                </button>
                <button
                  className={styles.pageBtn}
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => handlePageChange(meta.page + 1)}
                >
                  Siguiente →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- Detail Drawer ---- */}
      {drawerOpen && drawerOrder && (
        <>
          <div className={styles.overlay} onClick={() => setDrawerOpen(false)} />
          <div className={styles.drawer}>
            <div className={styles.drawerHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 className={styles.drawerTitle}>Pedido #{drawerOrder.order.orderNumber}</h2>
                <span className={`${styles.statusBadge} ${STATUS_BADGE[drawerOrder.order.status] || ''}`}>
                  {drawerOrder.order.status === 'active' ? 'Activo' : drawerOrder.order.status === 'completed' ? 'Completado' : drawerOrder.order.status === 'delivered' ? 'Entregado' : 'Cancelado'}
                </span>
              </div>
              <button className={styles.closeBtn} onClick={() => setDrawerOpen(false)} aria-label="Cerrar">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className={styles.drawerContent}>
              {/* Order Info */}
              <div className={styles.drawerSection}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 className={styles.sectionTitle} style={{ marginBottom: 0 }}>Información</h3>
                  {drawerOrder.order.status !== 'cancelled' && (
                    <button
                      type="button"
                      className={styles.editBtn}
                      onClick={() => {
                        if (isEditing) {
                          setIsEditing(false);
                        } else {
                          setEditClientId(drawerOrder.order.clientId);
                          setEditPatientName(drawerOrder.order.patientName);
                          setEditColor(drawerOrder.order.color || '');
                          setEditPrice(String(drawerOrder.order.finalPriceUsd));
                          setIsEditing(true);
                        }
                      }}
                    >
                      {isEditing ? 'Cancelar' : '✏️ Editar'}
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <form onSubmit={handleSaveBasicFields} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <Input
                        label="Paciente"
                        value={editPatientName}
                        onChange={(e) => setEditPatientName(e.target.value)}
                        required
                      />
                      <Input
                        label="Precio Final (USD)"
                        type="number"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        min="0"
                        step="0.01"
                        required
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                      <ClientCombobox
                        clients={clients}
                        value={editClientId}
                        onChange={setEditClientId}
                        onClientCreated={(c) => setClients((prev) => [...prev, c])}
                      />
                    </div>
                    
                    <div className={styles.colorField}>
                      <label className={styles.label} style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text)' }}>Color (opcional)</label>
                      <button
                        type="button"
                        className={styles.colorSelector}
                        onClick={() => setColorModalOpen(true)}
                      >
                        <span className={styles.colorSelectorMain}>
                          <span
                            className={styles.colorSwatch}
                            style={{ backgroundColor: getOrderColorOption(editColor)?.hex || '#F3F4F6' }}
                          />
                          <span className={styles.colorSelectorText}>
                            {getOrderColorOption(editColor)
                              ? `${getOrderColorOption(editColor)?.code} · ${getOrderColorOption(editColor)?.name}`
                              : 'Seleccionar color'}
                          </span>
                        </span>
                        <span className={styles.colorSelectorStandard}>
                          {getOrderColorOption(editColor)
                            ? ORDER_COLOR_STANDARDS.find((standard) => standard.value === getOrderColorOption(editColor)?.standard)?.label
                            : 'Vita Classical'}
                        </span>
                      </button>
                      {editColor && (
                        <div className={styles.colorActions}>
                          <button
                            type="button"
                            className={styles.clearColorBtn}
                            onClick={() => setEditColor('')}
                          >
                            Quitar color
                          </button>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <Button type="submit" loading={savingBasicFields}>Guardar</Button>
                      <Button variant="secondary" onClick={() => setIsEditing(false)}>Cancelar</Button>
                    </div>
                  </form>
                ) : (
                  <div className={styles.infoGrid}>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Paciente</span>
                      <span className={styles.infoValue}>{drawerOrder.order.patientName}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Odontólogo</span>
                      <span className={styles.infoValue}>{drawerOrder.order.clientName}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Trabajos</span>
                      <span className={styles.infoValue}>{drawerOrder.progress.completed}/{drawerOrder.progress.total} listos</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Color</span>
                      <span className={styles.infoValue}>
                        {selectedOrderColor
                          ? `${selectedOrderColor.code} · ${selectedOrderColor.name} (${ORDER_COLOR_STANDARDS.find((standard) => standard.value === selectedOrderColor.standard)?.label})`
                          : 'Sin color'}
                      </span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Precio</span>
                      <span className={styles.infoValue}>{formatCurrency(drawerOrder.order.finalPriceUsd)}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Pagado</span>
                      <span className={styles.infoValue}>{formatCurrency(drawerOrder.order.amountPaidUsd)}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Saldo</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className={`${styles.infoValue} ${balanceClass(drawerOrder.order.finalPriceUsd - drawerOrder.order.amountPaidUsd)}`}>
                          {formatCurrency(drawerOrder.order.finalPriceUsd - drawerOrder.order.amountPaidUsd)}
                        </span>
                        {drawerOrder.order.status !== 'cancelled' && drawerOrder.order.finalPriceUsd - drawerOrder.order.amountPaidUsd > 0.005 && (
                          <button
                            type="button"
                            className={styles.quickPayLink}
                            onClick={() => setIsPaymentModalOpen(true)}
                            title="Abonar a este pedido"
                          >
                            💵 Abonar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                <div style={{ marginTop: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {drawerOrder.order.status !== 'cancelled' && drawerOrder.order.finalPriceUsd - drawerOrder.order.amountPaidUsd > 0.005 && (
                    <Button onClick={() => setIsPaymentModalOpen(true)}>
                      💵 Abonar
                    </Button>
                  )}
                  <Button variant="secondary" onClick={() => setPrintingOrderId(drawerOrder.order.id)}>
                    🖨️ Imprimir Orden
                  </Button>
                  <Button variant="secondary" onClick={() => setIsShareModalOpen(true)}>
                    🔗 Compartir
                  </Button>
                  <Button variant="secondary" onClick={() => router.push(`/orders/${drawerOrder.order.id}/delivery`)}>
                    🛵 Solicitar Delivery
                  </Button>
                  <Button variant="danger" onClick={() => setConfirmDeleteOrderId(drawerOrder.order.id)}>
                    Eliminar
                  </Button>
                </div>
              </div>

              <div className={styles.drawerSection}>
                <h3 className={styles.sectionTitle}>Prótesis del Pedido</h3>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
                  Progreso general: {drawerOrder.progress.completed}/{drawerOrder.progress.total} trabajos finalizados ({drawerOrder.progress.percent}%)
                </p>
                <div className={styles.notesList}>
                  {drawerOrder.prosthesisJobs.map((job, index) => (
                    <div key={job.id} className={styles.noteItem}>
                      <p className={styles.noteContent}>
                        <strong>{index + 1}. {job.productName}</strong>
                        {job.categoryName ? ` · ${job.categoryName}` : ''}
                      </p>
                      <p className={styles.noteMeta}>
                        Paciente: {job.patientName}
                        {job.isPatientException && job.exceptionReason ? ` · Excepción: ${job.exceptionReason}` : ''}
                      </p>
                      {job.notes && (
                        <p className={styles.noteMeta}>Notas del trabajo: {job.notes}</p>
                      )}
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className={`${styles.statusBadge} ${job.status === 'completed' ? styles.statusCompleted : styles.statusActive}`}>
                          {job.status === 'completed' ? 'Finalizado' : 'Pendiente'}
                        </span>
                        {!job.id.startsWith('legacy-') && drawerOrder.order.status !== 'cancelled' && drawerOrder.order.status !== 'delivered' && (
                          <Button
                            size="sm"
                            variant={job.status === 'completed' ? 'secondary' : 'primary'}
                            onClick={() => handleJobStatusChange(drawerOrder.order.id, job.id, job.status === 'completed' ? 'pending' : 'completed')}
                          >
                            {job.status === 'completed' ? 'Reabrir Trabajo' : 'Marcar Finalizado'}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mini-Kanban Stepper */}
              {drawerOrder.order.status === 'active' && (
                <div className={styles.drawerSection}>
                  <h3 className={styles.sectionTitle}>Progreso del Flujo</h3>
                  <div className={styles.stepper}>
                    {drawerOrder.workflowSteps.filter(s => s.isActive).map((step, i) => {
                      const currentIdx = drawerOrder.workflowSteps
                        .filter(s => s.isActive)
                        .findIndex((ws) => ws.id === drawerOrder.order.currentStepId);
                      const isDone = i < currentIdx;
                      const isCurrent = i === currentIdx;

                      return (
                        <div
                          key={step.id}
                          className={`${styles.stepperStep} ${isDone ? styles.stepDone : ''} ${isCurrent ? styles.stepCurrent : ''}`}
                          onClick={() => {
                            if (step.id !== drawerOrder.order.currentStepId) {
                              handleMoveOrder(drawerOrder.order.id, step.id);
                            }
                          }}
                          title={`Mover a: ${step.name}`}
                        >
                          <div className={styles.stepperDot}>
                            {isDone ? '✓' : i + 1}
                          </div>
                          <span className={styles.stepperLabel}>{step.name}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Step Action Buttons */}
                  <div className={styles.stepActions}>
                    {(() => {
                      const activeSteps = drawerOrder.workflowSteps.filter(s => s.isActive);
                      const currentIdx = activeSteps.findIndex(
                        (ws) => ws.id === drawerOrder.order.currentStepId
                      );
                      const prevStep = currentIdx > 0 ? activeSteps[currentIdx - 1] : null;
                      const nextStep = currentIdx < activeSteps.length - 1 ? activeSteps[currentIdx + 1] : null;
                      const isLast = currentIdx === activeSteps.length - 1;

                      return (
                        <>
                          {prevStep && (
                            <button
                              className={styles.stepActionBtn}
                              onClick={() => handleMoveOrder(drawerOrder.order.id, prevStep.id)}
                            >
                              ← {prevStep.name}
                            </button>
                          )}
                          {nextStep && (
                            <button
                              className={`${styles.stepActionBtn} ${styles.btnPrimary}`}
                              onClick={() => handleMoveOrder(drawerOrder.order.id, nextStep.id)}
                            >
                              {nextStep.name} →
                            </button>
                          )}
                          {isLast && (
                            <button
                              className={`${styles.stepActionBtn} ${styles.btnSuccess}`}
                              onClick={() => requestStatusChange(drawerOrder.order.id, 'completed')}
                            >
                              ✓ Completar Pedido
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Status Actions for completed orders */}
              {drawerOrder.order.status === 'completed' && (
                <div className={styles.drawerSection}>
                  <div className={styles.stepActions}>
                    <button
                      className={`${styles.stepActionBtn} ${styles.btnSuccess}`}
                      onClick={() => requestStatusChange(drawerOrder.order.id, 'delivered')}
                    >
                      📦 Marcar como Entregado
                    </button>
                    <button
                      className={`${styles.stepActionBtn} ${styles.btnDanger}`}
                      onClick={() => requestStatusChange(drawerOrder.order.id, 'cancelled')}
                    >
                      ✕ Cancelar Pedido
                    </button>
                  </div>
                </div>
              )}

              {/* Cancel for active orders */}
              {drawerOrder.order.status === 'active' && (
                <div className={styles.drawerSection}>
                  <button
                    className={`${styles.stepActionBtn} ${styles.btnDanger}`}
                    onClick={() => requestStatusChange(drawerOrder.order.id, 'cancelled')}
                  >
                    ✕ Cancelar Pedido
                  </button>
                </div>
              )}

              {/* Timeline / History */}
              <div className={styles.drawerSection}>
                <h3 className={styles.sectionTitle}>Historial</h3>
                {drawerOrder.stepHistory.length > 0 ? (
                  <div className={styles.timeline}>
                    {drawerOrder.stepHistory.map((h) => (
                      <div key={h.id} className={styles.timelineItem}>
                        <div className={styles.timelineDot} />
                        <div className={styles.timelineContent}>
                          <p className={styles.timelineText}>
                            {h.fromStepName
                              ? <><strong>{h.fromStepName}</strong> → <strong>{h.toStepName}</strong></>
                              : <>Creado en <strong>{h.toStepName}</strong></>
                            }
                          </p>
                          <p className={styles.timelineMeta}>
                            {h.movedByName} · {formatRelativeTime(h.movedAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>Sin movimientos registrados</p>
                )}
              </div>

              {/* Notes */}
              <div className={styles.drawerSection}>
                <h3 className={styles.sectionTitle}>Notas</h3>
                <div className={styles.noteInput}>
                  <input
                    className={styles.noteField}
                    placeholder="Agregar nota..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddNote(); }}
                  />
                  <Button size="sm" loading={addingNote} onClick={handleAddNote}>
                    Agregar
                  </Button>
                </div>
                {(drawerOrder.order.notes || drawerOrder.notes.length > 0) && (
                  <div className={styles.notesList}>
                    {drawerOrder.order.notes && (
                      <div className={styles.noteItem}>
                        <p className={styles.noteContent}>{drawerOrder.order.notes}</p>
                        <p className={styles.noteMeta}>
                          Nota registrada al crear el pedido
                        </p>
                      </div>
                    )}
                    {drawerOrder.notes.map((n) => (
                      <div key={n.id} className={styles.noteItem}>
                        <p className={styles.noteContent}>{n.content}</p>
                        <p className={styles.noteMeta}>
                          {n.userName} · {formatRelativeTime(n.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {!drawerOrder.order.notes && drawerOrder.notes.length === 0 && (
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
                    Sin notas registradas
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!confirmAction}
        title="¿Cancelar este pedido?"
        message="Esta acción no se puede deshacer. El pedido será marcado como cancelado permanentemente."
        confirmLabel="Sí, cancelar pedido"
        variant="danger"
        onConfirm={async () => {
          if (confirmAction) {
            await executeStatusChange(confirmAction.orderId, confirmAction.status);
          }
          setConfirmAction(null);
        }}
        onCancel={() => setConfirmAction(null)}
      />

      <ConfirmDialog
        isOpen={!!confirmDeleteOrderId}
        title="¿Eliminar este pedido?"
        message="Esta acción eliminará el pedido y su historial asociado. No se puede deshacer."
        confirmLabel="Sí, eliminar pedido"
        variant="danger"
        onConfirm={async () => {
          if (confirmDeleteOrderId) {
            await handleDeleteOrder(confirmDeleteOrderId);
          }
        }}
        onCancel={() => setConfirmDeleteOrderId(null)}
      />

      {printingOrderId && (
        <OrderPrintModal
          orderId={printingOrderId}
          onClose={() => setPrintingOrderId(null)}
        />
      )}

      {drawerOrder && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          clientId={drawerOrder.order.clientId}
          clientName={drawerOrder.order.clientName}
          onSuccess={async () => {
            await openDrawer(drawerOrder.order.id);
            fetchOrders(meta.page, activeTab, searchText);
          }}
          targetOrderId={drawerOrder.order.id}
          targetOrderNumber={drawerOrder.order.orderNumber}
          targetOrderRemainingUsd={drawerOrder.order.finalPriceUsd - drawerOrder.order.amountPaidUsd}
        />
      )}

      {isShareModalOpen && drawerOrder && (
        <div className={styles.modalOverlay} onClick={() => setIsShareModalOpen(false)}>
          <div
            className={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '500px', width: '90%' }}
          >
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Compartir Detalle de Pedido</h3>
              <button className={styles.closeBtn} onClick={() => setIsShareModalOpen(false)}>×</button>
            </div>
            <div className={styles.modalBody} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem 0' }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                Se enviará el siguiente mensaje preformateado al odontólogo:
              </p>
              
              <textarea
                readOnly
                value={(() => {
                  const balance = drawerOrder.order.finalPriceUsd - drawerOrder.order.amountPaidUsd;
                  const origin = typeof window !== 'undefined' ? window.location.origin : '';
                  const prodName = drawerOrder.order.productName || 'Prótesis';
                  const statusLabel = {
                    active: `En proceso (${drawerOrder.workflowSteps.find(s => s.id === drawerOrder.order.currentStepId)?.name || 'Producción'})`,
                    completed: 'Completado',
                    delivered: 'Entregado',
                    cancelled: 'Cancelado',
                  }[drawerOrder.order.status] || drawerOrder.order.status;

                  return `¡Hola, Dr/Dra. ${drawerOrder.order.clientName}! 👋\n\nLe compartimos el estado de su pedido en *SJ Lab*:\n\n📦 *Pedido:* #${drawerOrder.order.orderNumber}\n👤 *Paciente:* ${drawerOrder.order.patientName}\n🦷 *Trabajo:* ${prodName}\n📊 *Estatus:* ${statusLabel}\n💵 *Saldo de este pedido:* ${formatCurrency(balance)} USD\n\nPuede ver el seguimiento en tiempo real de su trabajo aquí:\n${origin}/portal?orderId=${drawerOrder.order.id}\n\n¡Gracias por su confianza!`;
                })()}
                rows={10}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  resize: 'none',
                  backgroundColor: 'var(--color-bg-secondary)',
                  color: 'var(--color-text)',
                }}
              />

              <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
                <Button
                  style={{ flex: 1 }}
                  onClick={async () => {
                    const balance = drawerOrder.order.finalPriceUsd - drawerOrder.order.amountPaidUsd;
                    const origin = typeof window !== 'undefined' ? window.location.origin : '';
                    const prodName = drawerOrder.order.productName || 'Prótesis';
                    const statusLabel = {
                      active: `En proceso (${drawerOrder.workflowSteps.find(s => s.id === drawerOrder.order.currentStepId)?.name || 'Producción'})`,
                      completed: 'Completado',
                      delivered: 'Entregado',
                      cancelled: 'Cancelado',
                    }[drawerOrder.order.status] || drawerOrder.order.status;

                    const msg = `¡Hola, Dr/Dra. ${drawerOrder.order.clientName}! 👋\n\nLe compartimos el estado de su pedido en *SJ Lab*:\n\n📦 *Pedido:* #${drawerOrder.order.orderNumber}\n👤 *Paciente:* ${drawerOrder.order.patientName}\n🦷 *Trabajo:* ${prodName}\n📊 *Estatus:* ${statusLabel}\n💵 *Saldo de este pedido:* ${formatCurrency(balance)} USD\n\nPuede ver el seguimiento en tiempo real de su trabajo aquí:\n${origin}/portal?orderId=${drawerOrder.order.id}\n\n¡Gracias por su confianza!`;
                    
                    try {
                      await navigator.clipboard.writeText(msg);
                      addToast('Mensaje copiado al portapapeles', 'success');
                    } catch {
                      addToast('No se pudo copiar', 'warning');
                    }
                  }}
                >
                  📋 Copiar Mensaje
                </Button>
                
                <Button
                  variant="primary"
                  style={{ flex: 1, backgroundColor: '#25D366', borderColor: '#25D366', color: '#FFF' }}
                  onClick={() => {
                    const balance = drawerOrder.order.finalPriceUsd - drawerOrder.order.amountPaidUsd;
                    const origin = typeof window !== 'undefined' ? window.location.origin : '';
                    const prodName = drawerOrder.order.productName || 'Prótesis';
                    const statusLabel = {
                      active: `En proceso (${drawerOrder.workflowSteps.find(s => s.id === drawerOrder.order.currentStepId)?.name || 'Producción'})`,
                      completed: 'Completado',
                      delivered: 'Entregado',
                      cancelled: 'Cancelado',
                    }[drawerOrder.order.status] || drawerOrder.order.status;

                    const msg = `¡Hola, Dr/Dra. ${drawerOrder.order.clientName}! 👋\n\nLe compartimos el estado de su pedido en *SJ Lab*:\n\n📦 *Pedido:* #${drawerOrder.order.orderNumber}\n👤 *Paciente:* ${drawerOrder.order.patientName}\n🦷 *Trabajo:* ${prodName}\n📊 *Estatus:* ${statusLabel}\n💵 *Saldo de este pedido:* ${formatCurrency(balance)} USD\n\nPuede ver el seguimiento en tiempo real de su trabajo aquí:\n${origin}/portal?orderId=${drawerOrder.order.id}\n\n¡Gracias por su confianza!`;
                    
                    const phone = drawerOrder.order.clientPhone;
                    let cleanPhone = phone ? phone.replace(/[^\d]/g, '') : '';
                    if (cleanPhone) {
                      if (cleanPhone.startsWith('0') && cleanPhone.length === 11) {
                        cleanPhone = '58' + cleanPhone.substring(1);
                      } else if ((cleanPhone.startsWith('412') || cleanPhone.startsWith('414') || cleanPhone.startsWith('416') || cleanPhone.startsWith('424') || cleanPhone.startsWith('426')) && cleanPhone.length === 10) {
                        cleanPhone = '58' + cleanPhone;
                      }
                    }
                    const whatsappUrl = cleanPhone 
                      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`
                      : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
                    
                    window.open(whatsappUrl, '_blank');
                  }}
                >
                  💬 Enviar WhatsApp
                </Button>
              </div>
            </div>
            <div className={styles.modalFooter} style={{ padding: '1rem 0 0 0', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setIsShareModalOpen(false)}>Cerrar</Button>
            </div>
          </div>
        </div>
      )}

      {colorModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setColorModalOpen(false)}>
          <div
            className={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="color-modal-title"
          >
            <div className={styles.modalHeader}>
              <div>
                <h2 id="color-modal-title" className={styles.modalTitle}>Seleccionar Color</h2>
                <p className={styles.modalSubtitle}>Elige un estándar y luego el código con su nombre.</p>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setColorModalOpen(false)}
              >
                ×
              </button>
            </div>

            <div className={styles.standardTabs}>
              {ORDER_COLOR_STANDARDS.map((standard) => (
                <button
                  key={standard.value}
                  type="button"
                  className={`${styles.standardTab} ${activeColorStandard === standard.value ? styles.standardTabActive : ''}`}
                  onClick={() => setActiveColorStandard(standard.value)}
                >
                  {standard.label}
                </button>
              ))}
            </div>

            <div className={styles.colorGrid}>
              {ORDER_COLOR_OPTIONS.filter((option) => option.standard === activeColorStandard).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.colorOption} ${editColor === option.value ? styles.colorOptionActive : ''}`}
                  onClick={() => {
                    setEditColor(option.value);
                    setColorModalOpen(false);
                  }}
                >
                  <span className={styles.colorOptionTop}>
                    <span className={styles.colorSwatchLarge} style={{ backgroundColor: option.hex }} />
                    <span className={styles.colorHex}>{option.hex}</span>
                  </span>
                  <span className={styles.colorCode}>{option.code}</span>
                  <span className={styles.colorName}>{option.name}</span>
                </button>
              ))}
            </div>

            <div className={styles.modalActions}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditColor('');
                  setColorModalOpen(false);
                }}
              >
                Sin color
              </Button>
              <Button type="button" variant="secondary" onClick={() => setColorModalOpen(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
