import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ReservationDirectory } from './reservation-directory';
import { forgetPropertyRef } from '../database/property-ref';
const fixture = () => {
  const db = {
    property: { findFirst: vi.fn().mockResolvedValue({ id: 'p' }) },
    reservation: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
      groupBy: vi.fn().mockResolvedValue([]),
    },
  };
  return { db, service: new ReservationDirectory({ db } as never) };
};
describe('reservation directory is a bounded read projection', () => {
  it('rejects repeated or structured query parameters with a client error', async () => {
    for (const query of [{ q: ['one', 'two'] }, { from: ['2026-09-13'] }, { page: {} }]) {
      const { db, service } = fixture();
      await expect(service.list(query as never)).rejects.toBeInstanceOf(BadRequestException);
      expect(db.property.findFirst).not.toHaveBeenCalled();
    }
  });
  it('rejects invalid dates, statuses and pagination before querying records', async () => {
    for (const params of [
      { from: '2026-02-30', to: '2026-03-05' },
      { from: '2026-09-13', to: '2026-09-01' },
      { status: 'BOGUS' },
      { page: '0' },
      { page: '1.5' },
    ]) {
      const { db, service } = fixture();
      await expect(service.list(params)).rejects.toThrow();
      expect(db.reservation.findMany).not.toHaveBeenCalled();
    }
  });
  it('scopes and limits reads, preserving empty data and decimal-safe money', async () => {
    const { db, service } = fixture();
    const result = await service.list({
      from: '2026-09-01',
      to: '2026-09-30',
      status: 'CONFIRMED',
      page: '2',
      q: 'Демо',
    });
    expect(result).toMatchObject({ rows: [], total: 0, page: 2, pageSize: 25 });
    expect(db.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 25,
        skip: 25,
        where: expect.objectContaining({ propertyId: 'p', status: 'CONFIRMED' }),
      }),
    );
  });
  /**
   * «Гости» показывают всех, кто живёт сегодня: на объекте до 92 гостей, а страница в 25 строк
   * молча обрезала список — смена видела первых 25 из ~80 и не знала, что остальные есть.
   * Размер страницы задаёт вызывающий, но в пределах: без потолка один запрос вытянет всю базу.
   */
  it('размер страницы задаётся вызывающим, по умолчанию прежние 25', async () => {
    const { db, service } = fixture();
    const result = await service.list({ from: '2026-09-17', to: '2026-09-17', pageSize: '200' });
    expect(result).toMatchObject({ pageSize: 200, page: 1 });
    expect(db.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 200, skip: 0 }),
    );
  });

  it('негодный размер страницы отклоняется до запроса к базе', async () => {
    for (const params of [
      { pageSize: '0' },
      { pageSize: '201' },
      { pageSize: '2.5' },
      { pageSize: 'все' },
    ]) {
      const { db, service } = fixture();
      await expect(service.list(params)).rejects.toBeInstanceOf(BadRequestException);
      expect(db.reservation.findMany).not.toHaveBeenCalled();
    }
  });

  /**
   * Числа на чипах статусов: считаются по тому же отбору без статуса, иначе выбранный статус
   * обнулил бы остальные и смена видела бы «Проживают 0» при трёх проживающих.
   */
  it('ADR-071: ищет и по номеру брони в канале — без пробелов, как его хранит стойка', async () => {
    const { db, service } = fixture();
    await service.list({ q: '999 601 3801' });
    const where = db.reservation.findMany.mock.calls[0]![0].where;
    expect(where.OR).toContainEqual({ externalId: { contains: '9996013801' } });
  });
  it('считает брони по статусам отбором без самого статуса', async () => {
    const { db, service } = fixture();
    db.reservation.groupBy.mockResolvedValue([
      { status: 'CONFIRMED', _count: { _all: 4 } },
      { status: 'CHECKED_IN', _count: { _all: 3 } },
    ] as never);
    const result = await service.list({ status: 'CHECKED_IN' });
    expect(result.counts).toEqual({ ALL: 7, CONFIRMED: 4, CHECKED_IN: 3 });
    const args = db.reservation.groupBy.mock.calls[0]![0];
    expect(args.by).toEqual(['status']);
    expect(args.where.status).toBeUndefined();
  });

  it('excludes voided finance entries in the read selection and preserves refunds', async () => {
    const { db, service } = fixture();
    db.reservation.findMany.mockResolvedValue([
      {
        confirmationNumber: 'DEMO',
        status: 'CONFIRMED',
        source: 'DESK',
        channel: null,
        arrivalDate: new Date('2026-09-13'),
        departureDate: new Date('2026-09-14'),
        currency: 'KZT',
        totalAmount: 9007199254740999n,
        primaryGuest: null,
        items: [
          {
            allocations: [],
            folio: {
              charges: [{ amount: 9007199254740999n }],
              allocations: [{ amount: 5n }],
              refunds: [{ amount: 2n }],
            },
          },
        ],
      },
    ] as never);
    const result = await service.list({});
    expect(result.rows[0]).toMatchObject({
      totalAmountMinor: '9007199254740999',
      paidMinor: '5',
      balanceMinor: '9007199254740996',
      // «Финансы» одной колонкой (ADR-106): состояние возврата и группа считаются из того же
      // folioBalance и уже выбранных items — новых запросов и полей схемы нет
      chargedMinor: '9007199254740999',
      refundedMinor: '2',
      itemsCount: 1,
    });
    const args = db.reservation.findMany.mock.calls[0]![0];
    expect(args.select.items.select.folio.select.charges.where).toEqual({ voidedAt: null });
    expect(args.select.items.select.folio.select.allocations.where).toEqual({
      payment: { status: 'COMPLETED' },
    });
  });

  /**
   * С-13 (ТЗ аудита 25.09.2026): без дат справочник берёт «сегодня» — и брал его по Алматы
   * (`Intl` с зашитым 'Asia/Almaty'). Объект в другом поясе видел бы «гостей на сегодня» за чужой день.
   */
  it('без дат «сегодня» — по поясу объекта, а не по Алматы', async () => {
    forgetPropertyRef();
    vi.useFakeTimers({ now: new Date('2026-09-30T19:30:00Z'), toFake: ['Date'] });
    try {
      const { db, service } = fixture();
      db.property.findFirst.mockResolvedValue({
        id: 'p',
        name: 'Тестовая гостиница',
        organizationId: null,
        timezone: 'America/New_York',
      });
      // 19:30 UTC: в Нью-Йорке ещё 30 сентября, в Алматы уже 1 октября
      expect(await service.list({})).toMatchObject({ from: '2026-09-30', to: '2026-09-30' });
    } finally {
      vi.useRealTimers();
      forgetPropertyRef();
    }
  });
});

