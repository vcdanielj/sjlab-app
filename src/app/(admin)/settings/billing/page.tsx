// ============================================
// SJ Lab — Billing Settings Page
// ============================================

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import styles from './page.module.css';

export default function BillingSettingsPage() {
  const { addToast } = useToast();
  const [frequency, setFrequency] = useState<string>('weekly');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    fetch('/api/settings/billing')
      .then((res) => res.json())
      .then((data) => {
        if (data.data?.frequency) {
          setFrequency(data.data.frequency);
        }
      })
      .catch(() => addToast('Error al cargar configuración de cobro', 'error'))
      .finally(() => setLoading(false));
  }, [addToast]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/settings/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frequency }),
      });
      const data = await res.json();
      if (res.ok) {
        addToast('Frecuencia de cobranza guardada con éxito', 'success');
      } else {
        addToast(data.error || 'Error al guardar', 'error');
      }
    } catch {
      addToast('Error de red al guardar configuración', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Link href="/settings" className={styles.backBtn}>
        ← Volver a Configuración
      </Link>
      
      <h1 className={styles.title}>Frecuencia de Cobranza</h1>
      <p className={styles.subtitle}>Configura el intervalo para los recordatorios de pago automáticos.</p>

      {loading ? (
        <div className={styles.card} style={{ textAlign: 'center', padding: '2rem' }}>
          Cargando configuración...
        </div>
      ) : (
        <div className={styles.card}>
          <form onSubmit={handleSave} className={styles.form}>
            <div>
              <label htmlFor="frequency" className={styles.label}>
                Frecuencia del Cobro Automático
              </label>
              <select
                id="frequency"
                className={styles.select}
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
              >
                <option value="daily">Diario (Todos los días a las 8:00 AM)</option>
                <option value="weekly">Semanal (Todos los viernes a las 8:00 AM)</option>
                <option value="fortnightly">Quincenal (Días 15 y 30 de cada mes a las 8:00 AM)</option>
              </select>
            </div>

            <div className={styles.description}>
              {frequency === 'daily' && (
                <p style={{ margin: 0 }}>
                  El sistema evaluará diariamente las cuentas de todos los clientes activos. A aquellos que tengan deudas pendientes se les enviará su recordatorio de estado de cuenta.
                </p>
              )}
              {frequency === 'weekly' && (
                <p style={{ margin: 0 }}>
                  El sistema evaluará únicamente los **viernes** a las 8:00 AM las cuentas de los clientes. Se enviará el recordatorio a quienes tengan deudas pendientes.
                </p>
              )}
              {frequency === 'fortnightly' && (
                <p style={{ margin: 0 }}>
                  El sistema evaluará las cuentas los **días 15 y 30** de cada mes a las 8:00 AM y enviará los correos de cobranza a los deudores activos.
                </p>
              )}
            </div>

            <div className={styles.actions}>
              <Button type="submit" loading={saving}>
                Guardar Configuración
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
