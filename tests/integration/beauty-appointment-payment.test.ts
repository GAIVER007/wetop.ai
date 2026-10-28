import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { BeautyCatalogService } from '../../apps/api/src/beauty/beauty.module';
import { BeautyScheduleService } from '../../apps/api/src/beauty/schedule';
import { BeautyAppointmentsService } from '../../apps/api/src/beauty/appointments';
import { RestaurantService } from '../../apps/api/src/food-service/restaurant.service';
import { StockService } from '../../apps/api/src/food-service/stock.service';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { isLocalDatabase } from '../tools/seed-local';
import { enableKzBranchMethods } from './kz-methods-on';

/**
 * Оплата записи салона приходом кассы филиала (DATA_MODEL §49): частями и разными способами, не больше цены,
 * повтор нажатия без второго прихода, отмена и перенос не обходят оплату, аннулирование до «Выполнено».
 * Вымышленные данные (ADR-010).
 */
describe('оплата записи салона (integration, §49)', () => {
  const url = process.env.DATABASE_URL;
  if (!url || !isLocalDatabase(url)) throw new Error('Проверяется только на локальной PostgreSQL');
  let db: Db;
  let catalog: BeautyCatalogService;
  let service: BeautyAppointmentsService;
  let cash: RestaurantService;
  const own = { org: randomUUID(), business: randomUUID(), location: randomUUID(), user: randomUUID() };
  const DATE = (() => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(new Date());
    const d = new Date(`${today}T00:00:00Z`);
    do d.setUTCDate(d.getUTCDate() + 1);
    while (d.getUTCDay() !== 1);
    return d.toISOString().slice(0, 10);
  })();
  const at = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    const [y, mo, d] = DATE.split('-').map(Number);
    return new Date(Date.UTC(y as number, (mo as number) - 1, d, (h as number) - 5, m)).toISOString();
  };
  const as = <T>(fn: () => Promise<T>) =>
    withSignedInUser(
      { userId: own.user, organizationId: own.org, role: 'OWNER', scope: 'LOCATION', vertical: 'BEAUTY', businessId: own.business, locationId: own.location },
      fn,
    );
  let employeeId = '';
  let cheap = '';
  let pricey = '';

  beforeAll(async () => {
    db = createPrismaClient(url);
    const prisma = { db } as unknown as PrismaService;
    catalog = new BeautyCatalogService(prisma);
    service = new BeautyAppointmentsService(prisma);
    cash = new RestaurantService(prisma, null, new StockService(prisma));
    await db.organization.create({ data: { id: own.org, name: `Оплата ${own.org.slice(0, 8)}`, status: 'ACTIVE' } });
    await db.business.create({ data: { id: own.business, organizationId: own.org, name: 'Салон', vertical: 'BEAUTY' } });
    await db.location.create({ data: { id: own.location, businessId: own.business, name: 'Филиал', timezone: 'Asia/Almaty', currency: 'KZT' } });
    await enableKzBranchMethods(db, [own.location]); // филиал сам включил Kaspi и Halyk
    await db.user.create({ data: { id: own.user, email: `pay-${own.user}@example.invalid`, name: 'Владелец' } });
    employeeId = (await as(() => catalog.createEmployee({ name: 'Дина' }))).id;
    pricey = (await as(() => catalog.createService({ name: 'Окрашивание', durationMinutes: 60, priceMinor: '800000', currency: 'KZT' }))).id;
    cheap = (await as(() => catalog.createService({ name: 'Чёлка', durationMinutes: 60, priceMinor: '200000', currency: 'KZT' }))).id;
    await as(() => catalog.setEmployeeServices(employeeId, { serviceIds: [pricey, cheap] }));
    for (const s of [pricey, cheap]) await as(() => catalog.setLocationService(s, { enabled: true }));
    await as(async () => new BeautyScheduleService(prisma).setWorkingHours(employeeId, { expectedRevision: (await new BeautyScheduleService(prisma).overview(employeeId)).weekRevision, intervals: [{ weekday: 1, timeFrom: '09:00', timeTo: '18:00' }] }));
  });
  afterAll(async () => db?.$disconnect());

  const book = async (hhmm: string) => {
    const day = await as(() => service.create({ employeeId, serviceId: pricey, startsAt: at(hhmm), firstName: 'Айгуль', phone: '+7 701 000 00 00' }));
    return day.appointments.find((a) => a.startMinutes === Number(hhmm.slice(0, 2)) * 60)!;
  };
  const pay = (id: string, amount: number, method = 'CASH', idempotencyKey: string = randomUUID()) =>
    as(() => service.pay(id, { amount, method, idempotencyKey }));
  const balance = async () => (await as(() => cash.cash())).balances;

  it('частями и разными способами до цены; повтор ключа не создаёт второй приход; больше остатка нельзя', async () => {
    const a = await book('10:00');
    const key = randomUUID();
    await pay(a.id, 300000, 'CASH', key);
    const replay = await pay(a.id, 300000, 'CASH', key);
    expect(replay.appointments.find((r) => r.id === a.id)?.paidMinor).toBe('300000');
    await pay(a.id, 400000, 'KASPI');
    await expect(pay(a.id, 100001)).rejects.toThrow('Сумма больше остатка к оплате');
    const day = await pay(a.id, 100000, 'CARD_TERMINAL');
    expect(day.appointments.find((r) => r.id === a.id)).toMatchObject({ priceMinor: '800000', paidMinor: '800000' });
    const ops = await db.restaurantCashOperation.findMany({ where: { appointmentId: a.id }, orderBy: { createdAt: 'asc' } });
    expect(ops.map((o) => [o.kind, o.method, o.amount])).toEqual([
      ['INCOME', 'CASH', 300000n],
      ['INCOME', 'KASPI', 400000n],
      ['INCOME', 'CARD_TERMINAL', 100000n],
    ]);
    const b = await balance();
    expect([b.find((x) => x.method === 'CASH')?.balanceMinor, b.find((x) => x.method === 'KASPI')?.balanceMinor]).toEqual(['300000', '400000']);
  });

  it('отмена и незаезд с оплатой закрыты, перенос не опускает цену ниже оплаченного; после аннулирования можно', async () => {
    const a = await book('12:00');
    await pay(a.id, 500000);
    await expect(as(() => service.setStatus(a.id, { status: 'CANCELLED' }))).rejects.toThrow('Сначала аннулируйте оплату записи в кассе');
    // M6a rejects future NO_SHOW before checking payments. At the start boundary,
    // the independent payment guard must still refuse the transition unchanged.
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date(at('12:00')));
      await expect(as(() => service.setStatus(a.id, { status: 'NO_SHOW' }))).rejects.toThrow('Сначала аннулируйте оплату записи в кассе');
    } finally {
      vi.useRealTimers();
    }
    await expect(as(() => service.move(a.id, { serviceId: cheap }))).rejects.toThrow('Цена услуги меньше уже оплаченного');
    const op = await db.restaurantCashOperation.findFirstOrThrow({ where: { appointmentId: a.id } });
    await as(() => cash.voidCashOperation(op.id));
    const cancelled = await as(() => service.setStatus(a.id, { status: 'CANCELLED' }));
    expect(cancelled.appointments.find((r) => r.id === a.id)).toMatchObject({ status: 'CANCELLED', paidMinor: '0' });
    await expect(pay(a.id, 1000)).rejects.toThrow('Запись отменена');
  });

  it('после «Выполнено» платить можно, аннулировать оплату нельзя', async () => {
    const a = await book('14:00');
    await as(() => service.setStatus(a.id, { status: 'DONE' }));
    await pay(a.id, 800000);
    const op = await db.restaurantCashOperation.findFirstOrThrow({ where: { appointmentId: a.id } });
    await expect(as(() => cash.voidCashOperation(op.id))).rejects.toThrow('Запись выполнена');
    expect((await db.restaurantCashOperation.findUniqueOrThrow({ where: { id: op.id } })).status).toBe('COMPLETED');
  });

  // админ салона 28.10.2026: после потерянного ответа оплата записи висела «Безопасная отправка недоступна…»
  it('сверка ключа оплаты: касса отвечает, прошла ли операция с этим ключом у этой записи', async () => {
    const a = await book('11:00');
    const key = randomUUID();
    expect(await as(() => service.paymentKeyStatus(a.id, key))).toEqual({ found: false });
    await pay(a.id, 100000, 'CASH', key);
    expect(await as(() => service.paymentKeyStatus(a.id, key))).toEqual({ found: true });
    const other = await book('13:00');
    // ключ чужой записи не раскрывается: для другой записи «нет»
    expect(await as(() => service.paymentKeyStatus(other.id, key))).toEqual({ found: false });
    await expect(as(() => service.paymentKeyStatus(a.id, 'not-a-key'))).rejects.toThrow();
    // отменённой записи цену не правят: деньги по ней уже разобраны
    await as(() => service.setStatus(other.id, { status: 'CANCELLED' }));
    await expect(as(() => service.adjustPrice(other.id, { priceMinor: '100', reason: 'x' }))).rejects.toThrow('Цену отменённой записи');
  });

  // админ салона 28.10.2026: «клиент заплатил больше или меньше, а цену выполненной записи не поменять»
  it('цена выполненной записи меняется с правом цен: больше и меньше, но не ниже уже оплаченного', async () => {
    const a = await book('15:00');
    await pay(a.id, 300000);
    await as(() => service.setStatus(a.id, { status: 'DONE' }));
    const up = await as(() => service.adjustPrice(a.id, { priceMinor: '900000', reason: 'Добавили укладку' }));
    expect(up.appointments.find((r) => r.id === a.id)).toMatchObject({ status: 'DONE', priceMinor: '900000' });
    const down = await as(() => service.adjustPrice(a.id, { priceMinor: '300000', reason: 'Скидка постоянной клиентке' }));
    expect(down.appointments.find((r) => r.id === a.id)).toMatchObject({ priceMinor: '300000', paidMinor: '300000' });
    await expect(as(() => service.adjustPrice(a.id, { priceMinor: '299999', reason: 'x' }))).rejects.toThrow('Цена меньше уже оплаченного');
    await expect(as(() => service.adjustPrice(a.id, { priceMinor: '400000', reason: '' }))).rejects.toThrow('Укажите причину');
    const history = await db.auditLog.findMany({ where: { entityId: a.id, action: 'beauty.appointment.price_adjusted' }, orderBy: { createdAt: 'asc' } });
    expect(history.map((h) => [(h.before as { priceMinor: string }).priceMinor, (h.after as { priceMinor: string; reason: string }).priceMinor])).toEqual([['800000', '900000'], ['900000', '300000']]);
  });

  it('база: со ссылкой на запись только приход и возврат, только своего филиала, и после вставки не меняется', async () => {
    const a = await book('16:00');
    const base = { locationId: own.location, method: 'CASH' as const, amount: 1n, currency: 'KZT', appointmentId: a.id };
    // §54: расход со ссылкой на запись это возврат и разрешён; перевод и выплата с записью нет
    await expect(db.restaurantCashOperation.create({ data: { ...base, kind: 'TRANSFER', methodTo: 'KASPI' } })).rejects.toThrow(/restaurant_cash_operations_appointment/);
    // второй филиал того же салона: RLS тут не поможет, держит триггер
    const foreign = await db.location.create({ data: { businessId: own.business, name: 'Второй филиал', timezone: 'Asia/Almaty', currency: 'KZT' } });
    await expect(db.restaurantCashOperation.create({ data: { ...base, kind: 'INCOME', locationId: foreign.id } })).rejects.toThrow(
      /Appointment payment belongs to another location/,
    );
    const op = await db.restaurantCashOperation.create({ data: { ...base, kind: 'INCOME' } });
    await expect(db.restaurantCashOperation.update({ where: { id: op.id }, data: { appointmentId: null } })).rejects.toThrow(/immutable/);
  });

  it('возврат (§54): только после «Выполнено», с причиной, не больше чистой оплаты и остатка способа, повтор по ключу', async () => {
    const a = await book('17:00');
    await pay(a.id, 800000, 'CASH');
    const refund = (amount: number, method = 'CASH', reason: unknown = 'Клиент недоволен', idempotencyKey: string = randomUUID()) =>
      as(() => service.refund(a.id, { amount, method, reason, idempotencyKey }));
    await expect(refund(1000)).rejects.toThrow('Возврат оформляют по выполненной записи');
    await as(() => service.setStatus(a.id, { status: 'DONE' }));
    await expect(refund(1000, 'CASH', '  ')).rejects.toThrow('Укажите причину возврата');
    const key = randomUUID();
    await refund(300000, 'CASH', 'Клиент недоволен', key);
    const day = await refund(300000, 'CASH', 'Клиент недоволен', key);
    expect(day.appointments.find((r) => r.id === a.id)).toMatchObject({ paidMinor: '800000', refundedMinor: '300000' });
    await expect(refund(500001)).rejects.toThrow('Сумма больше оплаченного по записи');
    await expect(refund(1000, 'HALYK')).rejects.toThrow('В кассе по этому способу меньше этой суммы');
    // чистая оплата 500 000 ограничивает и доплату: ещё 300 000 можно, 300 001 уже нет
    await expect(pay(a.id, 300001)).rejects.toThrow('Сумма больше остатка к оплате');
    const ops = await db.restaurantCashOperation.findMany({ where: { appointmentId: a.id }, orderBy: { createdAt: 'asc' } });
    expect(ops.map((o) => [o.kind, o.amount, o.status])).toEqual([
      ['INCOME', 800000n, 'COMPLETED'],
      ['EXPENSE', 300000n, 'COMPLETED'],
    ]);
    expect(ops[1]!.note).toContain('Причина: Клиент недоволен');
    // ошибочный возврат аннулируется в кассе; оплату после «Выполнено» по-прежнему нет
    await as(() => cash.voidCashOperation(ops[1]!.id));
    await expect(as(() => cash.voidCashOperation(ops[0]!.id))).rejects.toThrow('оформите возврат в карточке записи');
    expect((await as(() => service.day(DATE))).appointments.find((r) => r.id === a.id)).toMatchObject({ refundedMinor: '0' });
  });

  it('«В процессе» (§58): держит время мастера, оплачивается, незаезда нет, выполняется', async () => {
    const a = await book('09:00');
    const started = await as(() => service.setStatus(a.id, { status: 'IN_PROGRESS' }));
    expect(started.appointments.find((r) => r.id === a.id)).toMatchObject({ status: 'IN_PROGRESS', next: ['DONE', 'CANCELLED'] });
    await expect(
      as(() => service.create({ employeeId, serviceId: pricey, startsAt: at('09:30'), firstName: 'Жанна', phone: '+7 701 000 00 01' })),
    ).rejects.toThrow('Мастер в это время уже занят');
    await pay(a.id, 100000);
    await expect(as(() => service.setStatus(a.id, { status: 'NO_SHOW' }))).rejects.toThrow('Из этого состояния запись так не меняют');
    const done = await as(() => service.setStatus(a.id, { status: 'DONE' }));
    expect(done.appointments.find((r) => r.id === a.id)).toMatchObject({ status: 'DONE', paidMinor: '100000' });
  });
});
