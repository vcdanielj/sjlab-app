// ============================================
// SJ Lab — Pruebas de Delivery (Unit / Integration)
// ============================================
// Nota: Este archivo está preparado para ejecutarse con Vitest o Jest.
// Para correr las pruebas, instala vitest: npm install -D vitest

import { describe, it, expect, vi } from 'vitest';
import * as schema from '@/db/schema';
import { generateId } from '@/lib/utils';

// Mock de DB y Cloudflare Context
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: vi.fn().mockResolvedValue({ env: { DB: {} } })
}));

vi.mock('@/lib/session', () => ({
  getSession: vi.fn().mockResolvedValue({ id: 'admin-1', role: 'admin' })
}));

const mockDb = {
  query: {
    deliveries: {
      findFirst: vi.fn()
    },
    expenseCategories: {
      findFirst: vi.fn()
    }
  },
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  where: vi.fn().mockResolvedValue(true),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockResolvedValue(true)
};

vi.mock('@/db', () => ({
  getDb: vi.fn().mockReturnValue(mockDb)
}));

// Importar los handlers
import { PATCH } from '@/app/api/deliveries/[id]/status/route';
import { POST as CREATE_DELIVERY } from '@/app/api/deliveries/route';

describe('Delivery API - Flujo Contable y Aprobación', () => {
  it('Debe registrar un gasto y un abono automáticamente al completar un delivery', async () => {
    const deliveryId = generateId();
    
    // Mocking el delivery pendiente
    mockDb.query.deliveries.findFirst.mockResolvedValueOnce({
      id: deliveryId,
      deliveryUserId: 'delivery-1',
      status: 'accepted',
      finalAmountUsd: 15.0,
      serviceType: 'delivery'
    });

    // Ejecutar el request
    const request = new Request(`http://localhost/api/deliveries/${deliveryId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'completed' })
    });
    
    const response = await PATCH(request, { params: Promise.resolve({ id: deliveryId }) });
    const json = await response.json();
    
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);

    // Verificar que se actualizó el status a completed
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));

    // Verificar que se insertó el expense y el deliveryPayment
    expect(mockDb.insert).toHaveBeenCalledTimes(2); // 1 para expense, 1 para payment (asumiendo categoría existente)
  });

  it('Debe cancelar la solicitud si el admin la rechaza por costo excesivo', async () => {
    const deliveryId = generateId();
    
    mockDb.query.deliveries.findFirst.mockResolvedValueOnce({
      id: deliveryId,
      deliveryUserId: 'delivery-1',
      status: 'proposed',
      proposedAmountUsd: 100.0, // Monto excesivo
      serviceType: 'delivery'
    });

    const request = new Request(`http://localhost/api/deliveries/${deliveryId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'cancelled' })
    });
    
    const response = await PATCH(request, { params: Promise.resolve({ id: deliveryId }) });
    const json = await response.json();
    
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    
    expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({ status: 'cancelled' }));
  });
});

describe('Delivery API - Carga Automática y Creación', () => {
  it('Debe fallar si faltan campos obligatorios en el registro manual o automático', async () => {
    const request = new Request(`http://localhost/api/deliveries`, {
      method: 'POST',
      body: JSON.stringify({
        // Faltan campos como address, contactInfo
        clientId: 'client-1',
        serviceType: 'pickup'
      })
    });
    
    const response = await CREATE_DELIVERY(request);
    const json = await response.json();
    
    expect(response.status).toBe(400);
    expect(json.error).toBe('Faltan campos obligatorios');
  });
});
