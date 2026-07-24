import { describe, it, expect, vi } from 'vitest';

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([
      { id: '1', orderNumber: 101, patientName: 'Juan Perez', clientName: 'Dr. Lopez', finalPriceUsd: 100, createdAt: 1700000000 }
    ])
  }
}));

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: vi.fn().mockResolvedValue({ env: { DB: {} } })
}));

vi.mock('@/lib/session', () => ({
  getSession: vi.fn().mockResolvedValue({ id: 'admin-1', role: 'admin' })
}));

vi.mock('@/db', () => ({
  getDb: vi.fn().mockReturnValue(mockDb)
}));

import { GET } from '@/app/api/dashboard/kpi-detail/route';

describe('GET /api/dashboard/kpi-detail', () => {
  it('returns orders for totalInvoiced', async () => {
    const request = new Request('http://localhost/api/dashboard/kpi-detail?kpi=totalInvoiced&from=1000&to=2000');
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.type).toBe('orders');
    expect(json.data.rows).toBeDefined();
  });

  it('handles expenseRatio without crashing', async () => {
    mockDb.where.mockResolvedValueOnce([{ total: 1000 }]);
    mockDb.where.mockResolvedValueOnce([{ total: 500 }]);
    mockDb.where.mockResolvedValueOnce([{ total: 300, personal: 100, lab: 200 }]);

    const request = new Request('http://localhost/api/dashboard/kpi-detail?kpi=expenseRatio&from=1000&to=2000');
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.type).toBe('expenseRatio');
    expect(json.data.rows.invoiced).toBe(1000);
    expect(json.data.rows.collected).toBe(500);
    expect(json.data.rows.totalExpenses).toBe(300);
    expect(json.data.rows.expenseRatio).toBe(30);
  });
});
