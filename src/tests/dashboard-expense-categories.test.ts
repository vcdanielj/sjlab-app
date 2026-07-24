import { describe, it, expect, vi } from 'vitest';

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn()
      .mockResolvedValueOnce([
        { catId: 'cat-1', legacyCat: 'material', catName: 'Materiales Odontológicos', catColor: '#3B82F6', total: 150.0 },
        { catId: 'cat-2', legacyCat: 'servicios', catName: 'Servicios Básicos', catColor: '#F59E0B', total: 50.0 }
      ])
      .mockResolvedValueOnce([])
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

import { GET } from '@/app/api/dashboard/expense-categories/route';

describe('GET /api/dashboard/expense-categories', () => {
  it('returns expense categories distribution grouped by category', async () => {
    const request = new Request('http://localhost/api/dashboard/expense-categories?from=1000&to=2000&expenseScope=all');
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.totalSum).toBe(200);
    expect(json.data).toHaveLength(2);
    expect(json.data[0]).toEqual({
      name: 'Materiales Odontológicos',
      color: '#3B82F6',
      value: 150.0,
      percentage: 75
    });
    expect(json.data[1]).toEqual({
      name: 'Servicios Básicos',
      color: '#10B981',
      value: 50.0,
      percentage: 25
    });

    expect(json.lab.totalSum).toBe(200);
    expect(json.lab.data).toHaveLength(2);
    expect(json.personal.totalSum).toBe(0);
  });
});