/**
 * «Брони v2», срез R2 (ADR-106, plans/reservations-v2-r2-2026-09-27.md): каталог отбирается на сервере.
 * Отбор по деньгам и «Требуют внимания» идут одним SQL со страницей, итогом и чипами — фильтровать
 * 25 строк текущей страницы в браузере нельзя (поручение владельца 27.09).
 */
interface SqlLike {
  strings: readonly string[];
  values: readonly unknown[];
}
const isSql = (v: unknown): v is SqlLike =>
  typeof v === 'object' && v !== null && Array.isArray((v as SqlLike).strings);
function flatten(sql: SqlLike): { sql: string; values: unknown[] } {
  let text = sql.strings[0] ?? '';
  const values: unknown[] = [];
  sql.values.forEach((value, i) => {
    if (isSql(value)) {
      const inner = flatten(value);
      text += inner.sql;
      values.push(...inner.values);
    } else {
      text += '?';
      values.push(value);
    }
    text += sql.strings[i + 1] ?? '';
  });
  return { sql: text, values };
}
const r2 = () => {
  const queries: Array<{ sql: string; values: unknown[] }> = [];
  const db = {
    property: {
      findFirst: vi
        .fn()
        .mockResolvedValue({ id: 'p', name: 'x', organizationId: null, timezone: 'Asia/Almaty' }),
    },
    reservation: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    $queryRaw: vi.fn(async (query: SqlLike) => {
      const flat = flatten(query);
      queries.push(flat);
      if (/LIMIT/.test(flat.sql)) return [{ id: 'b' }, { id: 'a' }];
      if (/GROUP BY/.test(flat.sql)) return [{ status: 'CHECKED_IN', n: 2 }];
      return [{ n: 2 }];
    }),
  };
  forgetPropertyRef();
  return { db, queries, service: new ReservationDirectory({ db } as never) };
};
const extras = (db: ReturnType<typeof r2>['db']) =>
  (db.reservation.findMany.mock.calls[0]![0] as { where: { AND?: unknown[] } }).where.AND ?? [];

