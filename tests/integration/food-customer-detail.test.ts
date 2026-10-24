import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { FoodCustomerDetailService } from '../../apps/api/src/food-service/customer-detail';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * Карточка клиента ресторана (решение владельца 23.10.2026 п. 4, план vertical-unification срез 5): клиент и его
 * брони столов во всех филиалах своего бизнеса, новые сверху, стол с залом. Чужой бизнес, чужая организация и
 * салон: «не найден» или отказ. Всё вымышленное (ADR-010).
 */
describe('карточка клиента ресторана (integration)', () => {
  const url = process.env.DATABASE_URL;
  if (!url || !isLocalDatabase(url)) throw new Error('Проверяется только на локальной PostgreSQL');
  const prisma = new PrismaService();
  const service = new FoodCustomerDetailService(prisma as never);
  const tag = randomUUID().slice(0, 8);
  const user = randomUUID();
  const org = randomUUID(), otherOrg = randomUUID();
  const food = randomUUID(), foodLoc = randomUUID(), foodLoc2 = randomUUID();
  const food2 = randomUUID(), food2Loc = randomUUID();
  const salon = randomUUID(), salonLoc = randomUUID();
  const foreign = randomUUID(), foreignLoc = randomUUID();
  let guest = '', stranger = '', foreignGuest = '';
  const actor = (
    businessId: string,
    locationId: string,
    vertical: 'FOOD_SERVICE' | 'BEAUTY',
    organizationId = org,
  ) => ({ userId: user, organizationId, role: 'OWNER' as const, scope: 'LOCATION' as const, businessId, locationId, vertical });
  const asFood = <T>(fn: () => Promise<T>) => withSignedInUser(actor(food, foodLoc, 'FOOD_SERVICE'), fn);

  const reservation = async (locationId: string, customerId: string, startsAt: string, status: 'COMPLETED' | 'NO_SHOW' | 'BOOKED', tableId?: string) => {
    const period = await prisma.db.servicePeriod.findFirstOrThrow({ where: { locationId } });
    const r = await prisma.db.restaurantReservation.create({
      data: {
        locationId,
        customerId,
        servicePeriodId: period.id,
        startsAt: new Date(startsAt),
        endsAt: new Date(new Date(startsAt).getTime() + 90 * 60_000),
        partySize: 4,
        status,
        creationKey: randomUUID(),
        creationFingerprint: 'a'.repeat(64),
      },
    });
    if (tableId) await prisma.db.tableAssignment.create({ data: { reservationId: r.id, tableId } });
    return r.id;
  };

  beforeAll(async () => {
    await prisma.db.user.create({ data: { id: user, email: `food-card-${tag}@example.invalid` } });
    await prisma.db.organization.create({ data: { id: org, name: `Карточка ${tag}`, status: 'ACTIVE' } });
    await prisma.db.organization.create({ data: { id: otherOrg, name: `Чужая ${tag}`, status: 'ACTIVE' } });
    await prisma.db.business.create({ data: { id: food, organizationId: org, name: `Ресторан ${tag}`, vertical: 'FOOD_SERVICE' } });
    await prisma.db.business.create({ data: { id: food2, organizationId: org, name: `Второй ресторан ${tag}`, vertical: 'FOOD_SERVICE' } });
    await prisma.db.business.create({ data: { id: salon, organizationId: org, name: `Салон ${tag}`, vertical: 'BEAUTY' } });
    await prisma.db.business.create({ data: { id: foreign, organizationId: otherOrg, name: `Чужой ${tag}`, vertical: 'FOOD_SERVICE' } });
    for (const [id, businessId] of [[foodLoc, food], [foodLoc2, food], [food2Loc, food2], [salonLoc, salon], [foreignLoc, foreign]] as const)
      await prisma.db.location.create({ data: { id, businessId, name: `Филиал ${id.slice(0, 4)}`, timezone: 'Asia/Almaty', currency: 'KZT' } });
    for (const locationId of [foodLoc, foodLoc2, food2Loc, foreignLoc])
      await prisma.db.servicePeriod.create({
        data: { locationId, name: 'Весь день', weekday: 1, timeFrom: new Date('1970-01-01T00:00:00Z'), timeTo: new Date('1970-01-01T23:59:00Z'), defaultDurationMinutes: 90 },
      });
    const area = await prisma.db.diningArea.create({ data: { locationId: foodLoc, name: 'Веранда' } });
    const table = await prisma.db.diningTable.create({ data: { areaId: area.id, name: 'Стол 5', capacity: 4 } });
    guest = (await prisma.db.customer.create({
      data: { organizationId: org, firstName: 'Айгерим', lastName: 'Тестова', phone: '+77000000001', isVip: true, businesses: { create: { businessId: food } } },
    })).id;
    stranger = (await prisma.db.customer.create({ data: { organizationId: org, firstName: 'Другого', businesses: { create: { businessId: food2 } } } })).id;
    foreignGuest = (await prisma.db.customer.create({ data: { organizationId: otherOrg, firstName: 'Чужой', businesses: { create: { businessId: foreign } } } })).id;
    await reservation(foodLoc, guest, '2026-10-01T13:00:00Z', 'COMPLETED', table.id);
    await reservation(foodLoc2, guest, '2026-10-10T14:00:00Z', 'NO_SHOW');
    await reservation(foodLoc, guest, '2026-10-20T15:00:00Z', 'BOOKED');
    // бронь того же гостя в другом бизнесе организации в карточку этого ресторана не попадает
    await prisma.db.customerBusiness.create({ data: { customerId: guest, businessId: food2 } });
    await reservation(food2Loc, guest, '2026-10-15T12:00:00Z', 'COMPLETED');
  });
  afterAll(async () => prisma.onModuleDestroy());

  it('клиент и его брони во всех филиалах своего бизнеса: новые сверху, стол с залом, без брони соседнего бизнеса', async () => {
    const card = await asFood(() => service.detail(guest));
    expect(card.customer).toMatchObject({ firstName: 'Айгерим', lastName: 'Тестова', isVip: true, status: 'ACTIVE' });
    expect(card.visits.map((v) => [v.startsAt.slice(0, 10), v.status])).toEqual([
      ['2026-10-20', 'BOOKED'],
      ['2026-10-10', 'NO_SHOW'],
      ['2026-10-01', 'COMPLETED'],
    ]);
    expect(card.visits[2]).toMatchObject({ partySize: 4, table: { name: 'Стол 5', areaName: 'Веранда' }, location: { id: foodLoc } });
    expect(card.visits[1]).toMatchObject({ table: null, location: { id: foodLoc2 } });
    expect(card.historyTruncated).toBe(false);
  });

  it('клиент другого бизнеса той же организации и чужой организации: «не найден»', async () => {
    await expect(asFood(() => service.detail(stranger))).rejects.toThrow(/не найден/);
    await expect(asFood(() => service.detail(foreignGuest))).rejects.toThrow(/не найден/);
    await expect(asFood(() => service.detail(randomUUID()))).rejects.toThrow(/не найден/);
  });

  it('салон этой организации ресторанную карточку не открывает', async () => {
    await expect(withSignedInUser(actor(salon, salonLoc, 'BEAUTY'), () => service.detail(guest))).rejects.toThrow(/Food Service/);
  });
});
