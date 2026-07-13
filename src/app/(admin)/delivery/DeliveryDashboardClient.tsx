'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';
import styles from './page.module.css';

interface Delivery {
  id: string;
  orderId: string | null;
  clientId: string;
  deliveryUserId: string | null;
  serviceType: 'pickup' | 'delivery';
  address: string;
  coordinates: string | null;
  contactInfo: string;
  itemsDescription: string;
  status: 'pending' | 'proposed' | 'accepted' | 'completed' | 'cancelled';
  proposedAmountUsd: number | null;
  finalAmountUsd: number | null;
  notes: string | null;
  createdAt: number;
  order: { orderNumber: number; patientName: string } | null;
  client: { name: string; clinicName: string | null; phone: string | null };
}

export default function DeliveryDashboardClient({ userRole }: { userRole: string }) {
  const router = useRouter();
  const { addToast } = useToast();
  
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'proposed' | 'accepted' | 'completed'>('pending');

  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [proposedAmount, setProposedAmount] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDeleteDeliveryId, setConfirmDeleteDeliveryId] = useState<string | null>(null);

  const fetchDeliveries = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch(`/api/deliveries?status=${activeTab}`);
      const data = await res.json();
      if (data.data) {
        setDeliveries(data.data);
      }
    } catch {
      if (showLoading) addToast('Error al cargar solicitudes', 'error');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [activeTab, addToast]);

  useEffect(() => {
    fetchDeliveries();
    
    // Simple polling for real-time updates
    const interval = setInterval(() => {
      fetchDeliveries(false);
    }, 10000);
    
    return () => clearInterval(interval);
  }, [fetchDeliveries]);

  async function handlePropose() {
    if (!selectedDelivery || !proposedAmount) return;
    try {
      const res = await fetch(`/api/deliveries/${selectedDelivery.id}/propose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(proposedAmount) }),
      });
      if (res.ok) {
        addToast('Propuesta enviada', 'success');
        setModalOpen(false);
        setProposedAmount('');
        fetchDeliveries();
      } else {
        const data = await res.json();
        addToast(data.error || 'Error al enviar propuesta', 'error');
      }
    } catch {
      addToast('Error al enviar propuesta', 'error');
    }
  }

  async function handleStatusChange(id: string, status: string) {
    try {
      const res = await fetch(`/api/deliveries/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        addToast('Estado actualizado', 'success');
        fetchDeliveries();
      } else {
        const data = await res.json();
        addToast(data.error || 'Error al actualizar', 'error');
      }
    } catch {
      addToast('Error al actualizar', 'error');
    }
  }

  async function handleDeleteDelivery(id: string) {
    try {
      const res = await fetch(`/api/deliveries/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (res.ok) {
        addToast('Delivery eliminado', 'success');
        fetchDeliveries();
        return;
      }

      addToast(data.error || 'Error al eliminar delivery', 'error');
    } catch {
      addToast('Error al eliminar delivery', 'error');
    } finally {
      setConfirmDeleteDeliveryId(null);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Panel de Delivery</h1>
        {(userRole === 'admin' || userRole === 'tech') && (
          <Button onClick={() => router.push('/delivery/new')}>+ Registrar Manual</Button>
        )}
      </div>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${activeTab === 'pending' ? styles.active : ''}`} onClick={() => setActiveTab('pending')}>Pendientes</button>
        <button className={`${styles.tab} ${activeTab === 'proposed' ? styles.active : ''}`} onClick={() => setActiveTab('proposed')}>{userRole === 'delivery' ? 'Mis Propuestas' : 'Propuestas'}</button>
        <button className={`${styles.tab} ${activeTab === 'accepted' ? styles.active : ''}`} onClick={() => setActiveTab('accepted')}>En Curso</button>
        <button className={`${styles.tab} ${activeTab === 'completed' ? styles.active : ''}`} onClick={() => setActiveTab('completed')}>Completados</button>
      </div>

      <div className={styles.content}>
        {loading ? (
          <p>Cargando...</p>
        ) : deliveries.length === 0 ? (
          <p>No hay solicitudes en esta sección.</p>
        ) : (
          <div className={styles.grid}>
            {deliveries.map(d => (
              <div key={d.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <Badge variant={d.serviceType === 'pickup' ? 'warning' : 'primary'}>
                    {d.serviceType === 'pickup' ? 'Recoger' : 'Entregar'}
                  </Badge>
                  <span className={styles.time}>{formatRelativeTime(d.createdAt)}</span>
                </div>
                
                <div className={styles.cardBody}>
                  <p className={styles.clientName}>{d.client.name} {d.client.clinicName && `(${d.client.clinicName})`}</p>
                  <p className={styles.address}>📍 {d.address}</p>
                  <p className={styles.items}>📦 {d.itemsDescription}</p>
                  <p className={styles.contact}>📞 {d.contactInfo}</p>
                  {d.proposedAmountUsd && <p className={styles.amount}>💰 Monto propuesto: {formatCurrency(d.proposedAmountUsd)}</p>}
                </div>

                <div className={styles.cardActions}>
                  {d.status === 'pending' && userRole === 'delivery' && (
                    <Button onClick={() => { setSelectedDelivery(d); setModalOpen(true); }}>Proponer Monto</Button>
                  )}
                  {d.status === 'proposed' && (userRole === 'admin' || userRole === 'tech') && (
                    <>
                      <Button variant="primary" onClick={() => handleStatusChange(d.id, 'accepted')}>Aceptar</Button>
                      <Button variant="danger" onClick={() => handleStatusChange(d.id, 'cancelled')}>Cancelar</Button>
                    </>
                  )}
                  {d.status === 'accepted' && (userRole === 'delivery' || userRole === 'admin' || userRole === 'tech') && (
                    <Button variant="primary" onClick={() => handleStatusChange(d.id, 'completed')}>Marcar Completado</Button>
                  )}
                  {(userRole === 'admin' || userRole === 'tech') && d.status !== 'completed' && (
                    <Button variant="danger" onClick={() => setConfirmDeleteDeliveryId(d.id)}>Eliminar</Button>
                  )}
                  {d.coordinates && (
                    <Button variant="secondary" onClick={() => window.open(`https://maps.google.com/?q=${d.coordinates}`, '_blank')}>Ver Mapa</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen && selectedDelivery && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2>Proponer Monto</h2>
            <p>Servicio para {selectedDelivery.client.name}</p>
            <p>Dirección: {selectedDelivery.address}</p>
            
            <div className={styles.field}>
              <label>Monto (USD)</label>
              <input 
                type="number" 
                step="0.01" 
                value={proposedAmount} 
                onChange={(e) => setProposedAmount(e.target.value)} 
                className={styles.input}
              />
            </div>
            
            <div className={styles.modalActions}>
              <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button onClick={handlePropose} disabled={!proposedAmount}>Enviar Propuesta</Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmDeleteDeliveryId}
        title="¿Eliminar este delivery?"
        message="Esta acción eliminará la solicitud de delivery. No se puede deshacer."
        confirmLabel="Sí, eliminar delivery"
        variant="danger"
        onConfirm={async () => {
          if (confirmDeleteDeliveryId) {
            await handleDeleteDelivery(confirmDeleteDeliveryId);
          }
        }}
        onCancel={() => setConfirmDeleteDeliveryId(null)}
      />
    </div>
  );
}
