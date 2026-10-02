import { describe, expect, it } from 'vitest';
import { summarizeBranches } from './branch-summary';
const row = (currency: string, occupied: number, capacity: number, amount: string) => ({
  branch: { currency }, stats: {
    occupancy: { unitNights: capacity, occupiedNights: occupied, blockedNights: 0, freeNights: capacity - occupied, percent: 0 },
    arrivals: { count: 1, guests: 2, cancelled: 0, noShow: 0 },
    revenue: { accommodationMinor: amount, servicesMinor: '0', penaltiesMinor: '0', adjustmentsMinor: '0', totalMinor: amount },
    payments: { totalMinor: amount, count: 1, byMethod: [] }, refundsMinor: '100',
  },
});
describe('общая статистика филиалов', () => {
  it('взвешивает загрузку по фонду и не теряет точность денег', () => {
    const result = summarizeBranches([row('KZT', 1, 1, '9007199254740993'), row('KZT', 0, 9, '2')]);
    expect(result.percent).toBe(10);
    expect(result.guests).toBe(4);
    expect(result.currencies.get('KZT')).toEqual({ revenue: 9007199254740995n, paid: 9007199254740995n, refunded: 200n });
  });
  it('разделяет валюты и обрабатывает пустую сеть', () => {
    expect(summarizeBranches([row('KZT', 0, 0, '100'), row('USD', 0, 0, '200')]).currencies.size).toBe(2);
    expect(summarizeBranches([]).percent).toBe(0);
  });
});
