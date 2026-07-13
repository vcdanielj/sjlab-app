'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { ClientCombobox } from '@/components/ui/ClientCombobox';
import { useToast } from '@/components/ui/Toast';
import { formatCurrency } from '@/lib/utils';
import {
  getOrderColorOption,
  ORDER_COLOR_OPTIONS,
  ORDER_COLOR_STANDARDS,
  OrderColorStandard,
} from '@/lib/order-colors';
import styles from './page.module.css';

interface Client {
  id: string;
  name: string;
  clinicName: string | null;
}

interface Product {
  id: string;
  name: string;
  details: string | null;
  suggestedPriceUsd: number;
  workflowId: string;
  isActive: boolean;
  workflow: { name: string } | null;
}

interface CategoryGroup {
  id: string;
  name: string;
  products: Product[];
}

interface JobDraft {
  productId: string;
  notes: string;
}

export default function CreateOrderPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // Form
  const [clientId, setClientId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [jobs, setJobs] = useState<JobDraft[]>([
    { productId: '', notes: '' },
  ]);
  const [price, setPrice] = useState('');
  const [color, setColor] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [colorModalOpen, setColorModalOpen] = useState(false);
  const [activeColorStandard, setActiveColorStandard] = useState<OrderColorStandard>('vita-classical');

  const fetchData = useCallback(async () => {
    try {
      const [clientsRes, productsRes] = await Promise.all([
        fetch('/api/clients?limit=200&status=active'),
        fetch('/api/products'),
      ]);
      const [clientsData, productsData] = await Promise.all([
        clientsRes.json(),
        productsRes.json(),
      ]);
      if (clientsData.data) setClients(clientsData.data);
      if (productsData.data) setGroups(productsData.data);
    } catch {
      addToast('Error al cargar datos', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function findProduct(id: string): Product | undefined {
    for (const group of groups) {
      const product = group.products.find((item) => item.id === id);
      if (product) return product;
    }
    return undefined;
  }

  function getCategoryNameForProduct(productId: string): string | null {
    const group = groups.find((item) => item.products.some((product) => product.id === productId));
    return group?.name || null;
  }

  function recalculateSuggestedPrice(nextJobs: JobDraft[]) {
    const total = nextJobs.reduce((sum, job) => {
      const product = findProduct(job.productId);
      return sum + (product?.suggestedPriceUsd || 0);
    }, 0);
    if (total > 0) {
      setPrice(String(total.toFixed(2)));
    }
  }

  function updateJob(index: number, updater: (job: JobDraft) => JobDraft) {
    setJobs((prev) => {
      const next = prev.map((job, currentIndex) => (
        currentIndex === index ? updater(job) : job
      ));
      return next;
    });
  }

  function handleJobProductChange(index: number, id: string) {
    setJobs((prev) => {
      const next = prev.map((job, currentIndex) => (
        currentIndex === index ? { ...job, productId: id } : job
      ));
      recalculateSuggestedPrice(next);
      return next;
    });
  }

  function addJob() {
    setJobs((prev) => [
      ...prev,
      { productId: '', notes: '' },
    ]);
  }

  function removeJob(index: number) {
    setJobs((prev) => {
      const next = prev.filter((_, currentIndex) => currentIndex !== index);
      recalculateSuggestedPrice(next);
      return next.length > 0
        ? next
        : [{ productId: '', notes: '' }];
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!clientId || !price) {
      addToast('Cliente y precio son requeridos', 'warning');
      return;
    }

    if (jobs.length === 0) {
      addToast('Debe agregar al menos un trabajo de prótesis', 'warning');
      return;
    }

    const invalidJob = jobs.findIndex((job) => {
      if (!job.productId) return true;
      return false;
    });

    if (invalidJob >= 0) {
      addToast(`Revise el trabajo #${invalidJob + 1}: faltan datos obligatorios`, 'warning');
      return;
    }

    const finalPrice = parseFloat(price);
    if (isNaN(finalPrice) || finalPrice < 0) {
      addToast('El precio debe ser un número válido', 'warning');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          items: jobs.map((job) => ({
            productId: job.productId,
            notes: job.notes.trim() || undefined,
          })),
          patientName: patientName.trim() || undefined,
          color: color || undefined,
          finalPriceUsd: finalPrice,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error, 'error');
        return;
      }
      addToast(`Pedido #${data.data.orderNumber} creado`, 'success');
      router.push('/orders');
    } catch {
      addToast('Error al crear pedido', 'error');
    } finally {
      setSaving(false);
    }
  }

  const selectedColor = getOrderColorOption(color);
  const visibleColors = ORDER_COLOR_OPTIONS.filter((option) => option.standard === activeColorStandard);

  if (loading) {
    return <div><h1 className={styles.title}>Cargando...</h1></div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.push('/orders')}>
          ← Volver
        </button>
        <h1 className={styles.title}>Nuevo Pedido</h1>
        <p className={styles.subtitle}>Registrar un pedido de laboratorio</p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.topGrid}>
          <div className={styles.fieldSpanTwo}>
            <ClientCombobox
              clients={clients}
              value={clientId}
              onChange={setClientId}
              onClientCreated={(c) => setClients((prev) => [...prev, c])}
            />
          </div>

          <Input
            label="Paciente"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            placeholder="Nombre del paciente (opcional)"
          />

          <Input
            label="Precio Final (USD) *"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
            required
          />
        </div>

        <div className={styles.jobsSection}>
          <div className={styles.jobsHeader}>
            <div>
              <h3 className={styles.jobsTitle}>Trabajos de Prótesis</h3>
              <p className={styles.jobsSubtitle}>Puedes agrupar varias prótesis del mismo pedido, incluso de categorías distintas.</p>
            </div>
            <Button type="button" size="sm" variant="secondary" onClick={addJob}>
              + Agregar Trabajo
            </Button>
          </div>

          <div className={styles.jobsList}>
            {jobs.map((job, index) => {
              const selectedProduct = findProduct(job.productId);
              const categoryName = getCategoryNameForProduct(job.productId);

              return (
                <div key={`${index}-${job.productId || 'empty'}`} className={styles.jobCard}>
                  <div className={styles.jobCardHeader}>
                    <span className={styles.jobCardTitle}>Trabajo #{index + 1}</span>
                    {jobs.length > 1 && (
                      <button
                        type="button"
                        className={styles.removeJobBtn}
                        onClick={() => removeJob(index)}
                      >
                        Eliminar
                      </button>
                    )}
                  </div>

                  <Select
                    label="Prótesis *"
                    value={job.productId}
                    onChange={(e) => handleJobProductChange(index, e.target.value)}
                    required
                  >
                    <option value="">Seleccionar prótesis...</option>
                    {groups.map((group) => (
                      <optgroup key={group.id} label={group.name}>
                        {group.products.filter((product) => product.isActive !== false).map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name}{product.details ? ` (${product.details})` : ''} — {formatCurrency(product.suggestedPriceUsd)}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </Select>

                  <div className={styles.jobMetaRow}>
                    <span className={styles.jobMetaLabel}>Categoría clínica</span>
                    <span className={styles.jobMetaValue}>{categoryName || 'Sin categoría'}</span>
                  </div>

                  {selectedProduct?.workflow?.name && (
                    <div className={styles.jobMetaRow}>
                      <span className={styles.jobMetaLabel}>Flujo</span>
                      <span className={styles.jobMetaValue}>{selectedProduct.workflow.name}</span>
                    </div>
                  )}

                  <div className={styles.notesField}>
                    <label className={styles.label}>Notas del trabajo (opcional)</label>
                    <textarea
                      className={styles.textarea}
                      value={job.notes}
                      onChange={(e) => updateJob(index, (current) => ({ ...current, notes: e.target.value }))}
                      placeholder="Indicaciones específicas para este trabajo"
                      rows={2}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.colorField}>
          <label className={styles.label}>Color (opcional)</label>
          <button
            type="button"
            className={styles.colorSelector}
            onClick={() => setColorModalOpen(true)}
          >
            <span className={styles.colorSelectorMain}>
              <span
                className={styles.colorSwatch}
                style={{ backgroundColor: selectedColor?.hex || '#F3F4F6' }}
              />
              <span className={styles.colorSelectorText}>
                {selectedColor
                  ? `${selectedColor.code} · ${selectedColor.name}`
                  : 'Seleccionar color'}
              </span>
            </span>
            <span className={styles.colorSelectorStandard}>
              {selectedColor
                ? ORDER_COLOR_STANDARDS.find((standard) => standard.value === selectedColor.standard)?.label
                : 'Vita Classical'}
            </span>
          </button>
          {selectedColor && (
            <div className={styles.colorActions}>
              <span className={styles.colorPreview}>
                {ORDER_COLOR_STANDARDS.find((standard) => standard.value === selectedColor.standard)?.label} · {selectedColor.hex}
              </span>
              <button
                type="button"
                className={styles.clearColorBtn}
                onClick={() => setColor('')}
              >
                Quitar color
              </button>
            </div>
          )}
        </div>

        <div className={styles.notesField}>
          <label className={styles.label}>Notas (opcional)</label>
          <textarea
            className={styles.textarea}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Instrucciones especiales, observaciones..."
            rows={3}
          />
        </div>

        <div className={styles.formActions}>
          <Button variant="secondary" type="button" onClick={() => router.push('/orders')}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Crear Pedido
          </Button>
        </div>
      </form>

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
              {visibleColors.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.colorOption} ${color === option.value ? styles.colorOptionActive : ''}`}
                  onClick={() => {
                    setColor(option.value);
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
                  setColor('');
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
