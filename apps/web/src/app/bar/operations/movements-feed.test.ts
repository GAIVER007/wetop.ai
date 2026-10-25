import { describe, expect, it } from 'vitest';
import type { BarMovementRow, BarSaleRow } from '../../../lib/api';
import { movementRows, periodRange, parseMovementType, typeFromHash } from './movements-feed';

const sale = (id: string, createdAt: string, name = 'Вымышленный сок'): BarSaleRow => ({
  id, createdAt, currency: 'KZT', status: 'POSTED', totalRevenue: '500', totalCost: '200',
  lines: [{ id: `${id}-l`, productId: 'p', quantityUnits: '2', salePrice: '250', revenue: '500', cost: '200', product: { name } }],
});
const move = (id: string, kind: BarMovementRow['kind'], units: string, createdAt: string, name = 'Вымышленная вода'): BarMovementRow => ({
  id, productId: 'p', kind, units, unitCost: '10', amountMinor: '100', note: null, createdAt, product: { name },
});
const data = {
  sales: [sale('s1', '2026-10-20T10:00:00Z')],
  movements: [
    move('m-sale', 'SALE', '2', '2026-10-20T10:00:00Z'),
    move('m-rec', 'RECEIPT', '10', '2026-10-19T10:00:00Z'),
    move('m-wo', 'WRITE_OFF', '1', '2026-10-21T10:00:00Z'),
    move('m-ret', 'SALE_RETURN', '2', '2026-10-22T10:00:00Z'),
    move('m-inv', 'INVENTORY_ADJUSTMENT', '-3', '2026-10-23T10:00:00Z', 'Вымышленные чипсы'),
  ],
};

describe('movementRows', () => {
  it('all types newest first, sale movement not duplicated', () => {
    expect(movementRows(data).map((r) => r.id)).toEqual(['movement-m-inv', 'movement-m-ret', 'movement-m-wo', 'sale-s1', 'movement-m-rec']);
  });
  it.each([
    ['sales', ['sale-s1']],
    ['returns', ['movement-m-ret']],
    ['writeoff', ['movement-m-wo']],
    ['inventory', ['movement-m-inv']],
    ['receipts', ['movement-m-rec']],
  ] as const)('type %s', (type, ids) => {
    expect(movementRows(data, type).map((r) => r.id)).toEqual(ids);
  });
  it('signed quantity: in plus, out minus', () => {
    const byId = Object.fromEntries(movementRows(data).map((r) => [r.id, [r.quantity, r.direction]]));
    expect(byId).toMatchObject({
      'sale-s1': ['−2', 'out'], 'movement-m-rec': ['+10', 'in'], 'movement-m-wo': ['−1', 'out'],
      'movement-m-ret': ['+2', 'in'], 'movement-m-inv': ['−3', 'out'],
    });
  });
  it('item search and period', () => {
    expect(movementRows(data, '', { query: 'чипсы' }).map((r) => r.id)).toEqual(['movement-m-inv']);
    expect(movementRows(data, '', { from: '2026-10-20', to: '2026-10-21' }).map((r) => r.id)).toEqual(['movement-m-wo', 'sale-s1']);
  });
  it('periods and old anchors', () => {
    expect(periodRange('yesterday', '2026-10-25')).toEqual({ from: '2026-10-24', to: '2026-10-24' });
    expect(periodRange('week', '2026-10-25')).toEqual({ from: '2026-10-19', to: '2026-10-25' });
    expect(periodRange('month', '2026-10-25')).toEqual({ from: '2026-10-01', to: '2026-10-25' });
    expect(typeFromHash('#bar-sales')).toBe('sales');
    expect(typeFromHash('#bar-inventory')).toBe('inventory');
    expect(typeFromHash('#bar-writeoff')).toBe('writeoff');
    expect(parseMovementType('bogus')).toBe('');
  });
});
