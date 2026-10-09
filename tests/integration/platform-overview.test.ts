import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { parseOrganizationCreate, type OrganizationCreate } from '@pms/domain';
import { OrganizationCreation } from '../../apps/api/src/platform/organization-creation';
import { OrganizationsRepository } from '../../apps/api/src/platform/organizations.repository';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;
class Rollback extends Error {}

/**
 * «Платформа → Организации», сквозной обзор (ADR-156): дерево организаций, доход и клиенты салона, брони и гости ресторана
 * по месяцам в поясе филиала. Организации заводит настоящая служба создания. Всё вымышленное (ADR-010), каждый тест откатывается.
 */
describe.skipIf(!url)('сквозной обзор платформы: выборки на настоящей базе (integration, DATABASE_URL required)', () => {
  let db: Db;
  beforeAll(() => {
    db = createPrismaClient(url);
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  /** Репозиторий поверх открытой транзакции: его `$transaction` просто продолжает её, откат делает тест */
  async function rolledBack(fn: (repo: OrganizationsRepository & { create: (i: OrganizationCreate, by: null) => Promise<unknown> }, tx: Db) => Promise<void>): Promise<void> {
    await expect(
      db.$transaction(async (raw) => {
        const tx = raw as unknown as Db;
        const prisma = {
          db: new Proxy(tx, {
            get: (target, prop) =>
              prop === '$transaction' ? (cb: (t: Db) => unknown) => cb(tx) : Reflect.get(target, prop),
          }),
        } as unknown as PrismaService;
        const reads = new OrganizationsRepository(prisma);
        const creation = new OrganizationCreation(prisma, null, 'https://app.example.invalid');
        await fn(Object.assign(reads, { create: (i: OrganizationCreate, by: null) => creation.create({ ...i, by }) }), tx);
        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);
  }

  const input = (over: Record<string, unknown> = {}): OrganizationCreate => {
    const mark = randomUUID().slice(0, 8);
    const parsed = parseOrganizationCreate({
      id: randomUUID(),
      name: `Группа ${mark}`,
      brand: `Бренд ${mark}`,
      vertical: 'HOSPITALITY',
      ownerName: 'Владелец Пример',
      ownerEmail: `owner-${mark}@example.invalid`,
      phoneCountry: 'KZ',
      ownerPhone: '+7 700 123 45 67',
      country: 'KZ',
      city: 'Алматы',
      timezone: 'Asia/Almaty',
      currency: 'KZT',
      bin: '1234567890',
      website: 'example.kz',
      createFirstBranch: true,
      branchName: `Филиал ${mark}`,
      branchAddress: 'Алматы, ул. Пример, 1',
      ...over,
    });
    if (!parsed.ok) throw new Error(parsed.errors.join('; '));
    return parsed.value;
  };

  it('дерево платформы видит новую организацию; выборки салона и ресторана по месяцам исполнимы на настоящей базе', async () => {
    await rolledBack(async (repo) => {
      const data = input({ vertical: 'BEAUTY' });
      await repo.create(data, null);
      const mine = (await repo.tree()).find((o) => o.id === data.id)!;
      expect(mine).toMatchObject({ status: 'ACTIVE', owners: [data.owner.email] });
      expect(mine.locations).toHaveLength(1);
      expect(mine.locations[0]).toMatchObject({ vertical: 'BEAUTY', propertyId: null, currency: 'KZT' });
      const ids = mine.locations.map((l) => l.id);
      const range = { from: '2026-10-01', to: '2026-10-31' };
      expect(await repo.salonMonths(ids, range)).toEqual([]);
      expect(await repo.restaurantMonths(ids, range)).toEqual([]);
      const log = await repo.activity(5);
      expect(log.some((r) => r.action === 'organization.created' && r.organizationId === data.id)).toBe(true);
    });
  });

  it('доход и клиенты салона, брони и гости ресторана считаются по месяцам в поясе филиала; отмены не входят', async () => {
    await rolledBack(async (repo, tx) => {
      const salon = input({ vertical: 'BEAUTY' });
      await repo.create(salon, null);
      const sLoc = await tx.location.findFirstOrThrow({ where: { business: { organizationId: salon.id } } });
      const business = await tx.business.findFirstOrThrow({ where: { organizationId: salon.id } });
      const customer = await tx.customer.create({ data: { organizationId: salon.id, firstName: 'Клиент' } });
      const second = await tx.customer.create({ data: { organizationId: salon.id, firstName: 'Другой' } });
      const employee = await tx.employee.create({ data: { businessId: business.id, name: 'Мастер' } });
      const service = await tx.beautyService.create({
        data: { businessId: business.id, name: 'Стрижка', durationMinutes: 60, price: 100_000n, currency: 'KZT' },
      });
      await tx.employeeLocation.create({ data: { employeeId: employee.id, locationId: sLoc.id } });
      await tx.employeeService.create({ data: { employeeId: employee.id, serviceId: service.id } });
      await tx.locationService.create({ data: { locationId: sLoc.id, serviceId: service.id } });
      const visit = (customerId: string, startsAt: string, status: 'DONE' | 'CANCELLED' | 'BOOKED', price: bigint) =>
        tx.appointment.create({
          data: {
            locationId: sLoc.id,
            customerId,
            employeeId: employee.id,
            serviceId: service.id,
            startsAt: new Date(startsAt),
            endsAt: new Date(new Date(startsAt).getTime() + 3_600_000),
            status,
            price,
            currency: 'KZT',
          },
        });
      await visit(customer.id, '2026-10-03T08:00:00Z', 'DONE', 100_000n);
      await visit(customer.id, '2026-10-05T08:00:00Z', 'DONE', 50_000n);
      await visit(second.id, '2026-10-06T08:00:00Z', 'BOOKED', 70_000n);
      await visit(second.id, '2026-10-07T08:00:00Z', 'CANCELLED', 90_000n);
      await visit(second.id, '2026-09-30T20:00:00Z', 'DONE', 30_000n); // 01.10 01:00 по Алматы: уже октябрь
      await visit(second.id, '2026-09-10T08:00:00Z', 'DONE', 10_000n);
      const rows = await repo.salonMonths([sLoc.id], { from: '2026-09-01', to: '2026-10-31' });
      const by = Object.fromEntries(rows.map((r) => [r.month, r]));
      // доход только выполненных; клиентов двое; отменённая запись не считается
      expect(by['2026-10']).toMatchObject({ revenueMinor: 180_000, bookings: 4, guests: 2 });
      expect(by['2026-09']).toMatchObject({ revenueMinor: 10_000, bookings: 1, guests: 1 });

      const food = input({ vertical: 'FOOD_SERVICE' });
      await repo.create(food, null);
      const fLoc = await tx.location.findFirstOrThrow({ where: { business: { organizationId: food.id } } });
      const guest = await tx.customer.create({ data: { organizationId: food.id, firstName: 'Гость' } });
      const period = await tx.servicePeriod.create({
        data: {
          locationId: fLoc.id,
          name: 'Ужин',
          weekday: 5,
          timeFrom: new Date('1970-01-01T18:00:00Z'),
          timeTo: new Date('1970-01-01T23:00:00Z'),
          defaultDurationMinutes: 120,
        },
      });
      const seat = (startsAt: string, partySize: number, status: 'BOOKED' | 'COMPLETED' | 'CANCELLED') =>
        tx.restaurantReservation.create({
          data: {
            locationId: fLoc.id,
            customerId: guest.id,
            servicePeriodId: period.id,
            startsAt: new Date(startsAt),
            endsAt: new Date(new Date(startsAt).getTime() + 7_200_000),
            partySize,
            status,
            creationKey: randomUUID(),
            creationFingerprint: randomUUID().replace(/-/g, '').padEnd(64, '0'),
          },
        });
      await seat('2026-10-02T14:00:00Z', 4, 'BOOKED');
      await seat('2026-10-09T14:00:00Z', 2, 'COMPLETED');
      await seat('2026-10-10T14:00:00Z', 5, 'CANCELLED');
      const food10 = await repo.restaurantMonths([fLoc.id], { from: '2026-10-01', to: '2026-10-31' });
      expect(food10).toEqual([{ locationId: fLoc.id, month: '2026-10', revenueMinor: 0, bookings: 2, guests: 6 }]);
    });
  });
});
