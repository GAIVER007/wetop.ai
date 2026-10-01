import { describe, expect, it } from 'vitest';
import { buildDashboard, type DashboardPeriod } from '../dashboard/metrics';
import { parseBranchInput, summarizeBranches } from './branches';

/**
 * Филиалы организации (Platform P3, ADR-130; план `plans/platform-p3-branches-2026-10-01.md` §3): разбор формы «Добавить
 * филиал» одной функцией для стойки и API и итог сводки по филиалам, суммы по валютам, занятость взвешенно по фонду.
 */
describe('parseBranchInput', () => {
  const defaults = { timezone: 'Asia/Almaty', currency: 'KZT' };

  it('название обязательно, лишние пробелы схлопываются, остальное, умолчания первого филиала', () => {
    const parsed = parseBranchInput({ name: '  Luxx   Astana ' }, defaults);
    expect(parsed).toEqual({
      ok: true,
      value: {
        name: 'Luxx Astana',
        address: null,
        phone: null,
        email: null,
        timezone: 'Asia/Almaty',
        currency: 'KZT',
      },
    });
  });

  it('пустое название и название из одного знака, ошибка у поля', () => {
    expect(parseBranchInput({ name: '' }, defaults)).toEqual({
      ok: false,
      field: 'name',
      reason: 'Укажите название филиала',
    });
    expect(parseBranchInput({ name: 'A' }, defaults)).toMatchObject({ ok: false, field: 'name' });
    expect(parseBranchInput({ name: 'x'.repeat(201) }, defaults)).toMatchObject({ ok: false, field: 'name' });
  });

  it('часовой пояс, только настоящий IANA, валюта, три латинские буквы в любом регистре', () => {
    expect(parseBranchInput({ name: 'Marina', timezone: 'Asia/Dubai', currency: 'aed' }, defaults)).toMatchObject({
      ok: true,
      value: { timezone: 'Asia/Dubai', currency: 'AED' },
    });
    expect(parseBranchInput({ name: 'Marina', timezone: 'Mars/Olympus' }, defaults)).toEqual({
      ok: false,
      field: 'timezone',
      reason: 'Часовой пояс, в виде Asia/Almaty',
    });
    expect(parseBranchInput({ name: 'Marina', currency: 'тенге' }, defaults)).toEqual({
      ok: false,
      field: 'currency',
      reason: 'Валюта, три латинские буквы, например KZT',
    });
  });

  it('телефон и почта, как у объекта: 5–15 цифр и name@example.kz', () => {
    expect(parseBranchInput({ name: 'Marina', phone: '+7 701 000 00 00', email: 'Marina@Example.kz' }, defaults)).toMatchObject({
      ok: true,
      value: { phone: '+7 701 000 00 00', email: 'marina@example.kz' },
    });
    expect(parseBranchInput({ name: 'Marina', phone: '12' }, defaults)).toMatchObject({ ok: false, field: 'phone' });
    expect(parseBranchInput({ name: 'Marina', email: 'нет' }, defaults)).toMatchObject({ ok: false, field: 'email' });
    expect(parseBranchInput({ name: 'Marina', address: 'a'.repeat(501) }, defaults)).toMatchObject({
      ok: false,
      field: 'address',
    });
  });

  it('не объект, нечего сохранять', () => {
    expect(parseBranchInput(null, defaults)).toMatchObject({ ok: false });
  });
});

const period = (input: {
  units: number;
  occupied: number;
  nights?: number;
  accommodation?: bigint;
  payments?: bigint;
}): DashboardPeriod => {
  const nights = input.nights ?? 2;
  const days = Array.from({ length: nights }, (_, i) => ({
    date: `2026-10-0${i + 1}`,
    occupied: input.occupied,
    free: input.units - input.occupied,
    blocked: 0,
    byCategory: { STD: { units: input.units, occupied: input.occupied, free: input.units - input.occupied, blocked: 0 } },
  }));
  return buildDashboard({
    from: '2026-10-01',
    to: `2026-10-0${nights}`,
    categories: [{ code: 'STD', name: 'Стандарт', units: input.units, kind: 'ROOM' }],
    days,
    unassignedByCategory: {},
    stays: [],
    charges:
      input.accommodation === undefined
        ? []
        : [{ kind: 'ACCOMMODATION', amountMinor: input.accommodation, categoryCode: 'STD', serviceDate: '2026-10-01' }],
    payments:
      input.payments === undefined
        ? []
        : [{ method: 'CASH', amountMinor: input.payments }],
    refundsMinor: 0n,
  });
};

describe('summarizeBranches', () => {
  it('итог: ночи и заезды суммой, занятость, взвешенно по фонду, деньги, по валютам, ADR при одной валюте', () => {
    const a = period({ units: 10, occupied: 5, accommodation: 100_000n, payments: 50_000n });
    const b = period({ units: 30, occupied: 30, accommodation: 300_000n });
    const total = summarizeBranches([
      { locationId: 'l1', currency: 'KZT', period: a },
      { locationId: 'l2', currency: 'KZT', period: b },
    ]);
    expect(total.occupancy).toEqual({ unitNights: 80, occupiedNights: 70, blockedNights: 0, freeNights: 10, percent: 87.5 });
    expect(total.money).toEqual([
      { currency: 'KZT', revenueMinor: '400000', paymentsMinor: '50000', refundsMinor: '0', adrMinor: '5714', revparMinor: '5000' },
    ]);
    expect(total.arrivals).toBe(0);
    expect(total.bookings).toBe(0);
    expect(total.branches).toBe(2);
  });

  it('разные валюты не складываются: по строке на валюту, ADR и RevPAR у каждой свои', () => {
    const total = summarizeBranches([
      { locationId: 'l1', currency: 'KZT', period: period({ units: 10, occupied: 5, accommodation: 100_000n }) },
      { locationId: 'l2', currency: 'AED', period: period({ units: 10, occupied: 10, accommodation: 2_000n }) },
    ]);
    expect(total.money.map((m) => [m.currency, m.revenueMinor, m.adrMinor])).toEqual([
      ['KZT', '100000', '10000'],
      ['AED', '2000', '100'],
    ]);
    expect(total.occupancy.percent).toBe(75);
  });

  it('филиал без объекта (period null) в итог не входит, но считается в branches', () => {
    const total = summarizeBranches([
      { locationId: 'l1', currency: 'KZT', period: period({ units: 10, occupied: 10 }) },
      { locationId: 'l2', currency: 'KZT', period: null },
    ]);
    expect(total.branches).toBe(2);
    expect(total.occupancy.unitNights).toBe(20);
    expect(total.money).toEqual([
      { currency: 'KZT', revenueMinor: '0', paymentsMinor: '0', refundsMinor: '0', adrMinor: '0', revparMinor: '0' },
    ]);
  });

  it('пусто, нули и ни одной валюты', () => {
    expect(summarizeBranches([])).toEqual({
      branches: 0,
      occupancy: { unitNights: 0, occupiedNights: 0, blockedNights: 0, freeNights: 0, percent: 0 },
      arrivals: 0,
      bookings: 0,
      money: [],
    });
  });
});