describe('«Брони v2», R2: отбор каталога на сервере', () => {
  it('неизвестный вид, семантика даты, оплата, размещение и сортировка — 400 до запроса к базе', async () => {
    for (const params of [
      { view: 'week' },
      { date: 'booked' },
      { payment: 'half' },
      { allocation: 'floor' },
      { sort: 'price' },
      { category: 'x'.repeat(65) },
      { source: 'x'.repeat(65) },
    ]) {
      const { db, service } = r2();
      await expect(service.list(params)).rejects.toBeInstanceOf(BadRequestException);
      expect(db.property.findFirst).not.toHaveBeenCalled();
      expect(db.$queryRaw).not.toHaveBeenCalled();
    }
  });

  it('view=today: период — сегодня объекта, как бы ни звали from/to; по умолчанию ближайший заезд', async () => {
    vi.useFakeTimers({ now: new Date('2026-09-27T06:00:00Z'), toFake: ['Date'] });
    try {
      const { db, service } = r2();
      const result = await service.list({ view: 'today', from: '2026-01-01', to: '2026-01-31' });
      expect(result).toMatchObject({ from: '2026-09-27', to: '2026-09-27' });
      const args = db.reservation.findMany.mock.calls[0]![0];
      expect(args.orderBy).toEqual([{ arrivalDate: 'asc' }, { id: 'asc' }]);
      expect(args.where.arrivalDate).toEqual({ lte: new Date('2026-09-27') });
      expect(args.where.departureDate).toEqual({ gte: new Date('2026-09-27') });
    } finally {
      vi.useRealTimers();
    }
  });

  it('view=future и view=inhouse не смотрят на период', async () => {
    vi.useFakeTimers({ now: new Date('2026-09-27T06:00:00Z'), toFake: ['Date'] });
    try {
      const future = r2();
      await future.service.list({ view: 'future', from: '2026-01-01', to: '2026-01-02' });
      const fw = future.db.reservation.findMany.mock.calls[0]![0].where;
      expect(fw.arrivalDate).toBeUndefined();
      expect(fw.departureDate).toBeUndefined();
      expect(extras(future.db)).toEqual(
        expect.arrayContaining([
          { arrivalDate: { gt: new Date('2026-09-27') } },
          { status: { not: 'CANCELLED' } },
        ]),
      );
      const inhouse = r2();
      await inhouse.service.list({ view: 'inhouse', from: '2026-01-01', to: '2026-01-02' });
      const iw = inhouse.db.reservation.findMany.mock.calls[0]![0].where;
      expect(iw.arrivalDate).toBeUndefined();
      expect(extras(inhouse.db)).toContainEqual({ status: 'CHECKED_IN' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('date=arrival и date=departure относят период к дню заезда или выезда', async () => {
    const arrival = r2();
    await arrival.service.list({ date: 'arrival', from: '2026-09-27', to: '2026-09-28' });
    const aw = arrival.db.reservation.findMany.mock.calls[0]![0].where;
    expect(aw.departureDate).toBeUndefined();
    expect(aw.arrivalDate).toEqual({ gte: new Date('2026-09-27'), lte: new Date('2026-09-28') });
    const departure = r2();
    await departure.service.list({ date: 'departure', from: '2026-09-27', to: '2026-09-27' });
    const dw = departure.db.reservation.findMany.mock.calls[0]![0].where;
    expect(dw.arrivalDate).toBeUndefined();
    expect(dw.departureDate).toEqual({ gte: new Date('2026-09-27'), lte: new Date('2026-09-27') });
  });

  it('источник: значение перечисления без регистра — по source, иначе подстрока канала', async () => {
    const byEnum = r2();
    await byEnum.service.list({ source: 'ota' });
    expect(extras(byEnum.db)).toContainEqual({ source: 'OTA' });
    const byChannel = r2();
    await byChannel.service.list({ source: 'booking' });
    expect(extras(byChannel.db)).toContainEqual({
      channel: { contains: 'booking', mode: 'insensitive' },
    });
  });

  it('категория, размещение и сортировка — в запросе, а не на странице', async () => {
    const { db, service } = r2();
    await service.list({ category: 'DBL', allocation: 'missing', sort: 'amount' });
    const args = db.reservation.findMany.mock.calls[0]![0];
    expect(args.orderBy).toEqual([{ totalAmount: 'desc' }, { id: 'asc' }]);
    expect(extras(db)).toEqual(
      expect.arrayContaining([
        { items: { some: { accommodationType: { code: 'DBL' } } } },
        { status: { in: ['TENTATIVE', 'CONFIRMED', 'CHECKED_IN'] } },
        { items: { some: { allocations: { none: {} } } } },
      ]),
    );
    // Чипы статусов считаются тем же отбором без статуса
    expect(db.reservation.groupBy.mock.calls[0]![0].where.AND).toEqual(args.where.AND);
  });

  it('оплата: страница, итог и чипы — одним SQL-отбором по формуле folioBalance', async () => {
    const { db, queries, service } = r2();
    db.reservation.findMany.mockResolvedValue(
      ['a', 'b'].map((id) => ({
        id,
        confirmationNumber: id.toUpperCase(),
        status: 'CHECKED_IN',
        source: 'DESK',
        channel: null,
        arrivalDate: new Date('2026-09-26'),
        departureDate: new Date('2026-09-28'),
        currency: 'KZT',
        totalAmount: 100n,
        primaryGuest: null,
        items: [
          {
            allocations: [],
            folio: { charges: [{ amount: 100n }], allocations: [{ amount: 40n }], refunds: [] },
          },
        ],
      })) as never,
    );
    const result = await service.list({ payment: 'due', status: 'CHECKED_IN', page: '2' });
    // Страница в порядке SQL (b, a), а не в порядке второй выборки
    expect(result.rows.map((r) => r.confirmationNumber)).toEqual(['B', 'A']);
    expect(result).toMatchObject({ total: 2, counts: { ALL: 2, CHECKED_IN: 2 }, page: 2 });
    expect(result.rows[0]).toMatchObject({ balanceMinor: '60', paidMinor: '40' });
    const lookup = db.reservation.findMany.mock.calls[0]![0];
    expect(lookup.where).toEqual({ id: { in: ['b', 'a'] } });
    expect(lookup.skip).toBeUndefined();
    const page = queries.find((q) => /LIMIT/.test(q.sql))!;
    expect(page.sql).toMatch(/"voided_at" IS NULL/);
    expect(page.sql).toMatch(/'COMPLETED'/);
    expect(page.sql).toMatch(/m\."charged" - m\."paid" \+ m\."refunded"\) > 0/);
    expect(page.values).toEqual(expect.arrayContaining([25, 25]));
    const groups = queries.find((q) => /GROUP BY/.test(q.sql))!;
    expect(groups.values).not.toContain('CHECKED_IN');
    expect(db.reservation.count).not.toHaveBeenCalled();
  });

  it('«Требуют внимания» — четыре существующих факта, без новых статусов', async () => {
    vi.useFakeTimers({ now: new Date('2026-09-27T06:00:00Z'), toFake: ['Date'] });
    try {
      const { queries, service } = r2();
      await service.list({ view: 'attention', sort: 'debt' });
      const page = queries.find((q) => /LIMIT/.test(q.sql))!;
      expect(page.sql).toMatch(/NOT EXISTS \(SELECT 1 FROM "allocations"/);
      expect(page.sql).toMatch(/IN \('TENTATIVE', 'CONFIRMED'\) AND r\."arrival_date" < \?::date/);
      expect(page.sql).toMatch(/> 0 AND r\."status"::text IN \('CHECKED_IN', 'CHECKED_OUT'\)/);
      expect(page.sql).toMatch(/m\."refunded"\) < 0/);
      expect(page.sql).toMatch(/ORDER BY \(m\."charged" - m\."paid" \+ m\."refunded"\) DESC/);
      expect(page.values).toContain('2026-09-27');
    } finally {
      vi.useRealTimers();
    }
  });

  it('date=created считает сутки создания по поясу объекта', async () => {
    const { queries, service } = r2();
    await service.list({ date: 'created', from: '2026-09-20', to: '2026-09-27' });
    const page = queries.find((q) => /LIMIT/.test(q.sql))!;
    expect(page.sql).toMatch(
      /\(r\."created_at" AT TIME ZONE \?\)::date BETWEEN \?::date AND \?::date/,
    );
    expect(page.values).toEqual(
      expect.arrayContaining(['Asia/Almaty', '2026-09-20', '2026-09-27']),
    );
  });
});
