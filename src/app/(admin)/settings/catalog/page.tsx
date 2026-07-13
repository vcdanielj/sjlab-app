'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { formatCurrency } from '@/lib/utils';
import styles from './page.module.css';

interface Workflow {
  id: string;
  name: string;
  isActive: boolean;
}

interface Product {
  id: string;
  name: string;
  details: string | null;
  suggestedPriceUsd: number;
  workflowId: string;
  categoryId: string | null;
  isActive: boolean;
  workflow: Workflow | null;
}

interface CategoryGroup {
  id: string;
  name: string;
  sortOrder: number;
  products: Product[];
}

interface Category {
  id: string;
  name: string;
  sortOrder: number;
}

export default function CatalogPage() {
  const { addToast } = useToast();
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCat, setExpandedCat] = useState<Set<string>>(new Set());

  // Product modal
  const [showProduct, setShowProduct] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [pName, setPName] = useState('');
  const [pCategory, setPCategory] = useState('');
  const [pWorkflow, setPWorkflow] = useState('');
  const [pDetails, setPDetails] = useState('');
  const [pPrice, setPPrice] = useState('');
  const [saving, setSaving] = useState(false);

  // Category modal
  const [showCategory, setShowCategory] = useState(false);
  const [catName, setCatName] = useState('');
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [savingCat, setSavingCat] = useState(false);

  // Confirm dialogs
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'product' | 'category'; id: string; name: string } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [productsRes, workflowsRes, catsRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/workflows'),
        fetch('/api/categories'),
      ]);
      const [productsData, workflowsData, catsData] = await Promise.all([
        productsRes.json(),
        workflowsRes.json(),
        catsRes.json(),
      ]);
      if (productsData.data) setGroups(productsData.data);
      if (workflowsData.data) setWorkflows(workflowsData.data);
      if (catsData.data) setCategories(catsData.data);
    } catch {
      addToast('Error al cargar datos', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function toggleCategory(catId: string) {
    setExpandedCat((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }

  function openProductModal(product?: Product) {
    if (product) {
      setEditProduct(product);
      setPName(product.name);
      setPCategory(product.categoryId || '');
      setPWorkflow(product.workflowId);
      setPDetails(product.details || '');
      setPPrice(String(product.suggestedPriceUsd));
    } else {
      setEditProduct(null);
      setPName('');
      setPCategory('');
      setPWorkflow('');
      setPDetails('');
      setPPrice('');
    }
    setShowProduct(true);
  }

  async function handleSaveProduct() {
    if (!pName.trim() || !pWorkflow || !pPrice) {
      addToast('Nombre, flujo y precio son requeridos', 'warning');
      return;
    }

    const price = parseFloat(pPrice);
    if (isNaN(price) || price < 0) {
      addToast('El precio debe ser un número válido', 'warning');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: pName,
        categoryId: pCategory || null,
        workflowId: pWorkflow,
        details: pDetails || null,
        suggestedPriceUsd: price,
      };

      const url = editProduct ? `/api/products/${editProduct.id}` : '/api/products';
      const method = editProduct ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error, 'error');
        return;
      }

      await fetchData();
      setShowProduct(false);
      addToast(editProduct ? 'Producto actualizado' : 'Producto creado', 'success');
    } catch {
      addToast('Error al guardar producto', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProduct(id: string) {
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchData();
        addToast('Producto desactivado', 'success');
      }
    } catch {
      addToast('Error al desactivar', 'error');
    }
  }

  async function handleToggleProduct(product: Product) {
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !product.isActive }),
      });
      if (res.ok) {
        await fetchData();
        addToast(product.isActive ? 'Producto desactivado' : 'Producto reactivado', 'success');
      }
    } catch {
      addToast('Error al cambiar estado', 'error');
    }
  }

  function openCategoryModal(cat?: Category) {
    if (cat) {
      setEditCat(cat);
      setCatName(cat.name);
    } else {
      setEditCat(null);
      setCatName('');
    }
    setShowCategory(true);
  }

  async function handleSaveCategory() {
    if (!catName.trim()) {
      addToast('El nombre es requerido', 'warning');
      return;
    }
    setSavingCat(true);
    try {
      const url = editCat ? `/api/categories/${editCat.id}` : '/api/categories';
      const method = editCat ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: catName }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error, 'error');
        return;
      }
      await fetchData();
      setShowCategory(false);
      addToast(editCat ? 'Categoría renombrada' : 'Categoría creada', 'success');
    } catch {
      addToast('Error al guardar categoría', 'error');
    } finally {
      setSavingCat(false);
    }
  }

  async function handleDeleteCategory(id: string) {
    try {
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error, 'error');
        return;
      }
      await fetchData();
      addToast('Categoría eliminada', 'success');
    } catch {
      addToast('Error al eliminar', 'error');
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className={styles.title}>Catálogo de Productos</h1>
        <p className={styles.subtitle}>Cargando...</p>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Catálogo de Productos</h1>
          <p className={styles.subtitle}>Gestionar productos, categorías y precios</p>
        </div>
        <div className={styles.headerActions}>
          <Button variant="secondary" onClick={() => openCategoryModal()}>
            + Categoría
          </Button>
          <Button onClick={() => openProductModal()}>
            + Producto
          </Button>
        </div>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          title="No hay productos"
          description="Crea categorías y productos para tu laboratorio."
          action={<Button onClick={() => openProductModal()}>Crear Producto</Button>}
        />
      ) : (
        <div className={styles.accordion}>
          {groups.map((group) => (
            <div key={group.id} className={styles.catSection}>
              <div
                className={styles.catHeader}
                onClick={() => toggleCategory(group.id)}
              >
                <div className={styles.catInfo}>
                  <svg
                    className={`${styles.chevron} ${expandedCat.has(group.id) ? styles.open : ''}`}
                    width="14" height="14" viewBox="0 0 14 14" fill="none"
                  >
                    <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <h3 className={styles.catName}>{group.name}</h3>
                  <span className={styles.catCount}>
                    {group.products.length} producto{group.products.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {group.id !== 'uncategorized' && (
                  <div className={styles.catActions} onClick={(e) => e.stopPropagation()}>
                    <button
                      className={styles.iconBtn}
                      title="Renombrar categoría"
                      onClick={() => openCategoryModal(categories.find((c) => c.id === group.id))}
                    >
                      <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                        <path d="M10 1.5l2.5 2.5L4.5 12H2v-2.5L10 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <button
                      className={styles.iconBtn}
                      title="Eliminar categoría"
                      onClick={() => setConfirmDelete({ type: 'category', id: group.id, name: group.name })}
                    >
                      <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                        <path d="M2 3.5h10M5 3.5V2.5a1 1 0 011-1h2a1 1 0 011 1v1M5.5 6v4M8.5 6v4M3 3.5l.5 8a1.5 1.5 0 001.5 1.5h4a1.5 1.5 0 001.5-1.5l.5-8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {expandedCat.has(group.id) && (
                <div className={styles.tableContainer}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Detalles</th>
                        <th>Precio</th>
                        <th>Flujo</th>
                        <th>Estado</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.products.map((p) => (
                        <tr key={p.id} className={!p.isActive ? styles.rowInactive : ''}>
                          <td className={styles.productName}>{p.name}</td>
                          <td className={styles.productDetails}>{p.details || '—'}</td>
                          <td className={styles.productPrice}>{formatCurrency(p.suggestedPriceUsd)}</td>
                          <td>
                            <Badge variant="primary" size="sm">
                              {p.workflow?.name || '—'}
                            </Badge>
                          </td>
                          <td>
                            <Badge variant={p.isActive ? 'success' : 'neutral'} size="sm">
                              {p.isActive ? 'Activo' : 'Inactivo'}
                            </Badge>
                          </td>
                          <td>
                            <div className={styles.rowActions}>
                              <button
                                className={styles.iconBtn}
                                title="Editar"
                                onClick={() => openProductModal(p)}
                              >
                                <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                                  <path d="M10 1.5l2.5 2.5L4.5 12H2v-2.5L10 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                                </svg>
                              </button>
                              <button
                                className={styles.iconBtn}
                                title={p.isActive ? 'Desactivar' : 'Reactivar'}
                                onClick={() => handleToggleProduct(p)}
                              >
                                {p.isActive ? '⏸' : '▶'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Product Modal */}
      <Modal
        isOpen={showProduct}
        onClose={() => setShowProduct(false)}
        title={editProduct ? 'Editar Producto' : 'Nuevo Producto'}
      >
        <div className={styles.form}>
          <Input
            label="Nombre del producto"
            value={pName}
            onChange={(e) => setPName(e.target.value)}
            placeholder="Ej: Prótesis Total Acrílica"
            autoFocus
          />
          <Select
            label="Categoría"
            value={pCategory}
            onChange={(e) => setPCategory(e.target.value)}
          >
            <option value="">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Select
            label="Flujo de trabajo"
            value={pWorkflow}
            onChange={(e) => setPWorkflow(e.target.value)}
            required
          >
            <option value="">Seleccionar flujo...</option>
            {workflows.filter((w) => w.isActive).map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </Select>
          <Input
            label="Detalles (opcional)"
            value={pDetails}
            onChange={(e) => setPDetails(e.target.value)}
            placeholder="Ej: A partir de 9 UD"
          />
          <Input
            label="Precio sugerido (USD)"
            type="number"
            value={pPrice}
            onChange={(e) => setPPrice(e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
          />
          <div className={styles.modalActions}>
            <Button variant="secondary" onClick={() => setShowProduct(false)}>
              Cancelar
            </Button>
            <Button loading={saving} onClick={handleSaveProduct}>
              {editProduct ? 'Guardar' : 'Crear Producto'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Category Modal */}
      <Modal
        isOpen={showCategory}
        onClose={() => setShowCategory(false)}
        title={editCat ? 'Renombrar Categoría' : 'Nueva Categoría'}
        size="sm"
      >
        <div className={styles.form}>
          <Input
            label="Nombre de la categoría"
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            placeholder="Ej: Prótesis Totales"
            autoFocus
          />
          <div className={styles.modalActions}>
            <Button variant="secondary" onClick={() => setShowCategory(false)}>
              Cancelar
            </Button>
            <Button loading={savingCat} onClick={handleSaveCategory}>
              {editCat ? 'Renombrar' : 'Crear'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={!!confirmDelete}
        title={confirmDelete?.type === 'product'
          ? `¿Desactivar "${confirmDelete?.name}"?`
          : `¿Eliminar la categoría "${confirmDelete?.name}"?`
        }
        message={confirmDelete?.type === 'product'
          ? 'El producto será desactivado y no aparecerá al crear nuevos pedidos.'
          : 'Los productos de esta categoría quedarán sin categoría.'
        }
        confirmLabel={confirmDelete?.type === 'product' ? 'Desactivar' : 'Eliminar'}
        variant="danger"
        onConfirm={async () => {
          if (confirmDelete) {
            if (confirmDelete.type === 'product') {
              await handleDeleteProduct(confirmDelete.id);
            } else {
              await handleDeleteCategory(confirmDelete.id);
            }
          }
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
