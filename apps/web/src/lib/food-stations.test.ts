import { describe, expect, it } from 'vitest';
import { stationLines } from './food-stations';
import type { OrderView } from './food-types';

describe('позиции станции (§33.6)', () => {
  const order = {
    items: [
      { id: 'tea', station: 'BAR', status: 'NEW' },
      { id: 'soup', station: 'KITCHEN', status: 'COOKING' },
      { id: 'juice', station: 'BAR', status: 'SERVED' },
      { id: 'old', menuItemId: null },
    ],
  } as unknown as OrderView;
  it('бар видит свои неподанные, кухня свои и строки старого ответа без станции', () => {
    expect(stationLines(order, 'BAR').map((i) => i.id)).toEqual(['tea']);
    expect(stationLines(order, 'KITCHEN').map((i) => i.id)).toEqual(['soup', 'old']);
  });
});
