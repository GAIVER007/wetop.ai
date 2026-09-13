import { describe, expect, it } from 'vitest';
import { buildCancellations, money, pct, type CancelRow } from './cancellations';

const row = (o: Partial<CancelRow> & Pick<CancelRow, 'status'>): CancelRow => ({
  source: 'DESK',
  channel: null,
  arrivalDate: '2026-08-10',
  departureDate: '2026-08-12',
  totalAmount: 1000n,
  items: [{ status: o.status, category: 'Общая мужская комната', nightsInMonth: 2 }],
  ...o,
});

describe('отмены за месяц', () => {
  it('считает отмены, незаезды и долю по штукам', () => {
    const r = buildCancellations('2026-08', [
      row({ status: 'CANCELLED' }),
      row({ status: 'NO_SHOW' }),
      row({ status: 'CHECKED_OUT' }),
      row({ status: 'CHECKED_OUT' }),
    ]);
    expect(r.total).toBe(4);
    expect(r.cancelled).toBe(1);
    expect(r.noShow).toBe(1);
    expect(r.sharePct).toBe(50);
  });

  it('делит деньги на не доехавшие и заработанные, ночи считает только у потерянных', () => {
    const r = buildCancellations('2026-08', [
      row({ status: 'CANCELLED', totalAmount: 700n }),
      row({ status: 'CHECKED_OUT', totalAmount: 300n }),
    ]);
    expect(r.lostAmount).toBe(700n);
    expect(r.keptAmount).toBe(300n);
    expect(r.lostNights).toBe(2);
  });

  it('группирует по источнику с каналом и сортирует по числу потерянных', () => {
    const r = buildCancellations('2026-08', [
      row({ status: 'CHECKED_OUT' }),
      row({ status: 'CANCELLED', source: 'OTA', channel: 'booking.com' }),
      row({ status: 'CANCELLED', source: 'OTA', channel: 'booking.com' }),
      row({ status: 'CHECKED_OUT', source: 'OTA', channel: 'booking.com' }),
    ]);
    expect(r.byChannel.map((g) => g.name)).toEqual(['OTA · booking.com', 'DESK']);
    const bdc = r.byChannel[0]!;
    expect(bdc.total).toBe(3);
    expect(bdc.cancelled).toBe(2);
    expect(bdc.sharePct).toBe(67);
    expect(r.byChannel[1]!.sharePct).toBe(0);
  });

  it('собирает категории только по отменённым проживаниям', () => {
    const r = buildCancellations('2026-08', [
      row({
        status: 'CANCELLED',
        items: [
          { status: 'CANCELLED', category: 'Двухместная комната', nightsInMonth: 3 },
          { status: 'CANCELLED', category: 'Двухместная комната', nightsInMonth: 1 },
        ],
      }),
      row({
        status: 'CHECKED_OUT',
        items: [{ status: 'CHECKED_OUT', category: 'Двухместная комната', nightsInMonth: 5 }],
      }),
    ]);
    expect(r.byCategory).toEqual([{ name: 'Двухместная комната', cancelled: 2, nights: 4 }]);
  });

  it('пустой месяц не делит на ноль', () => {
    const r = buildCancellations('2026-08', []);
    expect(r.sharePct).toBe(0);
    expect(r.lostAmount).toBe(0n);
    expect(pct(0, 0)).toBe(0);
  });

  it('деньги печатаются тиынами с разрядами', () => {
    expect(money(1568801800n)).toBe('15 688 018,00 ₸');
    expect(money(0n)).toBe('0,00 ₸');
    expect(money(-5000n)).toBe('−50,00 ₸');
  });
});
