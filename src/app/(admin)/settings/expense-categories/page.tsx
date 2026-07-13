// ============================================
// SJ Lab — Expense Categories Management
// ============================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import styles from './page.module.css';

interface ExpenseCategory {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
}

const PRESET_COLORS = ['#3B82F6', '#10B981', '#6366F1', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6', '#8B5CF6', '#6B7280'];

export default function ExpenseCategoriesPage() {
  const { addToast } = useToast();
  const [cats, setCats] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState('#3B82F6');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchCats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/expense-categories');
      const data = await res.json();
      if (data.data) setCats(data.data);
    } catch {
      addToast('Error al cargar categorías', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchCats(); }, [fetchCats]);

  function openCreate() {
    setEditingId(null);
    setFormName('');
    setFormColor('#3B82F6');
    setShowModal(true);
  }

  function openEdit(c: ExpenseCategory) {
    setEditingId(c.id);
    setFormName(c.name);
    setFormColor(c.color);
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) return;

    setSaving(true);
    try {
      const url = editingId ? `/api/expense-categories/${editingId}` : '/api/expense-categories';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName.trim(), color: formColor }),
      });
      if (res.ok) {
        addToast(editingId ? 'Categoría actualizada' : 'Categoría creada', 'success');
        setShowModal(false);
        fetchCats();
      } else {
        const data = await res.json();
        addToast(data.error || 'Error', 'error');
      }
    } catch {
      addToast('Error de red', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/expense-categories/${deleteId}`, { method: 'DELETE' });
      if (res.ok) {
        addToast('Categoría eliminada', 'success');
        setDeleteId(null);
        fetchCats();
      }
    } catch {
      addToast('Error al eliminar', 'error');
    }
  }

  async function toggleActive(c: ExpenseCategory) {
    try {
      await fetch(`/api/expense-categories/${c.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !c.isActive }),
      });
      fetchCats();
    } catch {
      addToast('Error', 'error');
    }
  }

  return (
    <div>
      <a href="/settings" className={styles.backBtn}>← Configuración</a>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Categorías de Gastos</h1>
          <p className={styles.subtitle}>Clasifica tus gastos para un mejor control — {cats.length} categorías</p>
        </div>
        <Button onClick={openCreate}>+ Nueva Categoría</Button>
      </div>

      {loading ? (
        <div className={styles.loadingWrap}><div className={styles.spinner} /></div>
      ) : cats.length === 0 ? (
        <div className={styles.emptyWrap}>
          <p>No hay categorías configuradas.</p>
          <Button onClick={openCreate}>Crear Primera Categoría</Button>
        </div>
      ) : (
        <div className={styles.list}>
          {cats.map((c, idx) => (
            <div key={c.id} className={styles.catItem} style={{ animationDelay: `${idx * 40}ms` }}>
              <div className={styles.catLeft}>
                <span className={styles.catDot} style={{ background: c.color }} />
                <span className={styles.catName}>{c.name}</span>
                {!c.isActive && <span className={styles.inactiveBadge}>Inactiva</span>}
              </div>
              <div className={styles.catActions}>
                <button className={styles.actionBtn} onClick={() => toggleActive(c)}>
                  {c.isActive ? 'Desactivar' : 'Activar'}
                </button>
                <button className={styles.actionBtn} onClick={() => openEdit(c)}>Editar</button>
                <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={() => setDeleteId(c.id)}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <form className={styles.modal} onSubmit={handleSave}>
            <h3 className={styles.modalTitle}>{editingId ? 'Editar Categoría' : 'Nueva Categoría'}</h3>
            <div className={styles.modalFields}>
              <Input label="Nombre *" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ej: Materiales, Alquiler..." autoFocus required />
              <div>
                <label className={styles.fieldLabel}>Color</label>
                <div className={styles.colorGrid}>
                  {PRESET_COLORS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      className={`${styles.colorSwatch} ${formColor === col ? styles.colorSelected : ''}`}
                      style={{ background: col }}
                      onClick={() => setFormColor(col)}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className={styles.modalActions}>
              <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button type="submit" loading={saving}>{editingId ? 'Guardar' : 'Crear'}</Button>
            </div>
          </form>
        </div>
      )}

      {deleteId && (
        <ConfirmDialog
          isOpen={true}
          title="Eliminar Categoría"
          message="¿Estás seguro? Los gastos existentes no se eliminarán pero ya no estarán clasificados."
          confirmLabel="Eliminar"
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
