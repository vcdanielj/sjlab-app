'use client';

import { useState, useEffect, useCallback, use, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { PaymentModal } from '@/components/finances/PaymentModal';
import { formatCurrency, formatDate, formatBs } from '@/lib/utils';
import styles from './page.module.css';

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  clinicName: string | null;
  taxId: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  autoBillingEnabled: boolean;
  createdAt: number;
}

interface Financial {
  totalInvoiced: number;
  totalPaid: number;
  balance: number;
  orderCount: number;
  paymentCount: number;
}

interface Order {
  id: string;
  orderNumber: number;
  patientName: string;
  finalPriceUsd: number;
  status: string;
  createdAt: number;
  productName: string | null;
  currentStepName: string | null;
}

interface Payment {
  id: string;
  currency: string;
  amount: number;
  amountUsd: number;
  paymentMethod: string;
  reference: string | null;
  paymentDate: number;
  status: string;
}

const STATUS_BADGES: Record<string, { variant: 'success' | 'warning' | 'danger' | 'neutral' | 'primary'; label: string }> = {
  active: { variant: 'primary', label: 'Activo' },
  completed: { variant: 'success', label: 'Completado' },
  delivered: { variant: 'success', label: 'Entregado' },
  cancelled: { variant: 'danger', label: 'Cancelado' },
};

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { addToast } = useToast();

  const [client, setClient] = useState<Client | null>(null);
  const [financial, setFinancial] = useState<Financial | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  // Payment Expansion & Voiding States
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [expandedPaymentId, setExpandedPaymentId] = useState<string | null>(null);
  const [paymentAllocations, setPaymentAllocations] = useState<Record<string, any[]>>({});
  const [loadingAllocations, setLoadingAllocations] = useState<Record<string, boolean>>({});
  const [voidingPaymentId, setVoidingPaymentId] = useState<string | null>(null);

  // Editing
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editClinic, setEditClinic] = useState('');
  const [editTaxId, setEditTaxId] = useState('');
  const [saving, setSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingClient, setDeletingClient] = useState(false);

  const handleDownloadStatement = useCallback(async () => {
    setDownloadingPdf(true);
    try {
      const res = await fetch(`/api/clients/${id}/statement`);
      if (!res.ok) {
        const data = await res.json();
        addToast(data.error || 'Error al generar PDF', 'error');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `estado_cuenta_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast('PDF descargado correctamente', 'success');
    } catch {
      addToast('Error al descargar el PDF', 'error');
    } finally {
      setDownloadingPdf(false);
    }
  }, [id, addToast]);

  const handleSendStatementEmail = useCallback(async () => {
    setSendingEmail(true);
    try {
      const res = await fetch(`/api/clients/${id}/statement`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || 'Error al enviar el correo', 'error');
        return;
      }
      addToast('Recordatorio de estado de cuenta enviado con éxito', 'success');
    } catch {
      addToast('Error al enviar el correo de recordatorio', 'error');
    } finally {
      setSendingEmail(false);
    }
  }, [id, addToast]);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${id}`);
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error, 'error');
        router.push('/clients');
        return;
      }
      setClient(data.data.client);
      setFinancial(data.data.financial);
      setOrders(data.data.orders);
      setPayments(data.data.payments);
    } catch {
      addToast('Error al cargar cliente', 'error');
    } finally {
      setLoading(false);
    }
  }, [id, addToast, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleExpandPayment = useCallback(async (paymentId: string) => {
    if (expandedPaymentId === paymentId) {
      setExpandedPaymentId(null);
      return;
    }

    setExpandedPaymentId(paymentId);

    if (!paymentAllocations[paymentId]) {
      setLoadingAllocations((prev) => ({ ...prev, [paymentId]: true }));
      try {
        const res = await fetch(`/api/payments/${paymentId}/allocations`);
        const data = await res.json();
        if (res.ok && data.data) {
          setPaymentAllocations((prev) => ({ ...prev, [paymentId]: data.data }));
        }
      } catch {
        addToast('Error al cargar amortizaciones', 'error');
      } finally {
        setLoadingAllocations((prev) => ({ ...prev, [paymentId]: false }));
      }
    }
  }, [expandedPaymentId, paymentAllocations, addToast]);

  const [voidConfirmPaymentId, setVoidConfirmPaymentId] = useState<string | null>(null);

  const handleVoidPayment = useCallback(async (paymentId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setVoidConfirmPaymentId(paymentId);
  }, []);

  const executeVoidPayment = useCallback(async () => {
    if (!voidConfirmPaymentId) return;
    const paymentId = voidConfirmPaymentId;
    setVoidConfirmPaymentId(null);

    setVoidingPaymentId(paymentId);
    try {
      const res = await fetch(`/api/payments/${paymentId}/void`, {
        method: 'PATCH',
      });
      const data = await res.json();
      if (res.ok) {
        addToast('Pago anulado correctamente', 'success');
        // Reset cached allocations for this payment
        setPaymentAllocations((prev) => {
          const updated = { ...prev };
          delete updated[paymentId];
          return updated;
        });
        setExpandedPaymentId(null);
        fetchData();
      } else {
        addToast(data.error || 'Error al anular pago', 'error');
      }
    } catch {
      addToast('Error de red al anular el pago', 'error');
    } finally {
      setVoidingPaymentId(null);
    }
  }, [voidConfirmPaymentId, addToast, fetchData]);

  function startEditing() {
    if (!client) return;
    setEditName(client.name);
    setEditEmail(client.email);
    setEditPhone(client.phone || '');
    setEditAddress(client.address || '');
    setEditClinic(client.clinicName || '');
    setEditTaxId(client.taxId || '');
    setEditing(true);
  }

  async function handleSave() {
    if (!editName.trim()) {
      addToast('El nombre es requerido', 'warning');
      return;
    }
    if (!editEmail.trim()) {
      addToast('El email es requerido', 'warning');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          email: editEmail,
          phone: editPhone || null,
          address: editAddress || null,
          clinicName: editClinic || null,
          taxId: editTaxId || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchData();
        setEditing(false);
        addToast('Cliente actualizado con éxito', 'success');
      } else {
        addToast(data.error || 'Error al actualizar el cliente', 'error');
      }
    } catch {
      addToast('Error de red al actualizar el cliente', 'error');
    } finally {
      setSaving(false);
    }
  }

  // Status toggle confirm
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);
  const [togglingAutoBilling, setTogglingAutoBilling] = useState(false);

  async function handleToggleAutoBilling() {
    if (!client) return;
    setTogglingAutoBilling(true);
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoBillingEnabled: !client.autoBillingEnabled,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchData();
        addToast(
          client.autoBillingEnabled
            ? 'Cobro automático desactivado para este cliente'
            : 'Cobro automático activado para este cliente',
          'success'
        );
      } else {
        addToast(data.error || 'Error al cambiar estado de cobro', 'error');
      }
    } catch {
      addToast('Error de red al cambiar estado de cobro', 'error');
    } finally {
      setTogglingAutoBilling(false);
    }
  }

  async function handleToggleStatus() {
    if (!client) return;
    const newStatus = !client.isActive;
    setShowStatusConfirm(false);

    try {
      const res = await fetch(`/api/clients/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: newStatus }),
      });
      if (res.ok) {
        await fetchData();
        addToast(newStatus ? 'Cliente activado' : 'Cliente desactivado', 'success');
      }
    } catch {
      addToast('Error al cambiar estado', 'error');
    }
  }

  async function handleDeleteClient() {
    setDeletingClient(true);
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (res.ok) {
        addToast('Cliente eliminado', 'success');
        router.push('/clients');
        return;
      }

      if (res.status === 409 && data.details) {
        const blockers = [
          data.details.orders ? `${data.details.orders} pedido(s)` : null,
          data.details.payments ? `${data.details.payments} pago(s)` : null,
          data.details.expenses ? `${data.details.expenses} gasto(s)` : null,
        ].filter(Boolean);

        addToast(`No se puede eliminar: ${blockers.join(', ')}`, 'warning');
        return;
      }

      addToast(data.error || 'Error al eliminar cliente', 'error');
    } catch {
      addToast('Error de red al eliminar cliente', 'error');
    } finally {
      setDeletingClient(false);
      setShowDeleteConfirm(false);
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className={styles.title}>Cargando...</h1>
      </div>
    );
  }

  if (!client || !financial) return null;

  return (
    <div>
      <button className={styles.backBtn} onClick={() => router.push('/clients')}>
        ← Volver al Directorio
      </button>

      {/* Client Info Card */}
      <div className={styles.infoCard}>
        <div className={styles.infoHeader}>
          <div className={styles.infoLeft}>
            <div className={styles.avatar}>
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className={styles.clientName}>{client.name}</h1>
              <p className={styles.clientEmail}>{client.email}</p>
              {client.clinicName && (
                <p className={styles.clientClinic}>{client.clinicName}</p>
              )}
            </div>
          </div>
          <div className={styles.infoActions}>
            <Badge variant={client.isActive ? 'success' : 'neutral'}>
              {client.isActive ? 'Activo' : 'Inactivo'}
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => setShowStatusConfirm(true)}>
              {client.isActive ? 'Desactivar' : 'Activar'}
            </Button>
            <Badge variant={client.autoBillingEnabled ? 'success' : 'neutral'}>
              {client.autoBillingEnabled ? 'Cobro Automático: Sí' : 'Cobro Automático: No'}
            </Badge>
            <Button variant="ghost" size="sm" loading={togglingAutoBilling} onClick={handleToggleAutoBilling}>
              {client.autoBillingEnabled ? 'Desactivar Cobro' : 'Activar Cobro'}
            </Button>
            <Button variant="secondary" size="sm" onClick={startEditing}>
              Editar
            </Button>
          </div>
        </div>

        {editing && (
          <div className={styles.editSection}>
            <div className={styles.editGrid}>
              <Input
                label="Nombre"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
              <Input
                label="Email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
              <Input
                label="Teléfono"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
              />
              <Input
                label="Dirección"
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
              />
              <Input
                label="Clínica"
                value={editClinic}
                onChange={(e) => setEditClinic(e.target.value)}
              />
              <Input
                label="Cédula / RIF"
                value={editTaxId}
                onChange={(e) => setEditTaxId(e.target.value)}
              />
            </div>
            <div className={styles.editActions}>
              <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
              <Button size="sm" loading={saving} onClick={handleSave}>
                Guardar
              </Button>
            </div>
          </div>
        )}

        {!editing && (
          <div className={styles.detailRow}>
            {client.phone && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Teléfono</span>
                <span className={styles.detailValue}>{client.phone}</span>
              </div>
            )}
            {client.address && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Dirección</span>
                <span className={styles.detailValue}>{client.address}</span>
              </div>
            )}
            {client.taxId && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Cédula / RIF</span>
                <span className={styles.detailValue}>{client.taxId}</span>
              </div>
            )}
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Registrado</span>
              <span className={styles.detailValue}>{formatDate(client.createdAt)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Financial Summary */}
      <div className={styles.financialGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total Facturado</span>
          <span className={styles.kpiValue}>{formatCurrency(financial.totalInvoiced)}</span>
          <span className={styles.kpiSub}>{financial.orderCount} pedido{financial.orderCount !== 1 ? 's' : ''}</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total Pagado</span>
          <span className={styles.kpiValue}>{formatCurrency(financial.totalPaid)}</span>
          <span className={styles.kpiSub}>{financial.paymentCount} pago{financial.paymentCount !== 1 ? 's' : ''}</span>
        </div>
        <div className={`${styles.kpiCard} ${financial.balance > 0 ? styles.positive : financial.balance < 0 ? styles.negative : ''}`}>
          <span className={styles.kpiLabel}>Saldo Neto</span>
          <span className={styles.kpiValue}>
            {formatCurrency(Math.abs(financial.balance))}
          </span>
          <span className={styles.kpiSub}>
            {financial.balance > 0 ? 'A favor del cliente' : financial.balance < 0 ? 'Deuda pendiente' : 'Sin saldo'}
          </span>
        </div>
      </div>

      {/* Actions Row */}
      <div className={styles.actionsRow}>
        <Button variant="secondary" size="sm" onClick={() => setIsPaymentModalOpen(true)}>
          Registrar Pago
        </Button>
        <Button variant="secondary" size="sm" loading={downloadingPdf} onClick={handleDownloadStatement}>
          Descargar Estado de Cuenta
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={financial.balance >= 0}
          loading={sendingEmail}
          onClick={handleSendStatementEmail}
          title={financial.balance >= 0 ? "Solo habilitado para clientes con deuda pendiente" : undefined}
        >
          Enviar Estado de Cuenta
        </Button>
        <Button
          variant="danger"
          size="sm"
          className={styles.deleteAction}
          loading={deletingClient}
          onClick={() => setShowDeleteConfirm(true)}
        >
          Eliminar Cliente
        </Button>
      </div>

      {/* Orders Table */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Pedidos</h2>
        {orders.length === 0 ? (
          <EmptyState title="Sin pedidos" description="Este cliente no tiene pedidos registrados." />
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Paciente</th>
                  <th>Producto</th>
                  <th>Paso Actual</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const badge = STATUS_BADGES[o.status] || { variant: 'neutral' as const, label: o.status };
                  return (
                    <tr key={o.id}>
                      <td className={styles.orderNum}>{o.orderNumber}</td>
                      <td className={styles.medium}>{o.patientName}</td>
                      <td>{o.productName || '—'}</td>
                      <td>{o.currentStepName || '—'}</td>
                      <td className={styles.price}>{formatCurrency(o.finalPriceUsd)}</td>
                      <td>
                        <Badge variant={badge.variant} size="sm">{badge.label}</Badge>
                      </td>
                      <td className={styles.dateCol}>{formatDate(o.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payments Table */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Historial de Pagos</h2>
        {payments.length === 0 ? (
          <EmptyState title="Sin pagos" description="No se han registrado pagos para este cliente." />
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}></th>
                  <th>Fecha</th>
                  <th>Monto</th>
                  <th>Moneda</th>
                  <th>Método</th>
                  <th>Referencia</th>
                  <th>Estado</th>
                  <th className={styles.alignRight}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const isExpanded = expandedPaymentId === p.id;
                  const allocations = paymentAllocations[p.id] || [];
                  const loadingAlloc = loadingAllocations[p.id];
                  
                  // Calculate sum of allocations to show surplus if any
                  const allocationsSum = allocations.reduce((sum, a) => sum + a.amountUsd, 0);
                  const surplus = p.amountUsd - allocationsSum;

                  return (
                    <Fragment key={p.id}>
                      <tr 
                        className={`${styles.row} ${styles.paymentRow}`}
                        onClick={() => toggleExpandPayment(p.id)}
                      >
                        <td className={styles.expandCell}>
                          <span className={`${styles.arrow} ${isExpanded ? styles.arrowExpanded : ''}`}>
                            ▸
                          </span>
                        </td>
                        <td className={styles.dateCol}>{formatDate(p.paymentDate)}</td>
                        <td className={styles.price}>
                          {p.currency === 'USD' ? formatCurrency(p.amount) : formatCurrency(p.amountUsd)}
                          {p.currency === 'VES' && (
                            <span className={styles.originalAmount} title={`Monto original: Bs. ${p.amount}`}>
                              ({formatBs(p.amount)})
                            </span>
                          )}
                        </td>
                        <td>{p.currency}</td>
                        <td>{p.paymentMethod}</td>
                        <td className={styles.ref}>{p.reference || '—'}</td>
                        <td>
                          <Badge
                            variant={p.status === 'active' ? 'success' : 'danger'}
                            size="sm"
                          >
                            {p.status === 'active' ? 'Activo' : 'Anulado'}
                          </Badge>
                        </td>
                        <td className={styles.alignRight}>
                          {p.status === 'active' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className={styles.voidBtn}
                              loading={voidingPaymentId === p.id}
                              onClick={(e) => handleVoidPayment(p.id, e)}
                            >
                              Anular
                            </Button>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className={styles.expandedRow}>
                          <td colSpan={8} className={styles.expandedCellContent}>
                            <div className={styles.allocationsContainer}>
                              <h4 className={styles.allocationsTitle}>Distribución FIFO del Pago</h4>
                              
                              {loadingAlloc && (
                                <div className={styles.allocationsLoading}>
                                  <div className={styles.spinnerMini} />
                                  <span>Cargando amortizaciones...</span>
                                </div>
                              )}
                              
                              {!loadingAlloc && allocations.length === 0 && (
                                <p className={styles.noAllocations}>
                                  Este pago no tiene deudas amortizadas. Todo el monto quedó registrado como saldo a favor del cliente.
                                </p>
                              )}
                              
                              {!loadingAlloc && allocations.length > 0 && (
                                <div className={styles.allocationsList}>
                                  {allocations.map((alloc) => (
                                    <div key={alloc.id} className={styles.allocationItem}>
                                      <span className={styles.allocOrder}>Pedido #{alloc.orderNumber} (Paciente: {alloc.patientName})</span>
                                      <span className={styles.allocAmount}>Amortizado: <strong>{formatCurrency(alloc.amountUsd)} USD</strong></span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {p.status === 'active' && surplus > 0.005 && (
                                <div className={styles.surplusBanner}>
                                  <span>Excedente disponible (Saldo a Favor):</span>
                                  <strong>{formatCurrency(surplus)} USD</strong>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        clientId={client.id}
        clientName={client.name}
        onSuccess={fetchData}
      />

      <ConfirmDialog
        isOpen={!!voidConfirmPaymentId}
        title="¿Anular este pago?"
        message="Esta acción es irreversible. Se restaurarán las deudas de los pedidos correspondientes y se recalculará el saldo del cliente."
        confirmLabel="Sí, anular pago"
        variant="danger"
        onConfirm={executeVoidPayment}
        onCancel={() => setVoidConfirmPaymentId(null)}
      />

      {/* Status Toggle Confirm */}
      <ConfirmDialog
        isOpen={showStatusConfirm}
        title={client?.isActive ? '¿Desactivar este cliente?' : '¿Activar este cliente?'}
        message={client?.isActive
          ? 'El cliente no podrá acceder al portal ni crear nuevos pedidos.'
          : 'El cliente podrá volver a acceder al portal.'}
        confirmLabel={client?.isActive ? 'Desactivar' : 'Activar'}
        variant={client?.isActive ? 'danger' : 'primary'}
        onConfirm={handleToggleStatus}
        onCancel={() => setShowStatusConfirm(false)}
      />

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="¿Eliminar este cliente?"
        message="Solo se puede eliminar si no tiene pedidos, pagos ni otros registros relacionados. Esta acción no se puede deshacer."
        confirmLabel="Eliminar cliente"
        variant="danger"
        onConfirm={handleDeleteClient}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
