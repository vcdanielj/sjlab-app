// ============================================
// SJ Lab — Payment Registration Modal
// ============================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { formatCurrency } from '@/lib/utils';
import { PAYMENT_METHODS_BY_CURRENCY } from '@/lib/constants';
import { fetchRatesWithCache } from '@/lib/rates-client';
import styles from './payment-modal.module.css';

interface AllocationPreview {
  orderId: string;
  orderNumber: number;
  patientName: string;
  finalPriceUsd: number;
  amountPaidUsd: number;
  allocatedAmountUsd: number;
}

interface PendingOrder {
  id: string;
  orderNumber: number;
  patientName: string;
  finalPriceUsd: number;
  amountPaidUsd: number;
}

interface PreviewData {
  allocations: AllocationPreview[];
  surplusUsd: number;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  onSuccess: () => void;
  targetOrderId?: string;
  targetOrderNumber?: number;
  targetOrderRemainingUsd?: number;
}

export function PaymentModal({
  isOpen,
  onClose,
  clientId,
  clientName,
  onSuccess,
  targetOrderId,
  targetOrderNumber,
  targetOrderRemainingUsd,
}: PaymentModalProps) {
  const { addToast } = useToast();

  const [currency, setCurrency] = useState<'USD' | 'VES'>('USD');
  const [amount, setAmount] = useState<string>('');
  const [exchangeRate, setExchangeRate] = useState<string>('');
  const [appliedExchangeRateType, setAppliedExchangeRateType] = useState<'USD_PARALLEL' | 'USD_BCV' | 'EUR_BCV' | 'MANUAL'>('USD_PARALLEL');
  const [dailyRates, setDailyRates] = useState<{ usdParallel: number; usdBcv: number; eurBcv: number } | null>(null);
  const [loadingRates, setLoadingRates] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [reference, setReference] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Preview & Distribution States
  const [distMode, setDistMode] = useState<'fifo' | 'manual'>('fifo');
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [manualAllocations, setManualAllocations] = useState<Record<string, string>>({});

  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);

  // Set today's date on open (using Caracas timezone to prevent date desyncs)
  useEffect(() => {
    if (isOpen) {
      const getCaracasDateString = () => {
        try {
          const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Caracas',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          });
          return formatter.format(new Date());
        } catch {
          return new Date().toISOString().split('T')[0];
        }
      };

      const timer = setTimeout(() => {
        setPaymentDate(getCaracasDateString());
        // Reset fields
        setCurrency('USD');
        setAmount('');
        setExchangeRate('');
        setAppliedExchangeRateType('USD_PARALLEL');
        setPaymentMethod('');
        setReference('');
        setPreview(null);
        setDistMode('fifo');
        setManualAllocations({});
        setPendingOrders([]);

        // Fetch pending orders for manual mode
        if (!targetOrderId) {
          fetch(`/api/payments/preview?clientId=${clientId}`)
            .then((res) => res.json())
            .then((data) => {
              if (data.data?.pendingOrders) {
                setPendingOrders(data.data.pendingOrders);
              }
            })
            .catch(() => {});
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, clientId, targetOrderId]);

  // Fetch exchange rates for the selected date
  useEffect(() => {
    if (isOpen && paymentDate) {
      const timer = setTimeout(() => {
        setLoadingRates(true);
        fetchRatesWithCache(paymentDate)
          .then((rates) => {
            setDailyRates(rates);
          })
          .catch((err) => console.error('Error fetching rates:', err))
          .finally(() => setLoadingRates(false));
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, paymentDate]);

  // Update exchange rate value when dailyRates completes loading
  useEffect(() => {
    if (dailyRates) {
      const timer = setTimeout(() => {
        if (appliedExchangeRateType === 'USD_PARALLEL') {
          setExchangeRate(String(dailyRates.usdParallel));
        } else if (appliedExchangeRateType === 'USD_BCV') {
          setExchangeRate(String(dailyRates.usdBcv));
        } else if (appliedExchangeRateType === 'EUR_BCV') {
          setExchangeRate(String(dailyRates.eurBcv));
        } else if (appliedExchangeRateType === 'MANUAL') {
          setExchangeRate('');
        }
      }, 0);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyRates]);

  // Calculate Commercial USD and Real USD
  const getDualAmounts = useCallback(() => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return { commercialUsd: 0, realUsd: 0 };

    const numRate = parseFloat(exchangeRate) || 1.0;
    const parallelRate = dailyRates?.usdParallel || 1.0;

    if (currency === 'VES') {
      const commercialUsd = Number((numAmount / numRate).toFixed(2));
      const realUsd = Number((numAmount / parallelRate).toFixed(2));
      return { commercialUsd, realUsd };
    } else {
      const commercialUsd = numAmount;
      const realUsd = Number(((numAmount * numRate) / parallelRate).toFixed(2));
      return { commercialUsd, realUsd };
    }
  }, [amount, currency, exchangeRate, dailyRates]);

  const { commercialUsd, realUsd } = getDualAmounts();
  const amountUsd = commercialUsd;

  // Fetch FIFO allocation preview
  useEffect(() => {
    if (!isOpen || amountUsd <= 0 || targetOrderId) {
      const timer = setTimeout(() => {
        setPreview(null);
      }, 0);
      return () => clearTimeout(timer);
    }

    const delayDebounce = setTimeout(async () => {
      setLoadingPreview(true);
      try {
        const res = await fetch(
          `/api/payments/preview?clientId=${clientId}&amountUsd=${amountUsd}`
        );
        const data = await res.json();
        if (res.ok && data.data) {
          setPreview(data.data);
          if (data.data.pendingOrders) {
            setPendingOrders(data.data.pendingOrders);
          }
        } else {
          setPreview(null);
        }
      } catch {
        setPreview(null);
      } finally {
        setLoadingPreview(false);
      }
    }, 450); // Debounce to avoid querying on every keystroke

    return () => clearTimeout(delayDebounce);
  }, [isOpen, clientId, amountUsd, targetOrderId]);

  // Handle currency toggle to select default payment method
  const handleCurrencyChange = (val: 'USD' | 'VES') => {
    setCurrency(val);
    setPaymentMethod('');
    setReference('');
    if (val === 'USD') {
      setExchangeRate('');
    }
  };

  const getManualAllocationsTotal = () => {
    return Object.values(manualAllocations).reduce((sum, val) => {
      const parsed = parseFloat(val);
      return sum + (isNaN(parsed) || parsed < 0 ? 0 : parsed);
    }, 0);
  };
  const totalAllocated = getManualAllocationsTotal();
  const surplusUsd = Number((amountUsd - totalAllocated).toFixed(2));

  const handleSave = async () => {
    // Validate inputs
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      addToast('Ingresa un monto válido mayor a cero', 'warning');
      return;
    }

    if (currency === 'VES') {
      const numRate = parseFloat(exchangeRate);
      if (isNaN(numRate) || numRate <= 0) {
        addToast('Ingresa una tasa de cambio válida', 'warning');
        return;
      }
      if (!reference.trim()) {
        addToast('La referencia es obligatoria para pagos en bolívares', 'warning');
        return;
      }
    }

    if (!paymentMethod) {
      addToast('Selecciona el método de pago', 'warning');
      return;
    }

    if (!paymentDate) {
      addToast('Selecciona la fecha del pago', 'warning');
      return;
    }

    if (!targetOrderId && distMode === 'manual') {
      if (totalAllocated > amountUsd + 0.005) {
        addToast('El total asignado supera el monto del pago', 'warning');
        return;
      }
      // Check for each order
      for (const [orderId, val] of Object.entries(manualAllocations)) {
        const valNum = parseFloat(val);
        if (isNaN(valNum) || valNum <= 0) continue;
        const order = pendingOrders.find((o) => o.id === orderId);
        if (order) {
          const remaining = order.finalPriceUsd - order.amountPaidUsd;
          if (valNum > remaining + 0.01) {
            addToast(`El monto asignado al Pedido #${order.orderNumber} supera su saldo pendiente`, 'warning');
            return;
          }
        }
      }
    }

    // Double confirmation for payments > $100 USD
    if (amountUsd > 100) {
      setShowPaymentConfirm(true);
      return;
    }

    await executePayment();
  };

  const executePayment = async () => {
    setShowPaymentConfirm(false);
    setLoading(true);
    try {
      const parsedDate = Math.floor(new Date(paymentDate + 'T12:00:00').getTime() / 1000);

      let allocationsPayload: { orderId: string; amountUsd: number }[] | undefined = undefined;

      if (targetOrderId) {
        // Direct allocation mode
        allocationsPayload = [
          {
            orderId: targetOrderId,
            amountUsd: Number(Math.min(targetOrderRemainingUsd || 0, amountUsd).toFixed(2)),
          },
        ];
      } else if (distMode === 'manual') {
        // Manual allocation mode
        allocationsPayload = Object.entries(manualAllocations)
          .map(([orderId, val]) => ({
            orderId,
            amountUsd: parseFloat(val),
          }))
          .filter((a) => !isNaN(a.amountUsd) && a.amountUsd > 0);
      }

      const payload = {
        clientId,
        currency,
        amount: parseFloat(amount),
        appliedExchangeRateType,
        exchangeRate: parseFloat(exchangeRate) || undefined,
        paymentMethod,
        reference: reference.trim() || undefined,
        paymentDate: parsedDate,
        orderAllocations: allocationsPayload,
      };

      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        addToast(
          targetOrderId
            ? 'Pago registrado y aplicado al pedido con éxito'
            : 'Pago registrado y distribuido con éxito',
          'success'
        );
        onSuccess();
        onClose();
      } else {
        addToast(data.error || 'Error al guardar el pago', 'error');
      }
    } catch {
      addToast('Error de red al registrar el pago', 'error');
    } finally {
      setLoading(false);
    }
  };

  const methods = PAYMENT_METHODS_BY_CURRENCY[currency] || [];

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Registrar Pago / Cobro"
        size="lg"
        footer={
          <div className={styles.footerButtons}>
            <Button variant="secondary" size="md" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button size="md" onClick={handleSave} loading={loading}>
              Confirmar Pago
            </Button>
          </div>
        }
      >
        <div className={styles.modalBody}>
          <p className={styles.intro}>
            Registrando cobro para: <strong>{clientName}</strong>
          </p>

          {/* Currency Switcher */}
          <div className={styles.row}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Moneda</label>
              <div className={styles.tabs}>
                <button
                  type="button"
                  className={`${styles.tab} ${currency === 'USD' ? styles.tabActive : ''}`}
                  onClick={() => handleCurrencyChange('USD')}
                >
                  Dólares (USD $)
                </button>
                <button
                  type="button"
                  className={`${styles.tab} ${currency === 'VES' ? styles.tabActive : ''}`}
                  onClick={() => handleCurrencyChange('VES')}
                >
                  Bolívares (VES Bs.)
                </button>
              </div>
            </div>
          </div>

          {/* Bimonetary Inputs */}
          <div className={styles.grid3Col}>
            <Input
              label={currency === 'USD' ? 'Monto en USD' : 'Monto en VES'}
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />

            <Select
              label="Tipo de Tasa"
              value={appliedExchangeRateType}
              onChange={(e) => {
                const type = e.target.value as 'USD_PARALLEL' | 'USD_BCV' | 'EUR_BCV' | 'MANUAL';
                setAppliedExchangeRateType(type);
                if (dailyRates) {
                  if (type === 'USD_PARALLEL') setExchangeRate(String(dailyRates.usdParallel));
                  else if (type === 'USD_BCV') setExchangeRate(String(dailyRates.usdBcv));
                  else if (type === 'EUR_BCV') setExchangeRate(String(dailyRates.eurBcv));
                  else if (type === 'MANUAL') setExchangeRate('');
                }
              }}
              disabled={loadingRates}
            >
              <option value="USD_PARALLEL">USD Paralelo {dailyRates?.usdParallel ? `(${dailyRates.usdParallel})` : ''}</option>
              <option value="USD_BCV">USD BCV {dailyRates?.usdBcv ? `(${dailyRates.usdBcv})` : ''}</option>
              <option value="EUR_BCV">EUR BCV {dailyRates?.eurBcv ? `(${dailyRates.eurBcv})` : ''}</option>
              <option value="MANUAL">Manual</option>
            </Select>

            <Input
              label="Valor de la Tasa (Bs./$)"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={exchangeRate}
              onChange={(e) => {
                if (appliedExchangeRateType === 'MANUAL') {
                  setExchangeRate(e.target.value);
                }
              }}
              disabled={appliedExchangeRateType !== 'MANUAL' || loadingRates}
            />
          </div>

          {/* Dual Math Info Card */}
          {amount && parseFloat(amount) > 0 && (
            <div className={styles.rateCalculationAlert} style={{ marginTop: '1rem', padding: '1rem', borderRadius: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <span style={{ fontSize: '0.85rem', color: '#6B7280', display: 'block', marginBottom: '0.25rem' }}>Dólar Comercial (Amortiza CxC)</span>
                  <strong style={{ fontSize: '1.25rem', color: '#2563EB' }}>{formatCurrency(commercialUsd)} USD</strong>
                  <span style={{ fontSize: '0.75rem', color: '#9CA3AF', display: 'block', marginTop: '0.25rem' }}>
                    Tasa Aplicada: {appliedExchangeRateType} ({parseFloat(exchangeRate || '1').toFixed(2)} Bs./$)
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '0.85rem', color: '#6B7280', display: 'block', marginBottom: '0.25rem' }}>Dólar Real (Consolidado Neto)</span>
                  <strong style={{ fontSize: '1.25rem', color: '#10B981' }}>{formatCurrency(realUsd)} USD</strong>
                  <span style={{ fontSize: '0.75rem', color: '#9CA3AF', display: 'block', marginTop: '0.25rem' }}>
                    Tasa Paralelo (Real): USD_PARALLEL ({dailyRates?.usdParallel || '—'} Bs./$)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Payment Details */}
          <div className={styles.grid3Col}>
            <Select
              label="Método de Pago"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              placeholder="Seleccionar..."
            >
              {methods.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>

            <Input
              label="Referencia"
              type="text"
              placeholder={currency === 'VES' ? 'Obligatorio (ej. 12345)' : 'Opcional'}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />

            <Input
              label="Fecha del Pago"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>

          {/* Distribution Mode (for global payments) */}
          {!targetOrderId && amountUsd > 0 && pendingOrders.length > 0 && (
            <div className={styles.row}>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Método de Distribución</label>
                <div className={styles.tabs}>
                  <button
                    type="button"
                    className={`${styles.tab} ${distMode === 'fifo' ? styles.tabActive : ''}`}
                    onClick={() => setDistMode('fifo')}
                  >
                    Automático (FIFO)
                  </button>
                  <button
                    type="button"
                    className={`${styles.tab} ${distMode === 'manual' ? styles.tabActive : ''}`}
                    onClick={() => setDistMode('manual')}
                  >
                    Asignación Manual
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* FIFO Distribution Preview */}
          {!targetOrderId && distMode === 'fifo' && (
            <div className={styles.previewSection}>
              <h3 className={styles.previewTitle}>Previsualización FIFO (Distribución de Saldos)</h3>

              {loadingPreview && (
                <div className={styles.previewPlaceholder}>
                  <div className={styles.spinner} />
                  <span>Calculando distribución en tiempo real...</span>
                </div>
              )}

              {!loadingPreview && !preview && amountUsd <= 0 && (
                <div className={styles.previewPlaceholder}>
                  Ingresa un monto para ver a qué pedidos se aplicará el abono.
                </div>
              )}

              {!loadingPreview && !preview && amountUsd > 0 && (
                <div className={styles.previewPlaceholder}>
                  No hay pedidos pendientes. El monto completo quedará como saldo a favor del cliente.
                </div>
              )}

              {!loadingPreview && preview && (
                <div className={styles.previewContent}>
                  {preview.allocations.length === 0 ? (
                    <div className={styles.noAllocationsAlert}>
                      El cliente no tiene deudas pendientes. Todo el abono (
                      <strong>{formatCurrency(preview.surplusUsd)} USD</strong>) quedará disponible como{' '}
                      <span className={styles.surplusText}>Saldo a Favor</span> para futuros pedidos.
                    </div>
                  ) : (
                    <>
                      <div className={styles.tableContainer}>
                        <table className={styles.previewTable}>
                          <thead>
                            <tr>
                              <th>Pedido #</th>
                              <th>Paciente</th>
                              <th>Precio</th>
                              <th>Abonado</th>
                              <th className={styles.alignRight}>Se Amortiza</th>
                            </tr>
                          </thead>
                          <tbody>
                            {preview.allocations.map((alloc) => (
                              <tr key={alloc.orderId}>
                                <td className={styles.orderNum}>{alloc.orderNumber}</td>
                                <td>{alloc.patientName}</td>
                                <td>{formatCurrency(alloc.finalPriceUsd)}</td>
                                <td>{formatCurrency(alloc.amountPaidUsd)}</td>
                                <td className={`${styles.alignRight} ${styles.allocatedText}`}>
                                  +{formatCurrency(alloc.allocatedAmountUsd)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {preview.surplusUsd > 0 && (
                        <div className={styles.surplusContainer}>
                          <span>Excedente (Saldo a Favor del cliente):</span>
                          <strong className={styles.surplusValue}>
                            {formatCurrency(preview.surplusUsd)} USD
                          </strong>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Manual Allocation Table */}
          {!targetOrderId && distMode === 'manual' && (
            <div className={styles.previewSection}>
              <h3 className={styles.previewTitle}>Asignación Manual de Saldos</h3>

              {amountUsd <= 0 ? (
                <div className={styles.previewPlaceholder}>
                  Ingresa un monto para poder asignar saldo a los pedidos pendientes.
                </div>
              ) : pendingOrders.length === 0 ? (
                <div className={styles.previewPlaceholder}>
                  No hay pedidos pendientes para este cliente. Todo el abono quedará como Saldo a Favor.
                </div>
              ) : (
                <>
                  <div className={styles.tableContainer}>
                    <table className={styles.previewTable}>
                      <thead>
                        <tr>
                          <th>Pedido #</th>
                          <th>Paciente</th>
                          <th>Precio</th>
                          <th>Abonado</th>
                          <th>Saldo</th>
                          <th className={styles.alignRight} style={{ width: '170px' }}>Asignar USD</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingOrders.map((order) => {
                          const remaining = order.finalPriceUsd - order.amountPaidUsd;
                          const allocatedVal = manualAllocations[order.id] || '';
                          return (
                            <tr key={order.id}>
                              <td className={styles.orderNum}>{order.orderNumber}</td>
                              <td>{order.patientName}</td>
                              <td>{formatCurrency(order.finalPriceUsd)}</td>
                              <td>{formatCurrency(order.amountPaidUsd)}</td>
                              <td>{formatCurrency(remaining)}</td>
                              <td className={styles.alignRight}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max={remaining}
                                    className={styles.allocationInput}
                                    placeholder="0.00"
                                    value={allocatedVal}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setManualAllocations((prev) => ({
                                        ...prev,
                                        [order.id]: val,
                                      }));
                                    }}
                                  />
                                  <button
                                    type="button"
                                    className={styles.maxBtn}
                                    onClick={() => {
                                      const currentTotalWithoutThis = Object.entries(manualAllocations)
                                        .filter(([id]) => id !== order.id)
                                        .reduce((sum, [, v]) => sum + (parseFloat(v) || 0), 0);
                                      const capacityLeft = Math.max(0, amountUsd - currentTotalWithoutThis);
                                      const maxToAllocate = Number(Math.min(remaining, capacityLeft).toFixed(2));
                                      setManualAllocations((prev) => ({
                                        ...prev,
                                        [order.id]: maxToAllocate.toString(),
                                      }));
                                    }}
                                  >
                                    Max
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className={styles.manualAllocSummary}>
                    <div className={styles.summaryItem}>
                      <span>Total Asignado:</span>
                      <strong className={totalAllocated > amountUsd + 0.005 ? styles.valueWarning : ''}>
                        {formatCurrency(totalAllocated)} USD
                      </strong>
                    </div>
                    <div className={styles.summaryItem}>
                      <span>Excedente (Saldo a Favor del cliente):</span>
                      <strong className={styles.surplusValue}>
                        {formatCurrency(surplusUsd)} USD
                      </strong>
                    </div>
                  </div>

                  {totalAllocated > amountUsd + 0.005 && (
                    <div className={styles.errorAlert}>
                      El total asignado supera el monto del pago por {formatCurrency(totalAllocated - amountUsd)}.
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Specific Order Direct Allocation */}
          {targetOrderId && (
            <div className={styles.previewSection}>
              <h3 className={styles.previewTitle}>Asignación Exclusiva</h3>
              <div className={styles.noAllocationsAlert} style={{ background: 'rgba(59, 130, 246, 0.05)', borderColor: 'rgba(59, 130, 246, 0.15)', color: 'var(--color-text)' }}>
                Este pago se aplicará exclusivamente al **Pedido #{targetOrderNumber}**.
              </div>

              {amountUsd > 0 && (
                <>
                  <div className={styles.tableContainer} style={{ marginTop: '12px' }}>
                    <table className={styles.previewTable}>
                      <thead>
                        <tr>
                          <th>Pedido #</th>
                          <th>Saldo Actual</th>
                          <th>Abono Aplicado</th>
                          <th className={styles.alignRight}>Nuevo Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className={styles.orderNum}>{targetOrderNumber}</td>
                          <td>{formatCurrency(targetOrderRemainingUsd || 0)}</td>
                          <td className={styles.allocatedText}>
                            +{formatCurrency(Math.min(targetOrderRemainingUsd || 0, amountUsd))}
                          </td>
                          <td className={styles.alignRight} style={{ fontWeight: 'bold' }}>
                            {formatCurrency(Math.max(0, Number(((targetOrderRemainingUsd || 0) - amountUsd).toFixed(2))))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {amountUsd > (targetOrderRemainingUsd || 0) && (
                    <div className={styles.surplusContainer}>
                      <span>Excedente (Saldo a Favor del cliente):</span>
                      <strong className={styles.surplusValue}>
                        {formatCurrency(amountUsd - (targetOrderRemainingUsd || 0))} USD
                      </strong>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Confirm large payment */}
      <ConfirmDialog
        isOpen={showPaymentConfirm}
        title="Confirmar pago grande"
        message={`El pago equivale a ${formatCurrency(amountUsd)} USD. ¿Estás seguro de registrar este cobro?`}
        confirmLabel="Sí, registrar pago"
        variant="danger"
        onConfirm={executePayment}
        onCancel={() => setShowPaymentConfirm(false)}
      />
    </>
  );
}
