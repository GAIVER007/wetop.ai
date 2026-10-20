import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BeautyDay, BranchItem } from '../../lib/api';
const read = vi.hoisted(() => vi.fn());
vi.mock('../../lib/api', () => ({ branchReportDay: read }));
import { buildSalonReport, loadSalonReport } from './salon-report-data';
const branch = {
  id: 'b',
  locationId: 'l',
  vertical: 'BEAUTY',
  name: 'Салон Пример',
  timezone: 'Asia/Almaty',
  location: { businessId: 'business' },
} as BranchItem;
const appointment = (id: string, extra = {}) => ({
  id,
  status: 'DONE',
  startsAt: '2026-10-18T06:00:00Z',
  employeeId: 'e',
  serviceId: 's',
  serviceName: 'Услуга Пример',
  priceMinor: '100',
  currency: 'KZT',
  ...extra,
});
const day = (rows: ReturnType<typeof appointment>[], extra = {}) =>
  ({
    date: '2026-10-18',
    location: { id: 'l', timezone: 'Asia/Almaty', currency: 'KZT' },
    columns: [{ id: 'e', name: 'Мастер Пример' }],
    appointments: rows,
    ...extra,
  }) as unknown as BeautyDay;
beforeEach(() => read.mockReset());
describe('salon reports from guarded day snapshots', () => {
  it('keeps all services, exact integer totals and historical currencies separate', () => {
    const rows = Array.from({ length: 7 }, (_, i) =>
      appointment('a' + i, { serviceId: 's' + i, serviceName: 'Услуга ' + i }),
    );
    rows.push(appointment('large', { priceMinor: '9007199254740993' }));
    rows.push(appointment('usd', { currency: 'USD', priceMinor: '500' }));
    rows.push(appointment('booked', { status: 'BOOKED', priceMinor: '999999' }));
    const report = buildSalonReport([day(rows)]);
    expect(report.counts).toMatchObject({ DONE: 9, BOOKED: 1 });
    expect(report.currencies.find((r) => r.currency === 'KZT')).toMatchObject({
      costMinor: '9007199254741693',
      visits: 8,
    });
    expect(report.currencies.find((r) => r.currency === 'USD')).toMatchObject({
      costMinor: '500',
      visits: 1,
    });
    expect(report.services.filter((r) => r.currency === 'KZT')).toHaveLength(8);
  });
  it('counts a multi-service visit once per master and each service line separately', () => {
    const items = [
      { employeeId: 'e', serviceId: 's1', serviceName: 'Первая', priceMinor: '100' },
      { employeeId: 'e', serviceId: 's2', serviceName: 'Вторая', priceMinor: '200' },
      { employeeId: 'e2', serviceId: 's3', serviceName: 'Третья', priceMinor: '300' },
    ];
    const report = buildSalonReport([day([appointment('multi', { priceMinor: '600', items })])]);
    expect(report.masters.find((m) => m.id === 'e')).toMatchObject({
      visits: 1,
      services: 2,
      costMinor: '300',
    });
    expect(report.masters.find((m) => m.id === 'e2')).toMatchObject({
      visits: 1,
      services: 1,
      costMinor: '300',
    });
    expect(report.services).toHaveLength(3);
    expect(report.currencies[0]).toMatchObject({ visits: 1, costMinor: '600' });
  });
  it('rejects duplicate visits, invalid prices, and inconsistent line totals', () => {
    expect(() => buildSalonReport([day([appointment('same'), appointment('same')])])).toThrow();
    expect(() => buildSalonReport([day([appointment('bad', { priceMinor: '1.2' })])])).toThrow();
    expect(() =>
      buildSalonReport([
        day([
          appointment('bad', {
            items: [{ employeeId: 'e', serviceId: 's', serviceName: 'Услуга', priceMinor: '99' }],
          }),
        ]),
      ]),
    ).toThrow();
  });
  it('loads sequentially and rejects wrong branch, timezone, date and local appointment day', async () => {
    read.mockResolvedValue(day([appointment('a')]));
    expect((await loadSalonReport(branch, ['2026-10-18'])).currencies[0]?.costMinor).toBe('100');
    expect(read).toHaveBeenCalledWith(branch, '2026-10-18');
    for (const value of [
      day([], { date: '2026-10-19' }),
      day([], { location: { id: 'foreign', timezone: 'Asia/Almaty' } }),
      day([], { location: { id: 'l', timezone: 'UTC' } }),
    ]) {
      read.mockResolvedValue(value);
      await expect(loadSalonReport(branch, ['2026-10-18'])).rejects.toThrow();
    }
  });
  it('attributes overlapping calendar visits to their local start date exactly once', async () => {
    const overnight = appointment('night', {
      startsAt: '2026-10-18T18:30:00Z',
      endsAt: '2026-10-18T20:00:00Z',
    });
    read
      .mockResolvedValueOnce(day([overnight]))
      .mockResolvedValueOnce(day([overnight], { date: '2026-10-19' }));
    const report = await loadSalonReport(branch, ['2026-10-18', '2026-10-19']);
    expect(report.currencies[0]).toMatchObject({ visits: 1, costMinor: '100' });
    read.mockResolvedValueOnce(day([overnight], { date: '2026-10-19' }));
    expect((await loadSalonReport(branch, ['2026-10-19'])).currencies).toEqual([]);
  });
  it('keeps the historical line employee name when absent from calendar columns', () => {
    const report = buildSalonReport([
      day([
        appointment('archive', {
          items: [
            {
              employeeId: 'former',
              employeeName: 'Исторический мастер',
              serviceId: 's',
              serviceName: 'Услуга',
              priceMinor: '100',
            },
          ],
        }),
      ]),
    ]);
    expect(report.masters[0]?.name).toBe('Исторический мастер');
  });
  it('does not return partial totals after a day API error', async () => {
    read.mockResolvedValueOnce(day([appointment('a')])).mockRejectedValueOnce(new Error('403'));
    await expect(loadSalonReport(branch, ['2026-10-18', '2026-10-19'])).rejects.toThrow('403');
  });
});
