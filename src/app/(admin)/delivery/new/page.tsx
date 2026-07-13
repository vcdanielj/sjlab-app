'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import styles from './page.module.css';

export default function NewManualDeliveryPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const [clients, setClients] = useState<any[]>([]);
  const [deliveryUsers, setDeliveryUsers] = useState<any[]>([]);
  
  const [clientId, setClientId] = useState('');
  const [deliveryUserId, setDeliveryUserId] = useState('');
  const [amountUsd, setAmountUsd] = useState('');
  const [serviceType, setServiceType] = useState<'pickup' | 'delivery'>('delivery');
  const [address, setAddress] = useState('');
  const [coordinates, setCoordinates] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [itemsDescription, setItemsDescription] = useState('');
  const [notes, setNotes] = useState('');
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [clientsRes, usersRes] = await Promise.all([
          fetch('/api/clients?limit=100'), // For a real app, use a searchable select
          fetch('/api/users?role=delivery')
        ]);
        
        if (clientsRes.ok) {
          const clientsData = await clientsRes.json();
          setClients(clientsData.data || []);
        }
        
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setDeliveryUsers(usersData.data || []);
        }
      } catch {
        addToast('Error al cargar datos', 'error');
      }
    }
    fetchData();
  }, [addToast]);

  function handleClientChange(id: string) {
    setClientId(id);
    const client = clients.find(c => c.id === id);
    if (client) {
      if (client.address && !address) setAddress(client.address);
      if (client.phone && !contactInfo) setContactInfo(`${client.name} - ${client.phone}`);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !address || !contactInfo || !itemsDescription) {
      addToast('Por favor, completa los campos obligatorios', 'warning');
      return;
    }
    
    setLoading(true);
    try {
      const body = {
        clientId,
        serviceType,
        address,
        coordinates,
        contactInfo,
        itemsDescription,
        notes,
        deliveryUserId: deliveryUserId || undefined,
        amountUsd: amountUsd ? parseFloat(amountUsd) : undefined,
      };

      const res = await fetch('/api/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        addToast('Delivery registrado correctamente', 'success');
        router.push('/delivery');
      } else {
        const data = await res.json();
        addToast(data.error || 'Error al registrar', 'error');
      }
    } catch {
      addToast('Error al registrar', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Registrar Delivery Manual</h1>
        <Button variant="secondary" onClick={() => router.back()}>Volver</Button>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.section}>
          <h2>Información del Servicio</h2>
          
          <div className={styles.grid}>
            <div className={styles.field}>
              <label>Cliente *</label>
              <select 
                value={clientId} 
                onChange={e => handleClientChange(e.target.value)}
                className={styles.input}
                required
              >
                <option value="">Seleccione un cliente</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name} {c.clinicName ? `(${c.clinicName})` : ''}</option>
                ))}
              </select>
            </div>
            
            <div className={styles.field}>
              <label>Tipo de Servicio *</label>
              <select 
                value={serviceType} 
                onChange={e => setServiceType(e.target.value as any)}
                className={styles.input}
                required
              >
                <option value="delivery">Llevar desde laboratorio a destino</option>
                <option value="pickup">Recoger y traer al laboratorio</option>
              </select>
            </div>
            
            <div className={styles.field}>
              <label>Dirección Exacta *</label>
              <input 
                type="text" 
                value={address} 
                onChange={e => setAddress(e.target.value)}
                className={styles.input}
                required
              />
            </div>
            
            <div className={styles.field}>
              <label>Contacto (Nombre y Teléfono) *</label>
              <input 
                type="text" 
                value={contactInfo} 
                onChange={e => setContactInfo(e.target.value)}
                className={styles.input}
                required
              />
            </div>
            
            <div className={styles.fieldFull}>
              <label>Descripción de Artículos *</label>
              <input 
                type="text" 
                value={itemsDescription} 
                onChange={e => setItemsDescription(e.target.value)}
                className={styles.input}
                placeholder="Ej. 2 modelos, 1 corona..."
                required
              />
            </div>
          </div>
        </div>
        
        <div className={styles.section}>
          <h2>Asignación (Opcional)</h2>
          <p className={styles.hint}>Si no asignas a nadie, el servicio quedará pendiente para que los repartidores envíen propuestas.</p>
          
          <div className={styles.grid}>
            <div className={styles.field}>
              <label>Repartidor</label>
              <select 
                value={deliveryUserId} 
                onChange={e => setDeliveryUserId(e.target.value)}
                className={styles.input}
              >
                <option value="">Dejar pendiente</option>
                {deliveryUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            
            <div className={styles.field}>
              <label>Monto a Pagar (USD)</label>
              <input 
                type="number" 
                step="0.01" 
                value={amountUsd} 
                onChange={e => setAmountUsd(e.target.value)}
                className={styles.input}
                disabled={!deliveryUserId}
                placeholder={!deliveryUserId ? "Selecciona un repartidor primero" : ""}
                required={!!deliveryUserId}
              />
            </div>
          </div>
        </div>
        
        <div className={styles.actions}>
          <Button type="submit" disabled={loading}>
            {loading ? 'Guardando...' : 'Registrar Servicio'}
          </Button>
        </div>
      </form>
    </div>
  );
}
