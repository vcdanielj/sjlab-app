'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import styles from './page.module.css';

export default function RequestDeliveryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Data
  const [clientId, setClientId] = useState('');
  const [patientName, setPatientName] = useState('');

  // Form
  const [serviceType, setServiceType] = useState('pickup'); // 'pickup' | 'delivery'
  const [address, setAddress] = useState('');
  const [coordinates, setCoordinates] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [itemsDescription, setItemsDescription] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    async function fetchOrderData() {
      try {
        const res = await fetch(`/api/orders/${id}`);
        const data = await res.json();
        if (data.data) {
          const order = data.data.order;
          setClientId(order.clientId);
          setPatientName(order.patientName);
          
          // Fetch client details for prepopulating
          const clientRes = await fetch(`/api/clients/${order.clientId}`);
          const clientData = await clientRes.json();
          if (clientData.data) {
            const client = clientData.data.client;
            setAddress(client.address || '');
            setContactInfo(`${client.name} - ${client.phone || ''}`);
            setItemsDescription(`Trabajo de laboratorio para paciente: ${order.patientName}`);
          }
        }
      } catch (e) {
        addToast('Error al cargar datos del pedido', 'error');
      } finally {
        setLoading(false);
      }
    }
    fetchOrderData();
  }, [id, addToast]);

  async function handleGetLocation() {
    if (!navigator.geolocation) {
      addToast('Geolocalización no soportada en este navegador', 'warning');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates(`${position.coords.latitude},${position.coords.longitude}`);
        addToast('Ubicación obtenida', 'success');
      },
      () => {
        addToast('No se pudo obtener la ubicación. Verifique permisos.', 'error');
      }
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address.trim() || !contactInfo.trim() || !itemsDescription.trim()) {
      addToast('Llene todos los campos obligatorios', 'warning');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: id,
          clientId,
          serviceType,
          address,
          coordinates,
          contactInfo,
          itemsDescription,
          notes
        }),
      });

      if (res.ok) {
        addToast('Servicio de delivery solicitado con éxito', 'success');
        router.push('/orders');
      } else {
        const data = await res.json();
        addToast(data.error || 'Error al solicitar', 'error');
      }
    } catch {
      addToast('Error de red', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ padding: '40px' }}>Cargando datos...</div>;

  return (
    <div className={styles.container}>
      <button className={styles.backBtn} onClick={() => router.push('/orders')}>
        ← Volver a Pedidos
      </button>
      <div className={styles.header}>
        <h1 className={styles.title}>Solicitar Servicio de Delivery</h1>
        <p className={styles.subtitle}>Pedido asociado: Paciente {patientName}</p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.formGrid}>
          <Select
            label="Tipo de Servicio *"
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
            required
          >
            <option value="pickup">Recoger y traer al laboratorio</option>
            <option value="delivery">Llevar desde el laboratorio a destino</option>
          </Select>

          <Input
            label="Información de Contacto *"
            value={contactInfo}
            onChange={(e) => setContactInfo(e.target.value)}
            placeholder="Nombre y teléfono de quien recibe/entrega"
            required
          />

          <div style={{ gridColumn: '1 / -1' }}>
            <Input
              label="Dirección Exacta *"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Av. Principal, Edificio, Piso, Oficina"
              required
            />
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <Input
                label="Coordenadas GPS (Opcional)"
                value={coordinates}
                onChange={(e) => setCoordinates(e.target.value)}
                placeholder="Latitud, Longitud"
              />
            </div>
            <Button type="button" variant="secondary" onClick={handleGetLocation}>
              📍 Obtener mi ubicación actual
            </Button>
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <Input
              label="Descripción de Artículos *"
              value={itemsDescription}
              onChange={(e) => setItemsDescription(e.target.value)}
              placeholder="Ej: Moldes dentales, corona, etc."
              required
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <Input
              label="Notas Adicionales (Opcional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instrucciones para el repartidor..."
            />
          </div>
        </div>

        <div className={styles.formActions}>
          <Button type="button" variant="secondary" onClick={() => router.push('/orders')}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Confirmar Solicitud
          </Button>
        </div>
      </form>
    </div>
  );
}