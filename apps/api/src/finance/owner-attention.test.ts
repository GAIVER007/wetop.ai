import { describe, expect, it, vi } from 'vitest';
import { readOwnerAttention } from './owner-attention';

/** «Требуют решения» Главной владельца: сигналы дня филиала из своих таблиц, всегда в рамках филиала/объекта */
const NOW = new Date('2026-10-21T07:00:00Z'); // 12:00 в Алматы (UTC+5)
const DAY_START = new Date('2026-10-20T19:00:00Z');
const at = (hhmm: string) => new Date(DAY_START.getTime() + (Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3))) * 60000);
const time = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00Z`);
const base = { locationId: 'branch', organizationId: 'org', businessId: 'business', timezone: 'Asia/Almaty', now: NOW, propertyId: null as string | null };

const beautyDb = () => ({
  appointment: {
    findMany: vi.fn().mockResolvedValue([
      { price: 500000n, payments: [] },
      { price: 500000n, payments: [{ kind: 'INCOME', amount: 200000n }] },
      { price: 500000n, payments: [{ kind: 'INCOME', amount: 500000n }] },
    ]),
  },
  employee: {
    findMany: vi.fn().mockResolvedValue([
      { id: 'free', personnelKind: 'SPECIALIST', workingHours: [{ timeFrom: time('10:00'), timeTo: time('20:00') }] },
      { id: 'busy', personnelKind: null, workingHours: [{ timeFrom: time('10:00'), timeTo: time('20:00') }] },
      { id: 'admin', personnelKind: 'OTHER_EMPLOYEE', workingHours: [{ timeFrom: time('10:00'), timeTo: time('20:00') }] },
    ]),
  },
  appointmentLine: {
    findMany: vi.fn().mockResolvedValue([
      { employeeId: 'busy', startsAt: at('12:00'), endsAt: at('16:00') },
      { employeeId: 'busy', startsAt: at('16:30'), endsAt: at('20:00') },
    ]),
  },
  beautyLocationHours: { findUnique: vi.fn().mockResolvedValue(null) },
  barProduct: {
    findMany: vi.fn().mockResolvedValue([
      { minimumStockUnits: 5n, lots: [{ remainingUnits: 3n }] },
      { minimumStockUnits: 5n, lots: [{ remainingUnits: 9n }] },
    ]),
  },
  kitchenProduct: {
    findMany: vi.fn().mockResolvedValue([
      { minQty: '2.000', lots: [{ remainingQty: '0.500' }] },
      { minQty: '0', lots: [] },
    ]),
  },
});

describe('readOwnerAttention', () => {
  it('салон: записи DONE без полной оплаты, мастера с окном от 2 ч, склад; всё по филиалу и дню филиала', async () => {
    const db = beautyDb();
    const items = await readOwnerAttention(db as never, { ...base, vertical: 'BEAUTY' });
    // свободные окна подсказкой после дел (29.10.2026)
    expect(items.map((i) => i.text)).toEqual([
      'Не оплачено сегодня: 2 записи',
      'Заканчивается: 2 позиции',
      'Свободные окна: 1 мастер',
    ]);
    expect(db.appointment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { locationId: 'branch', status: 'DONE', startsAt: { gte: DAY_START, lt: new Date('2026-10-21T19:00:00Z') } },
    }));
    expect(db.employee.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ businessId: 'business', status: 'ACTIVE', locations: { some: { locationId: 'branch' } } }),
    }));
    expect(db.appointmentLine.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ appointment: { locationId: 'branch', status: { in: ['BOOKED', 'CONFIRMED', 'IN_PROGRESS', 'DONE'] } } }),
    }));
    expect(db.barProduct.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { locationId: 'branch', active: true } }));
    expect(db.kitchenProduct.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: 'business', active: true } }));
  });
  it('салон: рабочие часы берутся на день недели филиала, а не сервера', async () => {
    const db = beautyDb();
    await readOwnerAttention(db as never, { ...base, vertical: 'BEAUTY', now: new Date('2026-10-21T20:30:00Z') });
    // 01:30 22.10 в Алматы: четверг (4)
    const where = db.employee.findMany.mock.calls[0]![0].select.workingHours.where;
    expect(where).toEqual({ locationId: 'branch', weekday: 4 });
  });
  it('салон: сбой одного источника не ломает остальные строки', async () => {
    const db = beautyDb();
    db.employee.findMany.mockRejectedValue(new Error('boom'));
    const items = await readOwnerAttention(db as never, { ...base, vertical: 'BEAUTY' });
    expect(items.map((i) => i.id)).toEqual(['unpaid-visits', 'low-stock']);
  });
  it('ресторан: открытые счета филиала старше 2 ч', async () => {
    const db = {
      restaurantOrder: { count: vi.fn().mockResolvedValue(3) },
      barProduct: { findMany: vi.fn().mockResolvedValue([]) },
      kitchenProduct: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const items = await readOwnerAttention(db as never, { ...base, vertical: 'FOOD_SERVICE' });
    expect(items).toEqual([expect.objectContaining({ id: 'stale-orders', text: 'Открыты дольше 2 ч: 3 счёта', href: '/floor-plan' })]);
    expect(db.restaurantOrder.count).toHaveBeenCalledWith({
      where: { locationId: 'branch', status: { in: ['NEW', 'COOKING', 'READY', 'SERVED'] }, openedAt: { lt: new Date('2026-10-21T05:00:00Z') } },
    });
  });
  it('ресторан без дел: одна спокойная строка', async () => {
    const db = {
      restaurantOrder: { count: vi.fn().mockResolvedValue(0) },
      barProduct: { findMany: vi.fn().mockResolvedValue([]) },
      kitchenProduct: { findMany: vi.fn().mockResolvedValue([]) },
    };
    expect(await readOwnerAttention(db as never, { ...base, vertical: 'FOOD_SERVICE' })).toEqual([
      { id: 'all-clear', tone: 'ok', text: 'Срочных дел нет', href: '/today/operations', action: 'Открыть день' },
    ]);
  });
  it('гостиница: заезды сегодня, неубранные места объекта и брони на 7 дней без оплаты', async () => {
    const folio = (charged: bigint, paid: bigint) => ({ folio: { charges: [{ amount: charged }], allocations: paid ? [{ amount: paid }] : [], refunds: [] } });
    const db = {
      reservation: {
        count: vi.fn().mockResolvedValue(2),
        findMany: vi.fn().mockResolvedValue([
          { items: [folio(1000n, 0n)] },
          { items: [folio(1000n, 500n)] },
          { items: [{ folio: null }] },
        ]),
      },
      inventoryUnit: { findMany: vi.fn().mockResolvedValue([{ kind: 'ROOM' }, { kind: 'ROOM' }, { kind: 'ROOM' }]) },
      barProduct: { findMany: vi.fn().mockResolvedValue([]) },
      kitchenProduct: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const items = await readOwnerAttention(db as never, { ...base, vertical: 'HOSPITALITY', propertyId: 'property' });
    expect(items.map((i) => [i.text, i.href])).toEqual([
      ['2 заезда, не убрано: 3 номера', '/inventory?housekeeping=DIRTY'],
      ['1 бронь без предоплаты', '/reservations?from=2026-10-21&to=2026-10-28&date=arrival&payment=unpaid'],
    ]);
    expect(db.reservation.count).toHaveBeenCalledWith({
      where: { propertyId: 'property', arrivalDate: new Date('2026-10-21T00:00:00Z'), status: { in: ['TENTATIVE', 'CONFIRMED'] } },
    });
    expect(db.inventoryUnit.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { propertyId: 'property', active: true, housekeepingStatus: 'DIRTY' },
    }));
    expect(db.reservation.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        propertyId: 'property', status: { in: ['TENTATIVE', 'CONFIRMED'] },
        arrivalDate: { gte: new Date('2026-10-21T00:00:00Z'), lte: new Date('2026-10-28T00:00:00Z') },
      },
    }));
  });
  it('гостиница без связанного объекта не читает чужие брони', async () => {
    const db = { reservation: { count: vi.fn(), findMany: vi.fn() }, inventoryUnit: { findMany: vi.fn() }, barProduct: { findMany: vi.fn().mockResolvedValue([]) }, kitchenProduct: { findMany: vi.fn().mockResolvedValue([]) } };
    await readOwnerAttention(db as never, { ...base, vertical: 'HOSPITALITY', propertyId: null });
    expect(db.reservation.count).not.toHaveBeenCalled();
    expect(db.reservation.findMany).not.toHaveBeenCalled();
    expect(db.inventoryUnit.findMany).not.toHaveBeenCalled();
  });
  it('расходы без статьи добавляются строкой со ссылкой на финансы направления', async () => {
    const db = { restaurantOrder: { count: vi.fn().mockResolvedValue(0) }, barProduct: { findMany: vi.fn().mockResolvedValue([]) }, kitchenProduct: { findMany: vi.fn().mockResolvedValue([]) } };
    const items = await readOwnerAttention(db as never, { ...base, vertical: 'FOOD_SERVICE', unclassifiedExpenses: true });
    expect(items).toEqual([{ id: 'unclassified-expenses', tone: 'warn', text: 'Есть расходы без статьи', href: '/restaurant-finance', action: 'Разобрать' }]);
  });
  // владелец 29.10.2026: «Требуют решения» о том, что можно сделать сейчас
  it('салон: вчерашняя незакрытая смена, не отмеченные «Пришла» после 15 минут и неподтверждённые на завтра', async () => {
    const db = {
      ...beautyDb(),
      cashShift: { findFirst: vi.fn().mockResolvedValue({ openedAt: new Date('2026-10-20T05:00:00Z') }) },
      appointment: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockImplementation(async ({ where }: { where: { status: unknown } }) => (JSON.stringify(where.status).includes('CONFIRMED') && JSON.stringify(where.status).includes('BOOKED') ? 2 : 3)),
      },
    };
    const items = await readOwnerAttention(db as never, { ...base, vertical: 'BEAUTY' });
    expect(items.slice(0, 3).map((i) => [i.id, i.text])).toEqual([
      ['open-shift', 'Смена с 20.10 не закрыта'],
      ['late-unmarked', 'Не отмечены «Пришла»: 2 записи'],
      ['unconfirmed-tomorrow', 'Подтвердить на завтра: 3 записи'],
    ]);
    expect(db.cashShift.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { closedAt: null, register: { locationId: 'branch' } } }));
    // опоздание: время записи прошло больше 15 минут назад, статус «Записан» или «Подтверждена»
    expect(db.appointment.count).toHaveBeenCalledWith({ where: { locationId: 'branch', status: { in: ['BOOKED', 'CONFIRMED'] }, startsAt: { gte: DAY_START, lt: new Date(NOW.getTime() - 15 * 60000) } } });
    expect(db.appointment.count).toHaveBeenCalledWith({ where: { locationId: 'branch', status: 'BOOKED', startsAt: { gte: new Date('2026-10-21T19:00:00Z'), lt: new Date('2026-10-22T19:00:00Z') } } });
  });
  it('смена, открытая сегодня, делом не считается', async () => {
    const db = { ...beautyDb(), cashShift: { findFirst: vi.fn().mockResolvedValue({ openedAt: new Date('2026-10-21T03:00:00Z') }) } };
    const items = await readOwnerAttention(db as never, { ...base, vertical: 'BEAUTY' });
    expect(items.map((i) => i.id)).not.toContain('open-shift');
  });
});
