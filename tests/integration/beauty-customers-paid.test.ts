import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { BeautyCatalogService } from '../../apps/api/src/beauty/beauty.module';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * «Клиенты» салона это пришли и оплатили (владелец 01.11.2026): список отдаёт по каждому человеку оплаченные визиты
 * (завершённая запись с проведённой оплатой) и неявки, экран по ним делит «Все клиенты», «Не дошли», «Пока без
 * визита». Отменённая оплата и чужой бизнес не считаются. Вымышленные данные (ADR-010), только локальная база.
 */
describe('клиенты салона: оплаченные визиты и неявки (integration)', () => {
  const url = process.env.DATABASE_URL;
  if (!url || !isLocalDatabase(url)) throw new Error('Проверяется только на локальной PostgreSQL');
  let db: Db, catalog: BeautyCatalogService;
  const org = randomUUID(), user = randomUUID(), business = randomUUID(), other = randomUUID();
  const location = randomUUID(), otherLocation = randomUUID();
  const as = <T>(fn: () => Promise<T>) =>
    withSignedInUser(
      { userId: user, organizationId: org, role: 'OWNER', scope: 'LOCATION', vertical: 'BEAUTY', businessId: business, locationId: location },
      fn,
    );
  const people: Record<string, string> = {};

  beforeAll(async () => {
    db = createPrismaClient(url);
    catalog = new BeautyCatalogService({ db } as unknown as PrismaService);
    await db.organization.create({ data: { id: org, name: 'Клиенты пришли и оплатили', status: 'ACTIVE' } });
    await db.user.create({ data: { id: user, email: `paid-${user}@example.invalid`, name: 'Владелец' } });
    for (const id of [business, other]) await db.business.create({ data: { id, organizationId: org, name: 'Салон', vertical: 'BEAUTY' } });
    for (const [id, businessId] of [[location, business], [otherLocation, other]] as const)
      await db.location.create({ data: { id, businessId, name: 'Филиал', timezone: 'Asia/Almaty', currency: 'KZT' } });
    const service = await db.beautyService.create({ data: { businessId: business, name: 'Стрижка', durationMinutes: 60, price: 500000n, currency: 'KZT' } });
    const otherService = await db.beautyService.create({ data: { businessId: other, name: 'Стрижка', durationMinutes: 60, price: 500000n, currency: 'KZT' } });
    const master = await db.employee.create({ data: { businessId: business, name: 'Мастер' } });
    const otherMaster = await db.employee.create({ data: { businessId: other, name: 'Мастер' } });
    await db.employeeLocation.create({ data: { employeeId: master.id, locationId: location } });
    await db.employeeLocation.create({ data: { employeeId: otherMaster.id, locationId: otherLocation } });
    await db.employeeService.create({ data: { employeeId: master.id, serviceId: service.id } });
    await db.employeeService.create({ data: { employeeId: otherMaster.id, serviceId: otherService.id } });
    await db.locationService.create({ data: { locationId: location, serviceId: service.id, enabled: true } });
    await db.locationService.create({ data: { locationId: otherLocation, serviceId: otherService.id, enabled: true } });
    for (const name of ['Оплатила', 'Без оплаты', 'Не пришла', 'Возврат оплаты', 'Оплатила в другом салоне'])
      people[name] = (await db.customer.create({
        data: { organizationId: org, firstName: name, businesses: { create: [{ businessId: business }, { businessId: other }] } },
      })).id;
    let hour = 0;
    const visit = async (who: string, status: 'DONE' | 'NO_SHOW', pay?: 'COMPLETED' | 'VOIDED', where = location) => {
      const start = new Date(Date.UTC(2026, 9, 1, 6 + hour++));
      const a = await db.appointment.create({
        data: {
          locationId: where, customerId: people[who]!, employeeId: where === location ? master.id : otherMaster.id,
          serviceId: where === location ? service.id : otherService.id, startsAt: start,
          endsAt: new Date(start.getTime() + 3600_000), status, price: 500000n, currency: 'KZT',
        },
      });
      if (pay)
        await db.restaurantCashOperation.create({
          data: {
            locationId: where, kind: 'INCOME', method: 'CASH', amount: 500000n, currency: 'KZT', status: pay, appointmentId: a.id,
            ...(pay === 'VOIDED' ? { voidedAt: new Date() } : {}),
          },
        });
    };
    await visit('Оплатила', 'DONE', 'COMPLETED');
    await visit('Оплатила', 'DONE', 'COMPLETED');
    await visit('Без оплаты', 'DONE');
    await visit('Не пришла', 'NO_SHOW');
    await visit('Не пришла', 'NO_SHOW');
    await visit('Возврат оплаты', 'DONE', 'VOIDED');
    await visit('Оплатила в другом салоне', 'DONE', 'COMPLETED', otherLocation);
  });
  afterAll(async () => db?.$disconnect());

  it('оплаченные визиты и неявки по каждому клиенту', async () => {
    const { items } = await as(() => catalog.customers());
    const by = (name: string) => items.find((c) => c.id === people[name])!;
    expect([by('Оплатила').visits, by('Оплатила').paidVisits, by('Оплатила').noShows]).toEqual([2, 2, 0]);
    expect([by('Без оплаты').visits, by('Без оплаты').paidVisits]).toEqual([1, 0]);
    expect([by('Не пришла').paidVisits, by('Не пришла').noShows]).toEqual([0, 2]);
    expect(by('Возврат оплаты').paidVisits).toBe(0);
    expect(by('Оплатила в другом салоне').paidVisits).toBe(0);
  });
});
