// ============================================
// SJ Lab — Tesorería y Saldos Page (Enhanced UI/UX)
// ============================================

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { PaymentModal } from '@/components/finances/PaymentModal';
import { formatCurrency, formatDate, formatBs } from '@/lib/utils';
import { PAYMENT_METHODS_BY_CURRENCY } from '@/lib/constants';
import {
  TreasuryAccountBalance,
  TreasuryTransfer,
  TreasuryAdjustment,
  AccountMovement,
  CashClosing,
  UnidentifiedPayment,
} from '@/types';
import styles from './page.module.css';

const REASON_PRESETS = [
  'Comisión bancaria / plataforma',
  'Ajuste por diferencial cambiario',
  'Rendimientos / Intereses generados',
  'Corrección por error de conteo',
  'Gasto menor no facturado',
  'Ingreso no registrado',
  'Otro motivo',
];

type TesoreriaTab = 'movements' | 'unidentified' | 'transfers' | 'adjustments' | 'closings';

interface ClientOption {
  id: string;
  name: string;
  clinicName?: string | null;
}

function getTodayCaracas() {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Caracas',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

export default function TesoreriaPage() {
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<TesoreriaTab>('movements');

  // Loading states
  const [loadingBalances, setLoadingBalances] = useState(true);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [loadingTransfers, setLoadingTransfers] = useState(false);
  const [loadingAdjustments, setLoadingAdjustments] = useState(false);
  const [loadingClosings, setLoadingClosings] = useState(false);
  const [loadingUnidentified, setLoadingUnidentified] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Data states
  const [balances, setBalances] = useState<Record<string, TreasuryAccountBalance>>({});
  const [movements, setMovements] = useState<AccountMovement[]>([]);
  const [transfers, setTransfers] = useState<TreasuryTransfer[]>([]);
  const [adjustments, setAdjustments] = useState<TreasuryAdjustment[]>([]);
  const [historyClosings, setHistoryClosings] = useState<CashClosing[]>([]);
  const [unidentified, setUnidentified] = useState<UnidentifiedPayment[]>([]);
  const [unidentifiedFilter, setUnidentifiedFilter] = useState<'pending' | 'all'>('pending');

  // Exchange rates state
  const [liveRates, setLiveRates] = useState<{ usdParallel: number; usdBcv: number } | null>(null);

  // Filter states
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>('all');
  const [movementSearchQuery, setMovementSearchQuery] = useState<string>('');

  // Modals state
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [showInitialModal, setShowInitialModal] = useState(false);
  const [showUnidentifiedModal, setShowUnidentifiedModal] = useState(false);

  // Unidentified Payment Form State (Pago por conciliar)
  const [upCurrency, setUpCurrency] = useState<'USD' | 'VES'>('USD');
  const [upAmount, setUpAmount] = useState('');
  const [upMethod, setUpMethod] = useState<string>(PAYMENT_METHODS_BY_CURRENCY.USD[0]);
  const [upReference, setUpReference] = useState('');
  const [upDate, setUpDate] = useState(getTodayCaracas());
  const [upNotes, setUpNotes] = useState('');

  // Reconciliation State
  const [reconcileTarget, setReconcileTarget] = useState<UnidentifiedPayment | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<ClientOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const [voidTarget, setVoidTarget] = useState<UnidentifiedPayment | null>(null);

  // Transfer Form State
  const [transferFrom, setTransferFrom] = useState('binance');
  const [transferTo, setTransferTo] = useState('zelle');
  const [transferAmountFrom, setTransferAmountFrom] = useState('');
  const [transferAmountTo, setTransferAmountTo] = useState('');
  const [transferExchangeRate, setTransferExchangeRate] = useState('');
  const [transferRef, setTransferRef] = useState('');
  const [transferNotes, setTransferNotes] = useState('');

  // Adjustment Form State
  const [adjAccount, setAdjAccount] = useState('zelle');
  const [adjType, setAdjType] = useState<'inflow' | 'outflow'>('outflow');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjReasonPreset, setAdjReasonPreset] = useState(REASON_PRESETS[0]);
  const [adjReasonCustom, setAdjReasonCustom] = useState('');
  const [adjNotes, setAdjNotes] = useState('');

  // Initial Balances Form State
  const [initZelle, setInitZelle] = useState('0');
  const [initBinance, setInitBinance] = useState('0');
  const [initEfectivo, setInitEfectivo] = useState('0');
  const [initBolivares, setInitBolivares] = useState('0');

  // Arqueo / Cierre Form State
  const [zelleActual, setZelleActual] = useState('');
  const [binanceActual, setBinanceActual] = useState('');
  const [efectivoActual, setEfectivoActual] = useState('');
  const [bolivaresActual, setBolivaresActual] = useState('');
  const [cierreNotes, setCierreNotes] = useState('');

  // Fetch Exchange Rates
  const fetchRates = useCallback(async () => {
    try {
      const res = await fetch('/api/rates');
      const data = await res.json();
      if (data.data) {
        setLiveRates({
          usdParallel: data.data.usdParallel || 1.0,
          usdBcv: data.data.usdBcv || 1.0,
        });
      }
    } catch {
      console.warn('Rates endpoint not reachable');
    }
  }, []);

  // Fetch Balances
  const fetchBalances = useCallback(async () => {
    setLoadingBalances(true);
    try {
      const res = await fetch('/api/treasury/balances');
      const data = await res.json();
      if (data.data?.balances) {
        setBalances(data.data.balances);
        const b = data.data.balances;

        // Sync initial balance inputs
        if (b.zelle) setInitZelle(String(b.zelle.initialBalance));
        if (b.binance) setInitBinance(String(b.binance.initialBalance));
        if (b.efectivo) setInitEfectivo(String(b.efectivo.initialBalance));
        if (b.bolivares) setInitBolivares(String(b.bolivares.initialBalance));

        // Pre-fill cierre inputs
        if (b.zelle) setZelleActual(String(b.zelle.currentBalance));
        if (b.binance) setBinanceActual(String(b.binance.currentBalance));
        if (b.efectivo) setEfectivoActual(String(b.efectivo.currentBalance));
        if (b.bolivares) setBolivaresActual(String(b.bolivares.currentBalance));
      }
    } catch {
      addToast('Error al cargar saldos de tesorería', 'error');
    } finally {
      setLoadingBalances(false);
    }
  }, [addToast]);

  // Fetch Movements
  const fetchMovements = useCallback(async () => {
    setLoadingMovements(true);
    try {
      const query = selectedAccountFilter !== 'all' ? `?accountId=${selectedAccountFilter}` : '';
      const res = await fetch(`/api/treasury/movements${query}`);
      const data = await res.json();
      if (data.data) {
        setMovements(data.data);
      }
    } catch {
      addToast('Error al cargar estado de cuenta', 'error');
    } finally {
      setLoadingMovements(false);
    }
  }, [selectedAccountFilter, addToast]);

  // Fetch Transfers
  const fetchTransfers = useCallback(async () => {
    setLoadingTransfers(true);
    try {
      const res = await fetch('/api/treasury/transfers');
      const data = await res.json();
      if (data.data) setTransfers(data.data);
    } catch {
      addToast('Error al cargar historial de transferencias', 'error');
    } finally {
      setLoadingTransfers(false);
    }
  }, [addToast]);

  // Fetch Adjustments
  const fetchAdjustments = useCallback(async () => {
    setLoadingAdjustments(true);
    try {
      const res = await fetch('/api/treasury/adjustments');
      const data = await res.json();
      if (data.data) setAdjustments(data.data);
    } catch {
      addToast('Error al cargar historial de ajustes', 'error');
    } finally {
      setLoadingAdjustments(false);
    }
  }, [addToast]);

  // Fetch Closings
  const fetchClosings = useCallback(async () => {
    setLoadingClosings(true);
    try {
      const res = await fetch('/api/cash-closings');
      const data = await res.json();
      if (data.data) setHistoryClosings(data.data);
    } catch {
      addToast('Error al cargar historial de cierres', 'error');
    } finally {
      setLoadingClosings(false);
    }
  }, [addToast]);

  // Fetch Unidentified Payments (por conciliar)
  const fetchUnidentified = useCallback(async () => {
    setLoadingUnidentified(true);
    try {
      const res = await fetch(`/api/treasury/unidentified?status=${unidentifiedFilter}`);
      const data = await res.json();
      if (data.data) setUnidentified(data.data);
    } catch {
      addToast('Error al cargar pagos por conciliar', 'error');
    } finally {
      setLoadingUnidentified(false);
    }
  }, [unidentifiedFilter, addToast]);

  useEffect(() => {
    fetchBalances();
    fetchRates();
  }, [fetchBalances, fetchRates]);

  useEffect(() => {
    if (activeTab === 'movements') fetchMovements();
    if (activeTab === 'unidentified') fetchUnidentified();
    if (activeTab === 'transfers') fetchTransfers();
    if (activeTab === 'adjustments') fetchAdjustments();
    if (activeTab === 'closings') fetchClosings();
  }, [activeTab, fetchMovements, fetchUnidentified, fetchTransfers, fetchAdjustments, fetchClosings]);

  // Client search for reconciliation (debounced)
  useEffect(() => {
    if (!reconcileTarget || selectedClient) return;
    const timer = setTimeout(async () => {
      setLoadingClients(true);
      try {
        const res = await fetch(`/api/clients?status=active&limit=20&search=${encodeURIComponent(clientSearch.trim())}`);
        const data = await res.json();
        if (data.data) setClientResults(data.data);
      } catch {
        addToast('Error al buscar clientes', 'error');
      } finally {
        setLoadingClients(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [reconcileTarget, selectedClient, clientSearch, addToast]);

  const totalPendingUsd = useMemo(
    () =>
      Object.values(balances)
        .filter((b) => b.currency === 'USD')
        .reduce((sum, b) => sum + (b.pendingReconciliation || 0), 0),
    [balances]
  );
  const totalPendingVes = balances.bolivares?.pendingReconciliation || 0;

  // Auto-calculate cross-currency transfers (USD <-> VES)
  const isCrossCurrencyTransfer = useMemo(() => {
    const fromCurr = balances[transferFrom]?.currency || 'USD';
    const toCurr = balances[transferTo]?.currency || 'USD';
    return fromCurr !== toCurr;
  }, [balances, transferFrom, transferTo]);

  const handleAmountFromChange = (val: string) => {
    setTransferAmountFrom(val);
    const numFrom = parseFloat(val);
    if (!numFrom || isNaN(numFrom)) {
      setTransferAmountTo('');
      return;
    }

    const fromCurr = balances[transferFrom]?.currency || 'USD';
    const toCurr = balances[transferTo]?.currency || 'USD';

    if (fromCurr === toCurr) {
      setTransferAmountTo(val);
      return;
    }

    const rate = parseFloat(transferExchangeRate) || liveRates?.usdParallel || 1.0;
    if (fromCurr === 'USD' && toCurr === 'VES') {
      setTransferAmountTo((numFrom * rate).toFixed(2));
    } else if (fromCurr === 'VES' && toCurr === 'USD') {
      setTransferAmountTo((numFrom / rate).toFixed(2));
    }
  };

  const handleSwapTransferAccounts = () => {
    const prevFrom = transferFrom;
    const prevTo = transferTo;
    setTransferFrom(prevTo);
    setTransferTo(prevFrom);
    if (transferAmountFrom) {
      handleAmountFromChange(transferAmountFrom);
    }
  };

  // Filtered movements for statement tab
  const filteredMovements = useMemo(() => {
    if (!movementSearchQuery.trim()) return movements;
    const q = movementSearchQuery.toLowerCase().trim();
    const TYPE_LABELS: Record<string, string> = {
      cobro: 'cobro ingreso',
      por_conciliar: 'por conciliar ingreso no identificado',
      gasto: 'gasto egreso',
      transfer_in: 'transferencia entrada',
      transfer_out: 'transferencia salida',
    };
    return movements.filter(
      (m) =>
        m.description.toLowerCase().includes(q) ||
        m.accountName.toLowerCase().includes(q) ||
        (m.reference && m.reference.toLowerCase().includes(q)) ||
        (TYPE_LABELS[m.type] || m.type).includes(q) ||
        m.currency.toLowerCase().includes(q) ||
        String(m.amount).includes(q)
    );
  }, [movements, movementSearchQuery]);

  // Export Movements to CSV
  const handleExportCSV = () => {
    if (filteredMovements.length === 0) {
      addToast('No hay movimientos para exportar', 'warning');
      return;
    }

    const headers = ['Fecha', 'Cuenta', 'Tipo', 'Descripcion', 'Referencia', 'Monto', 'Saldo Progresivo'];
    const rows = filteredMovements.map((m) => [
      formatDate(m.date),
      m.accountName,
      m.type,
      `"${m.description.replace(/"/g, '""')}"`,
      `"${(m.reference || '').replace(/"/g, '""')}"`,
      m.amount,
      m.runningBalance,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `estado_de_cuenta_tesoreria_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast('Estado de cuenta exportado a CSV', 'success');
  };

  // Handlers for Forms
  async function handleSaveInitialBalances(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/treasury/balances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initialBalances: {
            zelle: parseFloat(initZelle) || 0,
            binance: parseFloat(initBinance) || 0,
            efectivo: parseFloat(initEfectivo) || 0,
            bolivares: parseFloat(initBolivares) || 0,
          },
        }),
      });
      const data = await res.json();
      if (res.ok) {
        addToast('Saldos iniciales al 01/08/2026 actualizados', 'success');
        setShowInitialModal(false);
        fetchBalances();
        if (activeTab === 'movements') fetchMovements();
      } else {
        addToast(data.error || 'Error al guardar saldos iniciales', 'error');
      }
    } catch {
      addToast('Error de red al actualizar saldos iniciales', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (transferFrom === transferTo) {
      addToast('La cuenta origen y destino deben ser distintas', 'warning');
      return;
    }
    const amtFrom = parseFloat(transferAmountFrom);
    if (!amtFrom || amtFrom <= 0) {
      addToast('El monto a transferir debe ser mayor a cero', 'warning');
      return;
    }

    const fromAcc = balances[transferFrom];
    const toAcc = balances[transferTo];
    const currFrom = fromAcc?.currency || 'USD';
    const currTo = toAcc?.currency || 'USD';

    let amtTo = parseFloat(transferAmountTo);
    if (!amtTo || isNaN(amtTo)) {
      amtTo = amtFrom;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/treasury/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAccountId: transferFrom,
          toAccountId: transferTo,
          amountFrom: amtFrom,
          currencyFrom: currFrom,
          amountTo: amtTo,
          currencyTo: currTo,
          exchangeRate: transferExchangeRate ? parseFloat(transferExchangeRate) : null,
          reference: transferRef,
          notes: transferNotes,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        addToast('Transferencia registrada exitosamente', 'success');
        setShowTransferModal(false);
        setTransferAmountFrom('');
        setTransferAmountTo('');
        setTransferExchangeRate('');
        setTransferRef('');
        setTransferNotes('');
        fetchBalances();
        if (activeTab === 'transfers') fetchTransfers();
        if (activeTab === 'movements') fetchMovements();
      } else {
        addToast(data.error || 'Error al registrar transferencia', 'error');
      }
    } catch {
      addToast('Error de red al registrar transferencia', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateAdjustment(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(adjAmount);
    if (!amt || amt <= 0) {
      addToast('El monto del ajuste debe ser mayor a cero', 'warning');
      return;
    }

    const finalReason = adjReasonPreset === 'Otro motivo' ? adjReasonCustom : adjReasonPreset;
    if (!finalReason.trim()) {
      addToast('El motivo del ajuste es obligatorio', 'warning');
      return;
    }

    const targetAcc = balances[adjAccount];
    const curr = targetAcc?.currency || 'USD';

    setSubmitting(true);
    try {
      const res = await fetch('/api/treasury/adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: adjAccount,
          type: adjType,
          amount: amt,
          currency: curr,
          reason: finalReason.trim(),
          notes: adjNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        addToast('Ajuste de saldo registrado correctamente', 'success');
        setShowAdjustmentModal(false);
        setAdjAmount('');
        setAdjReasonCustom('');
        setAdjNotes('');
        fetchBalances();
        if (activeTab === 'adjustments') fetchAdjustments();
        if (activeTab === 'movements') fetchMovements();
      } else {
        addToast(data.error || 'Error al registrar ajuste de saldo', 'error');
      }
    } catch {
      addToast('Error de red al registrar ajuste', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  function openUnidentifiedModal() {
    setUpCurrency('USD');
    setUpAmount('');
    setUpMethod(PAYMENT_METHODS_BY_CURRENCY.USD[0]);
    setUpReference('');
    setUpDate(getTodayCaracas());
    setUpNotes('');
    setShowUnidentifiedModal(true);
  }

  async function handleCreateUnidentified(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(upAmount);
    if (!amt || amt <= 0) {
      addToast('El monto debe ser mayor a cero', 'warning');
      return;
    }
    if (upCurrency === 'VES' && !upReference.trim()) {
      addToast('La referencia es obligatoria para pagos en bolívares', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/treasury/unidentified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currency: upCurrency,
          amount: amt,
          paymentMethod: upMethod,
          reference: upReference.trim() || undefined,
          paymentDate: Math.floor(new Date(upDate + 'T12:00:00').getTime() / 1000),
          notes: upNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        addToast('Pago por conciliar registrado. Ya suma al saldo de la cuenta.', 'success');
        setShowUnidentifiedModal(false);
        fetchBalances();
        if (activeTab === 'unidentified') fetchUnidentified();
        if (activeTab === 'movements') fetchMovements();
      } else {
        addToast(data.error || 'Error al registrar pago por conciliar', 'error');
      }
    } catch {
      addToast('Error de red al registrar pago por conciliar', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVoidUnidentified() {
    if (!voidTarget) return;
    try {
      const res = await fetch(`/api/treasury/unidentified/${voidTarget.id}/void`, { method: 'PATCH' });
      const data = await res.json();
      if (res.ok) {
        addToast('Pago por conciliar anulado', 'success');
        fetchBalances();
        fetchUnidentified();
      } else {
        addToast(data.error || 'Error al anular', 'error');
      }
    } catch {
      addToast('Error de red al anular', 'error');
    } finally {
      setVoidTarget(null);
    }
  }

  function startReconcile(u: UnidentifiedPayment) {
    setSelectedClient(null);
    setClientSearch('');
    setClientResults([]);
    setReconcileTarget(u);
  }

  function closeReconcile() {
    setReconcileTarget(null);
    setSelectedClient(null);
  }

  async function handleSubmitCierre(e: React.FormEvent) {
    e.preventDefault();
    if (!zelleActual || !binanceActual || !efectivoActual || !bolivaresActual) {
      addToast('Todos los saldos reales son obligatorios', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/cash-closings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zelleActual: parseFloat(zelleActual) || 0,
          binanceActual: parseFloat(binanceActual) || 0,
          efectivoActual: parseFloat(efectivoActual) || 0,
          bolivaresActual: parseFloat(bolivaresActual) || 0,
          notes: cierreNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        addToast('Cierre de caja registrado exitosamente', 'success');
        setCierreNotes('');
        fetchBalances();
        fetchClosings();
      } else {
        addToast(data.error || 'Error al guardar cierre de caja', 'error');
      }
    } catch {
      addToast('Error de red al guardar cierre', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  function formatDiff(diff: number, isVes = false) {
    if (Math.abs(diff) < 0.009) return 'Coincide (0.00)';
    const val = isVes ? formatBs(Math.abs(diff)) : formatCurrency(Math.abs(diff));
    const prefix = diff < 0 ? 'Faltan -' : 'Sobran +';
    return `${prefix}${val}`;
  }

  function getDiffClass(diff: number) {
    if (Math.abs(diff) < 0.009) return styles.diffZero;
    return diff < 0 ? styles.diffShortage : styles.diffSurplus;
  }

  const accountList = [
    { id: 'zelle', name: 'Zelle (USD)' },
    { id: 'binance', name: 'Binance (USD)' },
    { id: 'efectivo', name: 'Efectivo (USD)' },
    { id: 'bolivares', name: 'Bolívares (VES)' },
  ];

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Tesorería y Saldos</h1>
          <p className={styles.subtitle}>
            Saldos reales a partir del 1 de agosto de 2026 · Conciliación, transferencias y ajustes de cuenta
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button variant="secondary" onClick={() => setShowInitialModal(true)}>
            ✏️ Saldos 01/08/2026
          </Button>
          <Button variant="secondary" onClick={openUnidentifiedModal}>
            ❓ Pago por Conciliar
          </Button>
          <Button variant="secondary" onClick={() => setShowTransferModal(true)}>
            🔄 Transferencia
          </Button>
          <Button variant="secondary" onClick={() => setShowAdjustmentModal(true)}>
            ⚙️ Ajuste de Saldo
          </Button>
          <Button variant="primary" onClick={() => setActiveTab('closings')}>
            🔒 Arqueo / Cierre
          </Button>
        </div>
      </div>

      {/* Account Cards Overview */}
      <div className={styles.accountsGrid}>
        {accountList.map((acc) => {
          const b = balances[acc.id];
          const isVes = acc.id === 'bolivares';
          const liveBalance = b ? b.currentBalance : 0;
          const initialBal = b ? b.initialBalance : 0;
          const inflows = b ? b.inflows + b.transfersIn + b.adjustmentsIn : 0;
          const outflows = b ? b.outflows + b.transfersOut + b.adjustmentsOut : 0;

          return (
            <div key={acc.id} className={styles.accountCard}>
              <div>
                <div className={styles.cardHeader}>
                  <span className={styles.accountName}>{acc.name}</span>
                  <span className={`${styles.currencyBadge} ${isVes ? styles.currencyVes : styles.currencyUsd}`}>
                    {isVes ? 'VES' : 'USD'}
                  </span>
                </div>
                <div className={styles.balanceValue}>
                  {loadingBalances ? '...' : isVes ? formatBs(liveBalance) : formatCurrency(liveBalance)}
                </div>

                {/* Quick action buttons per card */}
                <div className={styles.cardQuickActions}>
                  <button
                    className={styles.cardActionBtn}
                    onClick={() => {
                      setTransferFrom(acc.id);
                      setShowTransferModal(true);
                    }}
                    title="Transferir desde esta cuenta"
                  >
                    🔄 Transferir
                  </button>
                  <button
                    className={styles.cardActionBtn}
                    onClick={() => {
                      setAdjAccount(acc.id);
                      setShowAdjustmentModal(true);
                    }}
                    title="Ajustar saldo de esta cuenta"
                  >
                    ⚙️ Ajustar
                  </button>
                  <button
                    className={styles.cardActionBtn}
                    onClick={() => {
                      setSelectedAccountFilter(acc.id);
                      setActiveTab('movements');
                    }}
                    title="Ver extracto de esta cuenta"
                  >
                    📜 Extracto
                  </button>
                </div>
              </div>

              <div className={styles.cardStats}>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Inicial 01/08:</span>
                  <span>{isVes ? formatBs(initialBal) : formatCurrency(initialBal)}</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Entradas (+):</span>
                  <span className={styles.statInflow}>+{isVes ? formatBs(inflows) : formatCurrency(inflows)}</span>
                </div>
                <div className={styles.statItem} style={{ gridColumn: 'span 2' }}>
                  <span className={styles.statLabel}>Salidas (-):</span>
                  <span className={styles.statOutflow}>-{isVes ? formatBs(outflows) : formatCurrency(outflows)}</span>
                </div>
                {b && b.pendingReconciliation > 0 && (
                  <div className={styles.statItem} style={{ gridColumn: 'span 2' }}>
                    <span className={styles.statLabel}>Incluye por conciliar:</span>
                    <span className={styles.statPending}>
                      {isVes ? formatBs(b.pendingReconciliation) : formatCurrency(b.pendingReconciliation)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation Tabs */}
      <div className={styles.tabsContainer}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'movements' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('movements')}
        >
          📊 Estado de Cuentas (Movimientos)
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'unidentified' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('unidentified')}
        >
          ❓ Pagos por Conciliar
          {(totalPendingUsd > 0 || totalPendingVes > 0) && ' •'}
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'transfers' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('transfers')}
        >
          🔄 Transferencias entre Cuentas
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'adjustments' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('adjustments')}
        >
          ⚙️ Ajustes de Saldo
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'closings' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('closings')}
        >
          🔒 Arqueo / Cierre de Caja
        </button>
      </div>

      {/* Tab 1: Movements / Estado de Cuenta */}
      {activeTab === 'movements' && (
        <div className={styles.panelCard}>
          <div className={styles.filterRow}>
            <div className={styles.filterGroup}>
              <span className={styles.label}>Cuenta:</span>
              <select
                className={styles.selectInput}
                value={selectedAccountFilter}
                onChange={(e) => setSelectedAccountFilter(e.target.value)}
              >
                <option value="all">Todas las cuentas</option>
                <option value="zelle">Zelle (USD)</option>
                <option value="binance">Binance (USD)</option>
                <option value="efectivo">Efectivo (USD)</option>
                <option value="bolivares">Bolívares (VES)</option>
              </select>

              <input
                type="text"
                className={styles.searchInput}
                placeholder="🔍 Buscar por descripción, cuenta, referencia, tipo o monto..."
                value={movementSearchQuery}
                onChange={(e) => setMovementSearchQuery(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="secondary" onClick={handleExportCSV}>
                📥 Exportar CSV
              </Button>
              <Button variant="secondary" onClick={fetchMovements} loading={loadingMovements}>
                🔄 Actualizar
              </Button>
            </div>
          </div>

          {loadingMovements ? (
            <div className={styles.loadingWrap}>
              <div className={styles.spinner} />
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className={styles.emptyText}>No se encontraron movimientos registrados en esta cuenta.</div>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Cuenta</th>
                    <th>Tipo</th>
                    <th>Descripción / Referencia</th>
                    <th style={{ textAlign: 'right' }}>Monto</th>
                    <th style={{ textAlign: 'right' }}>Saldo Progresivo</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMovements.map((m) => {
                    const isVes = m.currency === 'VES';
                    const isPositive = m.amount > 0;
                    return (
                      <tr key={m.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{formatDate(m.date)}</td>
                        <td>
                          <strong style={{ fontSize: '13px' }}>{m.accountName}</strong>
                        </td>
                        <td>
                          <span className={styles.badgeReason}>
                            {m.type === 'cobro' && '🟢 Cobro'}
                            {m.type === 'por_conciliar' && '🟡 Por conciliar'}
                            {m.type === 'gasto' && '🔴 Gasto'}
                            {m.type === 'transfer_in' && '📥 Transf. Entrada'}
                            {m.type === 'transfer_out' && '📤 Transf. Salida'}
                            {m.type === 'adjustment_in' && '⚡ Ajuste (+)'}
                            {m.type === 'adjustment_out' && '⚡ Ajuste (-)'}
                          </span>
                        </td>
                        <td>
                          {m.description}
                          {m.reference && (
                            <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginLeft: '6px' }}>
                              (Ref: {m.reference})
                            </span>
                          )}
                        </td>
                        <td className={isPositive ? styles.amountIn : styles.amountOut} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {isPositive ? '+' : ''}
                          {isVes ? formatBs(m.amount) : formatCurrency(m.amount)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                          {isVes ? formatBs(m.runningBalance) : formatCurrency(m.runningBalance)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Pagos por Conciliar */}
      {activeTab === 'unidentified' && (
        <div className={styles.panelCard}>
          <div className={styles.filterRow}>
            <div className={styles.filterGroup}>
              <span className={styles.label}>Mostrar:</span>
              <select
                className={styles.selectInput}
                value={unidentifiedFilter}
                onChange={(e) => setUnidentifiedFilter(e.target.value as 'pending' | 'all')}
              >
                <option value="pending">Solo pendientes</option>
                <option value="all">Todos (incluye conciliados y anulados)</option>
              </select>
              {(totalPendingUsd > 0 || totalPendingVes > 0) && (
                <span className={styles.statPending}>
                  Pendiente: {formatCurrency(totalPendingUsd)}
                  {totalPendingVes > 0 && ` · ${formatBs(totalPendingVes)}`}
                </span>
              )}
            </div>
            <Button variant="primary" onClick={openUnidentifiedModal}>
              + Registrar Pago por Conciliar
            </Button>
          </div>

          {loadingUnidentified ? (
            <div className={styles.loadingWrap}>
              <div className={styles.spinner} />
            </div>
          ) : unidentified.length === 0 ? (
            <div className={styles.emptyText}>
              {unidentifiedFilter === 'pending'
                ? 'No hay pagos pendientes por conciliar.'
                : 'No se han registrado pagos por conciliar.'}
            </div>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Método</th>
                    <th>Referencia / Notas</th>
                    <th style={{ textAlign: 'right' }}>Monto</th>
                    <th>Estado</th>
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {unidentified.map((u) => {
                    const isVes = u.currency === 'VES';
                    return (
                      <tr key={u.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{formatDate(u.paymentDate)}</td>
                        <td><strong>{u.paymentMethod}</strong></td>
                        <td>
                          {u.reference ? `Ref: ${u.reference}` : '—'}
                          {u.notes && (
                            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>{u.notes}</div>
                          )}
                          <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
                            por {u.createdByName || 'Admin'}
                          </div>
                        </td>
                        <td className={styles.amountIn} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          +{isVes ? formatBs(u.amount) : formatCurrency(u.amount)}
                        </td>
                        <td>
                          {u.status === 'pending' && (
                            <span className={`${styles.badgeReason} ${styles.badgePending}`}>Pendiente</span>
                          )}
                          {u.status === 'reconciled' && (
                            <>
                              <span className={`${styles.badgeReason} ${styles.badgeReconciled}`}>Conciliado</span>
                              {u.reconciledClientName && (
                                <div style={{ fontSize: '12px', marginTop: '4px' }}>{u.reconciledClientName}</div>
                              )}
                            </>
                          )}
                          {u.status === 'voided' && (
                            <span className={`${styles.badgeReason} ${styles.badgeVoided}`}>Anulado</span>
                          )}
                        </td>
                        <td>
                          {u.status === 'pending' && (
                            <div className={styles.rowActions}>
                              <button className={styles.cardActionBtn} onClick={() => startReconcile(u)}>
                                🔗 Conciliar
                              </button>
                              <button className={styles.cardActionBtn} onClick={() => setVoidTarget(u)}>
                                ✕ Anular
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Transferencias */}
      {activeTab === 'transfers' && (
        <div className={styles.panelCard}>
          <div className={styles.filterRow}>
            <h3 style={{ margin: 0, fontSize: 'var(--text-base)', color: 'var(--color-text)' }}>
              Historial de Transferencias
            </h3>
            <Button variant="primary" onClick={() => setShowTransferModal(true)}>
              + Nueva Transferencia
            </Button>
          </div>

          {loadingTransfers ? (
            <div className={styles.loadingWrap}>
              <div className={styles.spinner} />
            </div>
          ) : transfers.length === 0 ? (
            <div className={styles.emptyText}>Aún no se han registrado transferencias entre cuentas.</div>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Cuenta Origen</th>
                    <th>Cuenta Destino</th>
                    <th style={{ textAlign: 'right' }}>Monto Débito</th>
                    <th style={{ textAlign: 'right' }}>Monto Crédito</th>
                    <th>Detalles / Registrado Por</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((t) => {
                    const fromAcc = balances[t.fromAccountId]?.name || t.fromAccountId;
                    const toAcc = balances[t.toAccountId]?.name || t.toAccountId;
                    return (
                      <tr key={t.id}>
                        <td>{formatDate(t.transferDate)}</td>
                        <td><strong>{fromAcc}</strong></td>
                        <td><strong>{toAcc}</strong></td>
                        <td style={{ textAlign: 'right', color: 'var(--color-danger)' }}>
                          -{t.currencyFrom === 'VES' ? formatBs(t.amountFrom) : formatCurrency(t.amountFrom)}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--color-success)' }}>
                          +{t.currencyTo === 'VES' ? formatBs(t.amountTo) : formatCurrency(t.amountTo)}
                        </td>
                        <td>
                          {t.notes && <div>{t.notes}</div>}
                          <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                            por {t.createdByName || 'Admin'} {t.reference ? `· Ref: ${t.reference}` : ''}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Ajustes de Saldo */}
      {activeTab === 'adjustments' && (
        <div className={styles.panelCard}>
          <div className={styles.filterRow}>
            <h3 style={{ margin: 0, fontSize: 'var(--text-base)', color: 'var(--color-text)' }}>
              Ajustes de Saldo con Motivo
            </h3>
            <Button variant="primary" onClick={() => setShowAdjustmentModal(true)}>
              + Nuevo Ajuste de Saldo
            </Button>
          </div>

          {loadingAdjustments ? (
            <div className={styles.loadingWrap}>
              <div className={styles.spinner} />
            </div>
          ) : adjustments.length === 0 ? (
            <div className={styles.emptyText}>No hay ajustes de saldo registrados.</div>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Cuenta</th>
                    <th>Tipo</th>
                    <th>Motivo Obligatorio</th>
                    <th style={{ textAlign: 'right' }}>Monto Ajuste</th>
                    <th>Registrado por</th>
                  </tr>
                </thead>
                <tbody>
                  {adjustments.map((a) => {
                    const accName = balances[a.accountId]?.name || a.accountId;
                    const isVes = a.currency === 'VES';
                    const isInflow = a.type === 'inflow';

                    let badgeStyle = styles.badgeReason;
                    if (a.reason.includes('Comisión')) badgeStyle = `${styles.badgeReason} ${styles.badgeComision}`;
                    if (a.reason.includes('diferencial')) badgeStyle = `${styles.badgeReason} ${styles.badgeDiferencial}`;
                    if (a.reason.includes('Rendimiento') || a.reason.includes('Interes')) badgeStyle = `${styles.badgeReason} ${styles.badgeRendimiento}`;

                    return (
                      <tr key={a.id}>
                        <td>{formatDate(a.adjustmentDate)}</td>
                        <td><strong>{accName}</strong></td>
                        <td>
                          <span className={styles.badgeReason}>
                            {isInflow ? '⚡ Ingreso (+)' : '⚡ Egreso (-)'}
                          </span>
                        </td>
                        <td>
                          <span className={badgeStyle}>{a.reason}</span>
                          {a.notes && <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>{a.notes}</div>}
                        </td>
                        <td className={isInflow ? styles.amountIn : styles.amountOut} style={{ textAlign: 'right' }}>
                          {isInflow ? '+' : '-'}{isVes ? formatBs(a.amount) : formatCurrency(a.amount)}
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
                          {a.createdByName || 'Admin'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Arqueo / Cierre de Caja */}
      {activeTab === 'closings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Form */}
          <div className={styles.panelCard}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 'var(--text-lg)', color: 'var(--color-text)' }}>
              Conciliación y Arqueo de Caja Físico
            </h3>

            <form onSubmit={handleSubmitCierre} className={styles.formGrid}>
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Cuenta</th>
                      <th style={{ textAlign: 'right' }}>Saldo Teórico Sistema</th>
                      <th style={{ textAlign: 'right', width: '150px' }}>Saldo Real Físico</th>
                      <th style={{ textAlign: 'right' }}>Diferencia (Sobrante/Faltante)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Zelle */}
                    <tr>
                      <td><strong>Zelle</strong> (USD)</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(balances.zelle?.currentBalance || 0)}</td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          className={styles.cellInput}
                          value={zelleActual}
                          onChange={(e) => setZelleActual(e.target.value)}
                          required
                        />
                      </td>
                      <td style={{ textAlign: 'right' }} className={getDiffClass((parseFloat(zelleActual) || 0) - (balances.zelle?.currentBalance || 0))}>
                        {formatDiff((parseFloat(zelleActual) || 0) - (balances.zelle?.currentBalance || 0))}
                      </td>
                    </tr>
                    {/* Binance */}
                    <tr>
                      <td><strong>Binance</strong> (USD)</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(balances.binance?.currentBalance || 0)}</td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          className={styles.cellInput}
                          value={binanceActual}
                          onChange={(e) => setBinanceActual(e.target.value)}
                          required
                        />
                      </td>
                      <td style={{ textAlign: 'right' }} className={getDiffClass((parseFloat(binanceActual) || 0) - (balances.binance?.currentBalance || 0))}>
                        {formatDiff((parseFloat(binanceActual) || 0) - (balances.binance?.currentBalance || 0))}
                      </td>
                    </tr>
                    {/* Efectivo */}
                    <tr>
                      <td><strong>Efectivo</strong> (USD)</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(balances.efectivo?.currentBalance || 0)}</td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          className={styles.cellInput}
                          value={efectivoActual}
                          onChange={(e) => setEfectivoActual(e.target.value)}
                          required
                        />
                      </td>
                      <td style={{ textAlign: 'right' }} className={getDiffClass((parseFloat(efectivoActual) || 0) - (balances.efectivo?.currentBalance || 0))}>
                        {formatDiff((parseFloat(efectivoActual) || 0) - (balances.efectivo?.currentBalance || 0))}
                      </td>
                    </tr>
                    {/* Bolívares */}
                    <tr>
                      <td><strong>Bolívares</strong> (VES)</td>
                      <td style={{ textAlign: 'right' }}>{formatBs(balances.bolivares?.currentBalance || 0)}</td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          className={styles.cellInput}
                          value={bolivaresActual}
                          onChange={(e) => setBolivaresActual(e.target.value)}
                          required
                        />
                      </td>
                      <td style={{ textAlign: 'right' }} className={getDiffClass((parseFloat(bolivaresActual) || 0) - (balances.bolivares?.currentBalance || 0))}>
                        {formatDiff((parseFloat(bolivaresActual) || 0) - (balances.bolivares?.currentBalance || 0), true)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Notas u Observaciones del Arqueo</label>
                <textarea
                  className={styles.textarea}
                  rows={2}
                  placeholder="Observaciones sobre sobrantes, faltantes o notas del arqueo..."
                  value={cierreNotes}
                  onChange={(e) => setCierreNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button type="submit" loading={submitting}>
                  🔒 Guardar Cierre de Caja
                </Button>
              </div>
            </form>
          </div>

          {/* History */}
          <div className={styles.panelCard}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 'var(--text-base)', color: 'var(--color-text)' }}>
              Historial de Cierres Guardados
            </h3>
            {loadingClosings ? (
              <div className={styles.loadingWrap}>
                <div className={styles.spinner} />
              </div>
            ) : historyClosings.length === 0 ? (
              <div className={styles.emptyText}>No hay cierres registrados.</div>
            ) : (
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Cerrado por</th>
                      <th style={{ textAlign: 'right' }}>Zelle Real</th>
                      <th style={{ textAlign: 'right' }}>Binance Real</th>
                      <th style={{ textAlign: 'right' }}>Efectivo Real</th>
                      <th style={{ textAlign: 'right' }}>Bolívares Real</th>
                      <th>Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyClosings.map((c) => (
                      <tr key={c.id}>
                        <td>{formatDate(c.closingDate)}</td>
                        <td>{c.closedByName || 'Admin'}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(c.zelleActual)}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(c.binanceActual)}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(c.efectivoActual)}</td>
                        <td style={{ textAlign: 'right' }}>{formatBs(c.bolivaresActual)}</td>
                        <td style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{c.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Transferencia entre Cuentas */}
      {showTransferModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>🔄 Nueva Transferencia entre Cuentas</h3>
            <form onSubmit={handleCreateTransfer} className={styles.formGrid}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label className={styles.label}>Cuenta Origen</label>
                  <select
                    className={styles.selectInput}
                    value={transferFrom}
                    onChange={(e) => {
                      setTransferFrom(e.target.value);
                      if (transferAmountFrom) handleAmountFromChange(transferAmountFrom);
                    }}
                  >
                    {accountList.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  className={styles.swapBtn}
                  onClick={handleSwapTransferAccounts}
                  title="Intercambiar origen y destino"
                >
                  ⇄
                </button>

                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label className={styles.label}>Cuenta Destino</label>
                  <select
                    className={styles.selectInput}
                    value={transferTo}
                    onChange={(e) => {
                      setTransferTo(e.target.value);
                      if (transferAmountFrom) handleAmountFromChange(transferAmountFrom);
                    }}
                  >
                    {accountList.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Cross currency helper notification */}
              {isCrossCurrencyTransfer && (
                <div className={styles.rateHelperBox}>
                  <span>💱 Transferencia entre USD y Bolívares</span>
                  <span>Tasa Paralelo: <strong>{liveRates?.usdParallel || 'Tasa del día'} Bs/USD</strong></span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: isCrossCurrencyTransfer ? '1fr 1fr 1fr' : '1fr 1fr', gap: '12px' }}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    Monto Origen ({balances[transferFrom]?.currency || 'USD'})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className={styles.input}
                    placeholder="Monto a debitar"
                    value={transferAmountFrom}
                    onChange={(e) => handleAmountFromChange(e.target.value)}
                    required
                  />
                </div>

                {isCrossCurrencyTransfer && (
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Tasa de Cambio</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className={styles.input}
                      placeholder={String(liveRates?.usdParallel || 1.0)}
                      value={transferExchangeRate}
                      onChange={(e) => {
                        setTransferExchangeRate(e.target.value);
                        if (transferAmountFrom) handleAmountFromChange(transferAmountFrom);
                      }}
                    />
                  </div>
                )}

                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    Monto Destino ({balances[transferTo]?.currency || 'USD'})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className={styles.input}
                    placeholder="Monto a acreditar"
                    value={transferAmountTo}
                    onChange={(e) => setTransferAmountTo(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Referencia / Comprobante (Opcional)</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Ej. Ref #123456"
                  value={transferRef}
                  onChange={(e) => setTransferRef(e.target.value)}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Notas / Justificación</label>
                <textarea
                  className={styles.textarea}
                  rows={2}
                  placeholder="Notas adicionales..."
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                />
              </div>

              <div className={styles.modalFooter}>
                <Button variant="secondary" type="button" onClick={() => setShowTransferModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit" loading={submitting}>
                  Confirmar Transferencia
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Ajuste de Saldo con Motivo */}
      {showAdjustmentModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>⚙️ Nuevo Ajuste de Saldo</h3>
            <form onSubmit={handleCreateAdjustment} className={styles.formGrid}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Cuenta a Ajustar</label>
                  <select
                    className={styles.selectInput}
                    value={adjAccount}
                    onChange={(e) => setAdjAccount(e.target.value)}
                  >
                    {accountList.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Tipo de Ajuste</label>
                  <select
                    className={styles.selectInput}
                    value={adjType}
                    onChange={(e) => setAdjType(e.target.value as 'inflow' | 'outflow')}
                  >
                    <option value="outflow">Egreso / Restar (-)</option>
                    <option value="inflow">Ingreso / Sumar (+)</option>
                  </select>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Monto del Ajuste</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className={styles.input}
                  placeholder="Ej. 15.50"
                  value={adjAmount}
                  onChange={(e) => setAdjAmount(e.target.value)}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Motivo Obligatorio del Ajuste</label>
                <select
                  className={styles.selectInput}
                  value={adjReasonPreset}
                  onChange={(e) => setAdjReasonPreset(e.target.value)}
                >
                  {REASON_PRESETS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {adjReasonPreset === 'Otro motivo' && (
                <div className={styles.formGroup}>
                  <label className={styles.label}>Especificar Razón / Motivo</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="Escribe la razón detallada..."
                    value={adjReasonCustom}
                    onChange={(e) => setAdjReasonCustom(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className={styles.formGroup}>
                <label className={styles.label}>Notas Adicionales (Opcional)</label>
                <textarea
                  className={styles.textarea}
                  rows={2}
                  placeholder="Detalles sobre este ajuste..."
                  value={adjNotes}
                  onChange={(e) => setAdjNotes(e.target.value)}
                />
              </div>

              <div className={styles.modalFooter}>
                <Button variant="secondary" type="button" onClick={() => setShowAdjustmentModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit" loading={submitting}>
                  Guardar Ajuste
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Registrar Pago por Conciliar */}
      {showUnidentifiedModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>❓ Registrar Pago por Conciliar</h3>
            <p className={styles.subtitle} style={{ marginBottom: '12px' }}>
              Usa esto cuando recibes dinero y aún no sabes de qué cliente es. Suma de inmediato al saldo de la cuenta y
              luego podrás asignarlo a un cliente desde la pestaña &quot;Pagos por Conciliar&quot;.
            </p>
            <form onSubmit={handleCreateUnidentified} className={styles.formGrid}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Moneda</label>
                  <select
                    className={styles.selectInput}
                    value={upCurrency}
                    onChange={(e) => {
                      const curr = e.target.value as 'USD' | 'VES';
                      setUpCurrency(curr);
                      setUpMethod(PAYMENT_METHODS_BY_CURRENCY[curr][0]);
                    }}
                  >
                    <option value="USD">Dólares (USD)</option>
                    <option value="VES">Bolívares (VES)</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Método / Cuenta</label>
                  <select
                    className={styles.selectInput}
                    value={upMethod}
                    onChange={(e) => setUpMethod(e.target.value)}
                  >
                    {PAYMENT_METHODS_BY_CURRENCY[upCurrency].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Monto ({upCurrency})</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className={styles.input}
                    placeholder="0.00"
                    value={upAmount}
                    onChange={(e) => setUpAmount(e.target.value)}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Fecha de Recepción</label>
                  <input
                    type="date"
                    className={styles.input}
                    value={upDate}
                    onChange={(e) => setUpDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Referencia {upCurrency === 'VES' ? '(Obligatoria)' : '(Opcional)'}
                </label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Ej. 123456"
                  value={upReference}
                  onChange={(e) => setUpReference(e.target.value)}
                  required={upCurrency === 'VES'}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Notas / Pistas del Origen (Opcional)</label>
                <textarea
                  className={styles.textarea}
                  rows={2}
                  placeholder="Ej. Zelle a nombre de María P., banco Mercantil..."
                  value={upNotes}
                  onChange={(e) => setUpNotes(e.target.value)}
                />
              </div>

              <div className={styles.modalFooter}>
                <Button variant="secondary" type="button" onClick={() => setShowUnidentifiedModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit" loading={submitting}>
                  Registrar Ingreso
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Seleccionar cliente para conciliar */}
      {reconcileTarget && !selectedClient && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>🔗 Conciliar Pago</h3>
            <p className={styles.subtitle} style={{ marginBottom: '12px' }}>
              {reconcileTarget.paymentMethod} ·{' '}
              <strong>
                {reconcileTarget.currency === 'VES'
                  ? formatBs(reconcileTarget.amount)
                  : formatCurrency(reconcileTarget.amount)}
              </strong>{' '}
              · {formatDate(reconcileTarget.paymentDate)}
              {reconcileTarget.reference && ` · Ref: ${reconcileTarget.reference}`}
            </p>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.label}>¿A qué cliente pertenece?</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="🔍 Buscar por nombre, clínica o email..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  autoFocus
                />
              </div>

              {loadingClients ? (
                <div className={styles.loadingWrap}>
                  <div className={styles.spinner} />
                </div>
              ) : clientResults.length === 0 ? (
                <div className={styles.emptyText}>No se encontraron clientes.</div>
              ) : (
                <div className={styles.clientList}>
                  {clientResults.map((c) => (
                    <button key={c.id} type="button" className={styles.clientOption} onClick={() => setSelectedClient(c)}>
                      <strong>{c.name}</strong>
                      {c.clinicName && <span className={styles.clientOptionMeta}>{c.clinicName}</span>}
                    </button>
                  ))}
                </div>
              )}

              <div className={styles.modalFooter}>
                <Button variant="secondary" type="button" onClick={closeReconcile}>
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Registrar el pago del cliente (FIFO / manual) a partir del ingreso por conciliar */}
      {reconcileTarget && selectedClient && (
        <PaymentModal
          isOpen
          onClose={closeReconcile}
          clientId={selectedClient.id}
          clientName={selectedClient.name}
          unidentifiedPayment={reconcileTarget}
          onSuccess={() => {
            fetchBalances();
            fetchUnidentified();
          }}
        />
      )}

      <ConfirmDialog
        isOpen={!!voidTarget}
        title="Anular pago por conciliar"
        message="El monto dejará de sumar al saldo de la cuenta. Úsalo solo si el ingreso fue un error o se devolvió. ¿Continuar?"
        confirmLabel="Sí, anular"
        variant="danger"
        onConfirm={handleVoidUnidentified}
        onCancel={() => setVoidTarget(null)}
      />

      {/* Modal: Configurar Saldos Iniciales al 01/08/2026 */}
      {showInitialModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>✏️ Saldos Iniciales (01 de Agosto de 2026)</h3>
            <p className={styles.subtitle} style={{ marginBottom: '12px' }}>
              Define el saldo con el que abrió cada cuenta el 01/08/2026. A partir de este saldo se suman y restan los cobros y pagos.
            </p>
            <form onSubmit={handleSaveInitialBalances} className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Zelle (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  className={styles.input}
                  value={initZelle}
                  onChange={(e) => setInitZelle(e.target.value)}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Binance (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  className={styles.input}
                  value={initBinance}
                  onChange={(e) => setInitBinance(e.target.value)}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Efectivo (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  className={styles.input}
                  value={initEfectivo}
                  onChange={(e) => setInitEfectivo(e.target.value)}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Bolívares (VES)</label>
                <input
                  type="number"
                  step="0.01"
                  className={styles.input}
                  value={initBolivares}
                  onChange={(e) => setInitBolivares(e.target.value)}
                  required
                />
              </div>

              <div className={styles.modalFooter}>
                <Button variant="secondary" type="button" onClick={() => setShowInitialModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit" loading={submitting}>
                  Guardar Saldos Iniciales
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
