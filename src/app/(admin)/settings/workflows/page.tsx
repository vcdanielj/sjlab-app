'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import styles from './page.module.css';

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
  createdAt: number;
  steps: WorkflowStep[];
}

export default function WorkflowsPage() {
  const { addToast } = useToast();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSteps, setNewSteps] = useState<string[]>(['']);
  const [creating, setCreating] = useState(false);

  // Edit step
  const [editingStep, setEditingStep] = useState<string | null>(null);
  const [editStepName, setEditStepName] = useState('');

  // Add step
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [addStepName, setAddStepName] = useState('');

  // Rename workflow modal
  const [renameTarget, setRenameTarget] = useState<{ id: string; currentName: string } | null>(null);
  const [renameName, setRenameName] = useState('');

  // Delete workflow confirm
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch('/api/workflows');
      const data = await res.json();
      if (data.data) setWorkflows(data.data);
    } catch {
      addToast('Error al cargar flujos', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  async function handleCreate() {
    const validSteps = newSteps.filter((s) => s.trim());
    if (!newName.trim() || validSteps.length === 0) {
      addToast('Nombre y al menos un paso son requeridos', 'warning');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, steps: validSteps }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error, 'error');
        return;
      }
      setWorkflows((prev) => [...prev, data.data]);
      setShowCreate(false);
      setNewName('');
      setNewSteps(['']);
      addToast('Flujo creado exitosamente', 'success');
    } catch {
      addToast('Error al crear flujo', 'error');
    } finally {
      setCreating(false);
    }
  }

  async function handleRenameWorkflow(id: string, name: string) {
    try {
      const res = await fetch(`/api/workflows/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setWorkflows((prev) =>
          prev.map((w) => (w.id === id ? { ...w, name } : w))
        );
        addToast('Flujo renombrado', 'success');
      }
    } catch {
      addToast('Error al renombrar', 'error');
    }
  }

  async function handleDeleteWorkflow(id: string) {
    try {
      const res = await fetch(`/api/workflows/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error, 'error');
        return;
      }
      setWorkflows((prev) => prev.filter((w) => w.id !== id));
      addToast('Flujo eliminado', 'success');
    } catch {
      addToast('Error al eliminar', 'error');
    }
  }

  async function handleSaveStepName(workflowId: string, stepId: string) {
    if (!editStepName.trim()) return;
    try {
      const res = await fetch(`/api/workflows/${workflowId}/steps/${stepId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editStepName }),
      });
      if (res.ok) {
        setWorkflows((prev) =>
          prev.map((w) =>
            w.id === workflowId
              ? {
                  ...w,
                  steps: w.steps.map((s) =>
                    s.id === stepId ? { ...s, name: editStepName } : s
                  ),
                }
              : w
          )
        );
        setEditingStep(null);
        addToast('Paso actualizado', 'success');
      }
    } catch {
      addToast('Error al actualizar paso', 'error');
    }
  }

  async function handleToggleStep(workflowId: string, step: WorkflowStep) {
    try {
      const res = await fetch(`/api/workflows/${workflowId}/steps/${step.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !step.isActive }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error, 'error');
        return;
      }
      setWorkflows((prev) =>
        prev.map((w) =>
          w.id === workflowId
            ? {
                ...w,
                steps: w.steps.map((s) =>
                  s.id === step.id ? { ...s, isActive: !s.isActive } : s
                ),
              }
            : w
        )
      );
      addToast(step.isActive ? 'Paso desactivado' : 'Paso activado', 'success');
    } catch {
      addToast('Error al cambiar estado', 'error');
    }
  }

  async function handleAddStep(workflowId: string) {
    if (!addStepName.trim()) return;
    try {
      const res = await fetch(`/api/workflows/${workflowId}/steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: addStepName }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error, 'error');
        return;
      }
      setWorkflows((prev) =>
        prev.map((w) =>
          w.id === workflowId ? { ...w, steps: [...w.steps, data.data] } : w
        )
      );
      setAddingTo(null);
      setAddStepName('');
      addToast('Paso agregado', 'success');
    } catch {
      addToast('Error al agregar paso', 'error');
    }
  }

  async function handleMoveStep(workflowId: string, stepIndex: number, direction: 'up' | 'down') {
    const wf = workflows.find((w) => w.id === workflowId);
    if (!wf) return;

    const newSteps = [...wf.steps];
    const targetIndex = direction === 'up' ? stepIndex - 1 : stepIndex + 1;
    if (targetIndex < 0 || targetIndex >= newSteps.length) return;

    [newSteps[stepIndex], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[stepIndex]];
    const stepIds = newSteps.map((s) => s.id);

    // Optimistic update
    setWorkflows((prev) =>
      prev.map((w) =>
        w.id === workflowId
          ? { ...w, steps: newSteps.map((s, i) => ({ ...s, sortOrder: i + 1 })) }
          : w
      )
    );

    try {
      await fetch(`/api/workflows/${workflowId}/steps`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepIds }),
      });
    } catch {
      fetchWorkflows(); // Revert on error
      addToast('Error al reordenar', 'error');
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className={styles.title}>Flujos de Trabajo</h1>
        <p className={styles.subtitle}>Cargando...</p>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Flujos de Trabajo</h1>
          <p className={styles.subtitle}>Gestionar los procesos de producción del laboratorio</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Nuevo Flujo</Button>
      </div>

      {workflows.length === 0 ? (
        <EmptyState
          title="No hay flujos de trabajo"
          description="Crea tu primer flujo de trabajo para definir los pasos de producción."
          action={<Button onClick={() => setShowCreate(true)}>Crear Flujo</Button>}
        />
      ) : (
        <div className={styles.list}>
          {workflows.map((wf) => (
            <div key={wf.id} className={`${styles.card} ${!wf.isActive ? styles.inactive : ''}`}>
              <div
                className={styles.cardHeader}
                onClick={() => setExpandedId(expandedId === wf.id ? null : wf.id)}
              >
                <div className={styles.cardInfo}>
                  <svg
                    className={`${styles.chevron} ${expandedId === wf.id ? styles.open : ''}`}
                    width="16" height="16" viewBox="0 0 16 16" fill="none"
                  >
                    <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <h3 className={styles.cardTitle}>{wf.name}</h3>
                  <Badge variant={wf.isActive ? 'success' : 'neutral'} size="sm">
                    {wf.isActive ? 'Activo' : 'Inactivo'}
                  </Badge>
                  <span className={styles.stepCount}>
                    {wf.steps.filter((s) => s.isActive).length} pasos
                  </span>
                </div>
                <div className={styles.cardActions} onClick={(e) => e.stopPropagation()}>
                  <button
                    className={styles.iconBtn}
                    title="Renombrar"
                    onClick={() => {
                      setRenameTarget({ id: wf.id, currentName: wf.name });
                      setRenameName(wf.name);
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M10 1.5l2.5 2.5L4.5 12H2v-2.5L10 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    className={styles.iconBtn}
                    title="Eliminar"
                    onClick={() => {
                      setDeleteTarget({ id: wf.id, name: wf.name });
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2 3.5h10M5 3.5V2.5a1 1 0 011-1h2a1 1 0 011 1v1M5.5 6v4M8.5 6v4M3 3.5l.5 8a1.5 1.5 0 001.5 1.5h4a1.5 1.5 0 001.5-1.5l.5-8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>

              {expandedId === wf.id && (
                <div className={styles.stepsContainer}>
                  {wf.steps.length === 0 ? (
                    <p className={styles.noSteps}>No hay pasos definidos</p>
                  ) : (
                    <ol className={styles.stepsList}>
                      {wf.steps.map((step, index) => (
                        <li key={step.id} className={`${styles.stepItem} ${!step.isActive ? styles.stepInactive : ''}`}>
                          <div className={styles.stepOrder}>
                            <button
                              className={styles.moveBtn}
                              disabled={index === 0}
                              onClick={() => handleMoveStep(wf.id, index, 'up')}
                              title="Mover arriba"
                            >
                              ▲
                            </button>
                            <span className={styles.orderNum}>{index + 1}</span>
                            <button
                              className={styles.moveBtn}
                              disabled={index === wf.steps.length - 1}
                              onClick={() => handleMoveStep(wf.id, index, 'down')}
                              title="Mover abajo"
                            >
                              ▼
                            </button>
                          </div>

                          {editingStep === step.id ? (
                            <div className={styles.editRow}>
                              <input
                                className={styles.editInput}
                                value={editStepName}
                                onChange={(e) => setEditStepName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveStepName(wf.id, step.id);
                                  if (e.key === 'Escape') setEditingStep(null);
                                }}
                                autoFocus
                              />
                              <button className={styles.saveBtn} onClick={() => handleSaveStepName(wf.id, step.id)}>
                                ✓
                              </button>
                              <button className={styles.cancelBtn} onClick={() => setEditingStep(null)}>
                                ✕
                              </button>
                            </div>
                          ) : (
                            <span
                              className={styles.stepName}
                              onDoubleClick={() => {
                                setEditingStep(step.id);
                                setEditStepName(step.name);
                              }}
                              title="Doble clic para editar"
                            >
                              {step.name}
                            </span>
                          )}

                          {!step.isActive && (
                            <Badge variant="neutral" size="sm">Inactivo</Badge>
                          )}

                          <div className={styles.stepActions}>
                            <button
                              className={styles.iconBtn}
                              title={step.isActive ? 'Desactivar' : 'Activar'}
                              onClick={() => handleToggleStep(wf.id, step)}
                            >
                              {step.isActive ? '⏸' : '▶'}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}

                  {addingTo === wf.id ? (
                    <div className={styles.addStepRow}>
                      <input
                        className={styles.editInput}
                        placeholder="Nombre del nuevo paso"
                        value={addStepName}
                        onChange={(e) => setAddStepName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddStep(wf.id);
                          if (e.key === 'Escape') {
                            setAddingTo(null);
                            setAddStepName('');
                          }
                        }}
                        autoFocus
                      />
                      <button className={styles.saveBtn} onClick={() => handleAddStep(wf.id)}>
                        ✓
                      </button>
                      <button className={styles.cancelBtn} onClick={() => {
                        setAddingTo(null);
                        setAddStepName('');
                      }}>
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      className={styles.addStepBtn}
                      onClick={() => setAddingTo(wf.id)}
                    >
                      + Agregar paso
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Workflow Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Nuevo Flujo de Trabajo"
      >
        <div className={styles.form}>
          <Input
            label="Nombre del flujo"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Ej: Acrílico Convencional"
            autoFocus
          />

          <div className={styles.stepsSection}>
            <label className={styles.label}>Pasos del flujo</label>
            {newSteps.map((step, i) => (
              <div key={i} className={styles.stepInputRow}>
                <span className={styles.stepNum}>{i + 1}.</span>
                <input
                  className={styles.stepInput}
                  value={step}
                  onChange={(e) => {
                    const updated = [...newSteps];
                    updated[i] = e.target.value;
                    setNewSteps(updated);
                  }}
                  placeholder={`Paso ${i + 1}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      setNewSteps([...newSteps, '']);
                    }
                  }}
                />
                {newSteps.length > 1 && (
                  <button
                    className={styles.removeStepBtn}
                    onClick={() => setNewSteps(newSteps.filter((_, j) => j !== i))}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              className={styles.addMoreBtn}
              onClick={() => setNewSteps([...newSteps, ''])}
            >
              + Agregar otro paso
            </button>
          </div>

          <div className={styles.modalActions}>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>
            <Button loading={creating} onClick={handleCreate}>
              Crear Flujo
            </Button>
          </div>
        </div>
      </Modal>

      {/* Rename Workflow Modal */}
      <Modal
        isOpen={!!renameTarget}
        onClose={() => setRenameTarget(null)}
        title="Renombrar flujo"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenameTarget(null)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (renameTarget && renameName.trim()) {
                  await handleRenameWorkflow(renameTarget.id, renameName.trim());
                  setRenameTarget(null);
                }
              }}
            >
              Guardar
            </Button>
          </>
        }
      >
        <Input
          label="Nombre del flujo"
          value={renameName}
          onChange={(e) => setRenameName(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && renameTarget && renameName.trim()) {
              handleRenameWorkflow(renameTarget.id, renameName.trim());
              setRenameTarget(null);
            }
          }}
        />
      </Modal>

      {/* Delete Workflow Confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={`¿Eliminar "${deleteTarget?.name}"?`}
        message="Se eliminará este flujo de trabajo. Los pedidos existentes que usen este flujo no serán afectados."
        confirmLabel="Sí, eliminar"
        variant="danger"
        onConfirm={async () => {
          if (deleteTarget) {
            await handleDeleteWorkflow(deleteTarget.id);
          }
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
