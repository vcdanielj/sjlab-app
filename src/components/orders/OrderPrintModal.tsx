// ============================================
// SJ Lab — Order Print Preview Modal
// Fetches the order, previews the Letter sheet and prints it.
// ============================================

'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';
import {
  OrderPrintDocument,
  OrderPrintData,
  OrderDetailResponse,
  toOrderPrintData,
} from './OrderPrintDocument';
import styles from './order-print.module.css';

interface OrderPrintModalProps {
  orderId: string;
  onClose: () => void;
}

export function OrderPrintModal({ orderId, onClose }: OrderPrintModalProps) {
  const [data, setData] = useState<OrderPrintData | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Print host div created lazily (SSR-safe) and mounted under <body>
  const [printHost] = useState<HTMLElement | null>(() => {
    if (typeof document === 'undefined') return null;
    const host = document.createElement('div');
    host.className = 'order-print-root';
    return host;
  });

  // Print isolation: dedicated host under <body> + body class while modal is open
  useEffect(() => {
    if (!printHost) return;
    document.body.appendChild(printHost);
    document.body.classList.add('order-printing');
    return () => {
      document.body.classList.remove('order-printing');
      printHost.remove();
    };
  }, [printHost]);

  // Load order detail + exchange rate (best effort)
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const orderRes = await fetch(`/api/orders/${orderId}`);
        const orderJson = await orderRes.json();
        if (!orderRes.ok || !orderJson.data) {
          throw new Error(orderJson.error || 'Error al cargar el pedido');
        }

        let bsRate: number | null = null;
        try {
          const ratesRes = await fetch('/api/rates');
          if (ratesRes.ok) {
            const ratesJson = await ratesRes.json();
            const rate = ratesJson?.data?.usdBcv;
            if (typeof rate === 'number' && rate > 0) bsRate = rate;
          }
        } catch {
          // Rates are optional; the document prints without Bs conversion
        }

        if (!cancelled) {
          setData(toOrderPrintData(orderJson.data as OrderDetailResponse, bsRate));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error al cargar el pedido');
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [orderId]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <>
      <div className={styles.modalOverlay} onClick={onClose}>
        <div
          className={styles.modalCard}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Vista previa de impresión"
        >
          <div className={styles.modalHeader}>
            <div>
              <h3 className={styles.modalTitle}>Vista previa de impresión</h3>
              <p className={styles.modalSubtitle}>
                Hoja Carta · Copia Laboratorio (arriba) y Copia Cliente (abajo)
              </p>
            </div>
            <div className={styles.modalActions}>
              <Button variant="secondary" onClick={onClose}>Cerrar</Button>
              <Button onClick={() => window.print()} disabled={!data}>
                🖨️ Imprimir ahora
              </Button>
            </div>
          </div>
          <div className={styles.modalBody}>
            {error && <div className={`${styles.modalStatus} ${styles.modalError}`}>{error}</div>}
            {!error && !data && <div className={styles.modalStatus}>Cargando pedido…</div>}
            {data && <OrderPrintDocument data={data} origin={origin} />}
          </div>
        </div>
      </div>

      {/* Print-only copy rendered directly under <body> */}
      {printHost && data && createPortal(
        <OrderPrintDocument data={data} origin={origin} />,
        printHost
      )}
    </>
  );
}
