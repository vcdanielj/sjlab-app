import { describe, it, expect } from 'vitest';
import { mapPaymentMethodToAccount } from '../lib/treasury';

describe('Treasury Engine Helpers', () => {
  it('maps payment methods and currencies correctly to account IDs', () => {
    expect(mapPaymentMethodToAccount('Zelle', 'USD')).toBe('zelle');
    expect(mapPaymentMethodToAccount('Transferencia', 'USD')).toBe('zelle');
    expect(mapPaymentMethodToAccount('Binance', 'USD')).toBe('binance');
    expect(mapPaymentMethodToAccount('Efectivo', 'USD')).toBe('efectivo');
    expect(mapPaymentMethodToAccount('Pago Móvil', 'VES')).toBe('bolivares');
    expect(mapPaymentMethodToAccount('Transferencia Banesco', 'VES')).toBe('bolivares');
    expect(mapPaymentMethodToAccount('', 'VES')).toBe('bolivares');
  });

  it('calculates net balance formula correctly', () => {
    const initialBalance = 1000;
    const inflows = 500;
    const outflows = 200;
    const transfersIn = 150;
    const transfersOut = 50;
    const adjustmentsIn = 30;
    const adjustmentsOut = 10;

    const net =
      initialBalance +
      inflows -
      outflows +
      transfersIn -
      transfersOut +
      adjustmentsIn -
      adjustmentsOut;

    expect(net).toBe(1420);
  });
});
