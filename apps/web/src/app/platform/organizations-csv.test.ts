import { describe, expect, it } from 'vitest';
import { EMPTY_METRICS, type PlatformOverview } from '@pms/domain';
import { organizationsCsv } from './organizations-csv';

const data: Pick<PlatformOverview, 'organizations' | 'period'> = {
  period: { from: '2026-10-01', to: '2026-10-09', previousFrom: '2026-09-22', previousTo: '2026-09-30', month: '2026-10' },
  organizations: [
    {
      id: 'o',
      name: '=HYPERLINK("x")',
      status: 'ACTIVE',
      createdAt: '2026-08-01T00:00:00Z',
      owners: ['secret@example.invalid'],
      businesses: [],
      branches: [
        {
          id: 'b1',
          name: 'Центр; главный',
          address: null,
          currency: 'KZT',
          timezone: 'Asia/Almaty',
          vertical: 'HOSPITALITY',
          businessId: 'x',
          metrics: { ...EMPTY_METRICS, revenueMinor: 1_234_550, occupiedNights: 30, unitNights: 100, guests: 12 },
          previous: EMPTY_METRICS,
        },
        {
          id: 'b2',
          name: 'Мондо',
          address: 'Алматы',
          currency: 'KZT',
          timezone: 'Asia/Almaty',
          vertical: 'FOOD_SERVICE',
          businessId: 'y',
          metrics: { ...EMPTY_METRICS, guests: 64, bookings: 20 },
          previous: EMPTY_METRICS,
        },
      ],
    },
  ],
};

describe('выгрузка организаций', () => {
  const lines = organizationsCsv(data).split('\r\n');
  it('BOM, разделитель «;», суммы как в выгрузках финансов', () => {
    expect(lines[0]!.startsWith('\uFEFF')).toBe(true);
    expect(lines[1]).toContain('12345,50;30;12;');
  });
  it('нет данных это пустая ячейка, а не ноль; почт владельцев в файле нет', () => {
    expect(lines[2]!.split(';').slice(6, 8)).toEqual(['', '']);
    expect(lines.join('')).not.toContain('secret@example.invalid');
  });
  it('формула в названии получает апостроф, «;» в названии берётся в кавычки', () => {
    expect(lines[1]!.startsWith(`"'=HYPERLINK`)).toBe(true);
    expect(lines[1]).toContain('"Центр; главный"');
  });
});
