// ============================================
// SJ Lab — Caja / Cierre Page (Arqueo de Caja)
// ============================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { formatCurrency, formatDate, formatBs } from '@/lib/utils';
import { CashClosing } from '@/types';
import styles from './page.module.css';

interface AccountCalculation {
  start: number;
  inflows: number;
  outflows: number;
  expected: number;
}

interface CalculateResponse {
  periodStart: number;
  periodEnd: number;
  lastClosingDate: number | null;
  lastClosingId: string | null;
  balances: {
    zelle: AccountCalculation;
    binance: AccountCalculation;
    efectivo: AccountCalculation;
    bolivares: AccountCalculation;
  };
}

export default function CajaCierrePage() {
  const { addToast } = useToast();

  const [loadingCalc, setLoadingCalc] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [calcData, setCalcData] = useState<CalculateResponse | null>(null);
  const [history, setHistory] = useState<CashClosing[]>([]);

  // Input states for physical cash count
  const [zelleActual, setZelleActual] = useState('');
  const [binanceActual, setBinanceActual] = useState('');
  const [efectivoActual, setEfectivoActual] = useState('');
  const [bolivaresActual, setBolivaresActual] = useState('');
  const [notes, setNotes] = useState('');

  const fetchCalculation = useCallback(async () => {
    setLoadingCalc(true);
    try {
      const res = await fetch('/api/cash-closings/calculate');
      const data = await res.json();
      if (data.data) {
        setCalcData(data.data);
        // Pre-fill inputs with expected values to ease user entry
        setZelleActual(String(data.data.balances.zelle.expected));
        setBinanceActual(String(data.data.balances.binance.expected));
        setEfectivoActual(String(data.data.balances.efectivo.expected));
        setBolivaresActual(String(data.data.balances.bolivares.expected));
      } else {
        addToast(data.error || 'Error al calcular saldos', 'error');
      }
    } catch {
      addToast('Error de red al calcular saldos', 'error');
    } finally {
      setLoadingCalc(false);
    }
  }, [addToast]);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/cash-closings');
      const data = await res.json();
      if (data.data) {
        setHistory(data.data);
      }
    } catch {
      addToast('Error al cargar historial de cierres', 'error');
    } finally {
      setLoadingHistory(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchCalculation();
    fetchHistory();
  }, [fetchCalculation, fetchHistory]);

  async function handleSubmitCierre(e: React.FormEvent) {
    e.preventDefault();

    if (
      zelleActual.trim() === '' ||
      binanceActual.trim() === '' ||
      efectivoActual.trim() === '' ||
      bolivaresActual.trim() === ''
    ) {
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
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        addToast('Cierre de caja registrado exitosamente', 'success');
        setNotes('');
        await fetchCalculation();
        await fetchHistory();
      } else {
        addToast(data.error || 'Error al guardar cierre de caja', 'error');
      }
    } catch {
      addToast('Error de red al guardar el cierre', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  function getDiffClass(diff: number) {
    if (Math.abs(diff) < 0.009) return styles.diffZero;
    return diff < 0 ? styles.diffShortage : styles.diffSurplus;
  }

  function formatDiff(diff: number, isVes = false) {
    if (Math.abs(diff) < 0.009) return 'Coincide (0.00)';
    const val = isVes ? formatBs(Math.abs(diff)) : formatCurrency(Math.abs(diff));
    const prefix = diff < 0 ? 'Faltan -' : 'Sobran +';
    return `${prefix}${val}`;
  }

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Caja / Cierre</h1>
          <p className={styles.subtitle}>Realiza arqueos de caja periódicos y concilia las cuentas del laboratorio</p>
        </div>
      </div>

      <div className={styles.grid}>
        {/* Reconciliation Form Panel */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            <span>Conciliación del Periodo</span>
            {calcData && (
              <span className={styles.dateRangeText}>
                Desde: {calcData.lastClosingDate ? formatDate(calcData.lastClosingDate) : 'Inicio'} · Hasta: Hoy
              </span>
            )}
          </div>

          {loadingCalc ? (
            <div className={styles.loadingWrap}>
              <div className={styles.spinner} />
              <p style={{ marginTop: '12px', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                Calculando ingresos y egresos del periodo...
              </p>
            </div>
          ) : !calcData ? (
            <p>No se pudieron calcular los datos del arqueo de caja.</p>
          ) : (
            <form onSubmit={handleSubmitCierre} className={styles.formArea}>
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Cuenta</th>
                      <th style={{ textAlign: 'right' }}>Saldo Inicial</th>
                      <th style={{ textAlign: 'right' }}>Ingresos (+)</th>
                      <th style={{ textAlign: 'right' }}>Egresos (-)</th>
                      <th style={{ textAlign: 'right' }}>Saldo Teórico</th>
                      <th style={{ textAlign: 'right', width: '140px' }}>Saldo Real Físico</th>
                      <th style={{ textAlign: 'right' }}>Diferencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Zelle Row */}
                    <tr>
                      <td>
                        <span className={styles.accountName}>Zelle</span>
                        <span className={styles.accountCurrency}>USD</span>
                      </td>
                      <td className={`${styles.cellNumberRight} ${styles.cellNumber}`}>{formatCurrency(calcData.balances.zelle.start)}</td>
                      <td className={`${styles.cellNumberRight} ${styles.cellNumber}`} style={{ color: 'var(--color-success)' }}>+{formatCurrency(calcData.balances.zelle.inflows)}</td>
                      <td className={`${styles.cellNumberRight} ${styles.cellNumber}`} style={{ color: 'var(--color-danger)' }}>-{formatCurrency(calcData.balances.zelle.outflows)}</td>
                      <td className={`${styles.cellNumberRight} ${styles.cellNumber}`} style={{ fontWeight: 'bold' }}>{formatCurrency(calcData.balances.zelle.expected)}</td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className={styles.cellInput}
                          value={zelleActual}
                          onChange={(e) => setZelleActual(e.target.value)}
                          required
                        />
                      </td>
                      <td className={`${styles.cellNumberRight} ${getDiffClass((parseFloat(zelleActual) || 0) - calcData.balances.zelle.expected)}`}>
                        {formatDiff((parseFloat(zelleActual) || 0) - calcData.balances.zelle.expected)}
                      </td>
                    </tr>

                    {/* Binance Row */}
                    <tr>
                      <td>
                        <span className={styles.accountName}>Binance</span>
                        <span className={styles.accountCurrency}>USD</span>
                      </td>
                      <td className={`${styles.cellNumberRight} ${styles.cellNumber}`}>{formatCurrency(calcData.balances.binance.start)}</td>
                      <td className={`${styles.cellNumberRight} ${styles.cellNumber}`} style={{ color: 'var(--color-success)' }}>+{formatCurrency(calcData.balances.binance.inflows)}</td>
                      <td className={`${styles.cellNumberRight} ${styles.cellNumber}`} style={{ color: 'var(--color-danger)' }}>-{formatCurrency(calcData.balances.binance.outflows)}</td>
                      <td className={`${styles.cellNumberRight} ${styles.cellNumber}`} style={{ fontWeight: 'bold' }}>{formatCurrency(calcData.balances.binance.expected)}</td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className={styles.cellInput}
                          value={binanceActual}
                          onChange={(e) => setBinanceActual(e.target.value)}
                          required
                        />
                      </td>
                      <td className={`${styles.cellNumberRight} ${getDiffClass((parseFloat(binanceActual) || 0) - calcData.balances.binance.expected)}`}>
                        {formatDiff((parseFloat(binanceActual) || 0) - calcData.balances.binance.expected)}
                      </td>
                    </tr>

                    {/* Efectivo Row */}
                    <tr>
                      <td>
                        <span className={styles.accountName}>Efectivo</span>
                        <span className={styles.accountCurrency}>USD</span>
                      </td>
                      <td className={`${styles.cellNumberRight} ${styles.cellNumber}`}>{formatCurrency(calcData.balances.efectivo.start)}</td>
                      <td className={`${styles.cellNumberRight} ${styles.cellNumber}`} style={{ color: 'var(--color-success)' }}>+{formatCurrency(calcData.balances.efectivo.inflows)}</td>
                      <td className={`${styles.cellNumberRight} ${styles.cellNumber}`} style={{ color: 'var(--color-danger)' }}>-{formatCurrency(calcData.balances.efectivo.outflows)}</td>
                      <td className={`${styles.cellNumberRight} ${styles.cellNumber}`} style={{ fontWeight: 'bold' }}>{formatCurrency(calcData.balances.efectivo.expected)}</td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className={styles.cellInput}
                          value={efectivoActual}
                          onChange={(e) => setEfectivoActual(e.target.value)}
                          required
                        />
                      </td>
                      <td className={`${styles.cellNumberRight} ${getDiffClass((parseFloat(efectivoActual) || 0) - calcData.balances.efectivo.expected)}`}>
                        {formatDiff((parseFloat(efectivoActual) || 0) - calcData.balances.efectivo.expected)}
                      </td>
                    </tr>

                    {/* Bolívares Row */}
                    <tr>
                      <td>
                        <span className={styles.accountName}>Bolívares</span>
                        <span className={styles.accountCurrency}>VES</span>
                      </td>
                      <td className={`${styles.cellNumberRight} ${styles.cellNumber}`}>{formatBs(calcData.balances.bolivares.start)}</td>
                      <td className={`${styles.cellNumberRight} ${styles.cellNumber}`} style={{ color: 'var(--color-success)' }}>+{formatBs(calcData.balances.bolivares.inflows)}</td>
                      <td className={`${styles.cellNumberRight} ${styles.cellNumber}`} style={{ color: 'var(--color-danger)' }}>-{formatBs(calcData.balances.bolivares.outflows)}</td>
                      <td className={`${styles.cellNumberRight} ${styles.cellNumber}`} style={{ fontWeight: 'bold' }}>{formatBs(calcData.balances.bolivares.expected)}</td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className={styles.cellInput}
                          value={bolivaresActual}
                          onChange={(e) => setBolivaresActual(e.target.value)}
                          required
                        />
                      </td>
                      <td className={`${styles.cellNumberRight} ${getDiffClass((parseFloat(bolivaresActual) || 0) - calcData.balances.bolivares.expected)}`}>
                        {formatDiff((parseFloat(bolivaresActual) || 0) - calcData.balances.bolivares.expected, true)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div>
                <label className={styles.subtitle} style={{ display: 'block', marginBottom: '6px', fontWeight: 'var(--weight-semibold)' }}>
                  Notas / Observaciones del Cierre
                </label>
                <textarea
                  className={styles.textarea}
                  placeholder="Escribe comentarios sobre las discrepancias (sobrantes/faltantes) u observaciones generales del arqueo..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                <Button type="submit" loading={submitting}>
                  🔒 Registrar Cierre de Caja
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* History Panel */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Historial de Cierres</h3>

          {loadingHistory ? (
            <div className={styles.loadingWrap}>
              <div className={styles.spinner} />
            </div>
          ) : history.length === 0 ? (
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', textAlign: 'center', padding: '24px 0' }}>
              Aún no se han registrado cierres de caja.
            </p>
          ) : (
            <div className={styles.historyList}>
              {history.map((c) => (
                <div key={c.id} className={styles.historyItem}>
                  <div className={styles.historyTop}>
                    <span className={styles.historyDate}>{formatDate(c.closingDate)}</span>
                    <span className={styles.historyUser}>por {c.closedByName || 'Admin'}</span>
                  </div>
                  
                  <div className={styles.historyGrid}>
                    <div className={styles.historyDetailRow}>
                      <span className={styles.historyDetailLabel}>Zelle (USD)</span>
                      <span className={styles.historyDetailValue} style={{ color: c.zelleActual === c.zelleExpected ? 'inherit' : 'var(--color-danger)' }}>
                        {formatCurrency(c.zelleActual)}
                        {c.zelleActual !== c.zelleExpected && (
                          <span style={{ fontSize: '10px', marginLeft: '4px' }}>
                            ({c.zelleActual > c.zelleExpected ? 'sobra +' : 'falta -'}{formatCurrency(Math.abs(c.zelleActual - c.zelleExpected))})
                          </span>
                        )}
                      </span>
                    </div>

                    <div className={styles.historyDetailRow}>
                      <span className={styles.historyDetailLabel}>Binance (USD)</span>
                      <span className={styles.historyDetailValue} style={{ color: c.binanceActual === c.binanceExpected ? 'inherit' : 'var(--color-danger)' }}>
                        {formatCurrency(c.binanceActual)}
                        {c.binanceActual !== c.binanceExpected && (
                          <span style={{ fontSize: '10px', marginLeft: '4px' }}>
                            ({c.binanceActual > c.binanceExpected ? 'sobra +' : 'falta -'}{formatCurrency(Math.abs(c.binanceActual - c.binanceExpected))})
                          </span>
                        )}
                      </span>
                    </div>

                    <div className={styles.historyDetailRow}>
                      <span className={styles.historyDetailLabel}>Efectivo (USD)</span>
                      <span className={styles.historyDetailValue} style={{ color: c.efectivoActual === c.efectivoExpected ? 'inherit' : 'var(--color-danger)' }}>
                        {formatCurrency(c.efectivoActual)}
                        {c.efectivoActual !== c.efectivoExpected && (
                          <span style={{ fontSize: '10px', marginLeft: '4px' }}>
                            ({c.efectivoActual > c.efectivoExpected ? 'sobra +' : 'falta -'}{formatCurrency(Math.abs(c.efectivoActual - c.efectivoExpected))})
                          </span>
                        )}
                      </span>
                    </div>

                    <div className={styles.historyDetailRow}>
                      <span className={styles.historyDetailLabel}>Bolívares (VES)</span>
                      <span className={styles.historyDetailValue} style={{ color: c.bolivaresActual === c.bolivaresExpected ? 'inherit' : 'var(--color-danger)' }}>
                        {formatBs(c.bolivaresActual)}
                        {c.bolivaresActual !== c.bolivaresExpected && (
                          <span style={{ fontSize: '10px', marginLeft: '4px' }}>
                            ({c.bolivaresActual > c.bolivaresExpected ? 'sobra +' : 'falta -'}{formatBs(Math.abs(c.bolivaresActual - c.bolivaresExpected))})
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {c.notes && <p className={styles.historyNotes}>{c.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
