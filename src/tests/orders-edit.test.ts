import { describe, it, expect, vi } from 'vitest';

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    query: {
      orders: {
        findFirst: vi.fn()
      },
      users: {
        findFirst: vi.fn()
      }
    },
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(true),
    transaction: vi.fn().mockRejectedValue(new Error('D1 transaction error'))
  }
}));

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: vi.fn().mockResolvedValue({ env: { DB: {} } })
}));

vi.mock('@/lib/session', () => ({
  getSession: vi.fn().mockResolvedValue({ id: 'user-1', role: 'tech' })
}));

vi.mock('@/db', () => ({
  getDb: vi.fn().mockReturnValue(mockDb)
}));

import { PATCH } from '@/app/api/orders/[id]/route';

describe('PATCH /api/orders/[id]', () => {
  it('allows tech role to edit order and falls back cleanly if transaction fails on D1', async () => {
    mockDb.query.orders.findFirst.mockResolvedValueOnce({
      id: 'order-123',
      patientName: 'Old Name',
      finalPriceUsd: 100
    });

    const request = new Request('http://localhost/api/orders/order-123', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientName: 'New Patient Name',
        finalPriceUsd: 150
      })
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'order-123' }) });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toEqual({ id: 'order-123', updated: true });
    expect(mockDb.update).toHaveBeenCalled();
  });
});
