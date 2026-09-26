import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { AuditService } from '../../apps/api/src/audit/audit.module';
import { PrismaFinanceRepository } from '../../apps/api/src/finance/finance.repository';
import { PrismaGuestsRepository } from '../../apps/api/src/guests/guests.repository';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { PrismaUnitsRepository } from '../../apps/api/src/units/units.repository';
import { PrismaAnalyticsRepository } from '../../apps/api/src/analytics/analytics.repository';
import { forgetPropertyRef } from '../../apps/api/src/database/property-ref';
import { PrismaChannelsRepository } from '../../apps/api/src/channels/channels.repository';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;
class Rollback extends Error {}

/**
 * Q-152, проверка по SECURITY.md 24.09.2026: замок организаций (ADR-061) стоял в выборке объекта, а гости, журнал и
 * поиск счёта по id шли мимо него. Вошедший из другой организации видел гостей, журнал и мог дотянуться до чужого
 * счёта по известному id. Две организации заводятся в транзакции, которая откатывается: тестовая схема не меняется.
 */
describe.skipIf(!url)('изоляция организаций: гости, журнал, счета (integration, DATABASE_URL required)', () => {
  let db: Db;
  beforeAll(() => {
    db = createPrismaClient(url);
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  it('чужая организация не видит гостя, журнал, счёт, начисление и платёж объекта; своя — видит', async () => {
    const stay = await db.stayGuest.findFirst({
      where: { reservationItem: { folio: { isNot: null } } },
      select: {
        guestId: true,
        reservationItem: {
          select: {
            folio: { select: { id: true, charges: { select: { id: true }, take: 1 } } },
            reservation: { select: { id: true, propertyId: true } },
          },
        },
      },
    });
    expect(stay).toBeTruthy();
    const { guestId } = stay!;
    const folio = stay!.reservationItem.folio!;
    const { propertyId } = stay!.reservationItem.reservation;
    const reservationId = stay!.reservationItem.reservation.id;
    const seen: Record<string, unknown> = {};

    await expect(
      db.$transaction(async (tx) => {
        const orgA = await tx.organization.create({ data: { name: 'Integration A' }, select: { id: true } });
        const orgB = await tx.organization.create({ data: { name: 'Integration B' }, select: { id: true } });
        await tx.property.update({ where: { id: propertyId }, data: { organizationId: orgA.id } });
        await tx.property.create({
          data: {
            organizationId: orgB.id,
            name: 'Чужой объект (integration)',
            timezone: 'Asia/Almaty',
            currency: 'KZT',
            checkInTime: '14:00',
            checkOutTime: '12:00',
          },
        });
        const payment = await tx.payment.create({
          data: { propertyId, method: 'CASH', status: 'COMPLETED', amount: 100n, currency: 'KZT', paidAt: new Date() },
          select: { id: true },
        });
        await tx.auditLog.create({
          data: { entityType: 'Reservation', entityId: reservationId, action: 'integration.isolation' },
        });
        const prisma = { db: tx } as unknown as PrismaService;
        const guests = new PrismaGuestsRepository(prisma);
        const finance = new PrismaFinanceRepository(prisma);
        const audit = new AuditService(prisma);
        const as = <T>(organizationId: string, fn: () => Promise<T>) =>
          withSignedInUser({ userId: randomUUID(), organizationId }, fn);
        const look = async (organizationId: string) => ({
          guest: (await as(organizationId, () => guests.byId(guestId))) !== null,
          folio: (await as(organizationId, () => finance.folioById(folio.id))) !== null,
          charge: folio.charges[0]
            ? (await as(organizationId, () => finance.chargeById(folio.charges[0]!.id))) !== null
            : null,
          payment: (await as(organizationId, () => finance.paymentById(payment.id))) !== null,
          audit: (await as(organizationId, () => audit.list({ limit: 500, action: 'integration.isolation' }))).length,
        });
        seen['B'] = await look(orgB.id);
        seen['A'] = await look(orgA.id);
        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);

    expect(seen['B']).toEqual({
      guest: false,
      folio: false,
      charge: folio.charges[0] ? false : null,
      payment: false,
      audit: 0,
    });
    expect(seen['A']).toEqual({
      guest: true,
      folio: true,
      charge: folio.charges[0] ? true : null,
      payment: true,
      audit: 1,
    });
  });

  /**
   * План `plans/tenant-isolation-2026-09-26.md` пп. 2–3 (перед открытием регистрации, ADR-095/096): место по коду и
   * сайты аналитики искались без объекта. Код места теперь уникален внутри объекта (DATA_MODEL v1.11): у второй
   * организации своё место с тем же кодом, и каждая видит только своё.
   */
  it('чужая организация не находит место объекта по коду и не видит, не меняет и не удаляет его сайты', async () => {
    const unit = await db.inventoryUnit.findFirst({
      select: { code: true, propertyId: true, physicalRoomId: true, accommodationTypeId: true, kind: true },
    });
    expect(unit).toBeTruthy();
    const seen: Record<string, unknown> = {};

    await expect(
      db.$transaction(async (tx) => {
        forgetPropertyRef();
        const orgA = await tx.organization.create({ data: { name: 'Integration A2' }, select: { id: true } });
        const orgB = await tx.organization.create({ data: { name: 'Integration B2' }, select: { id: true } });
        await tx.property.update({ where: { id: unit!.propertyId }, data: { organizationId: orgA.id } });
        const propB = await tx.property.create({
          data: {
            organizationId: orgB.id,
            name: 'Чужой объект 2 (integration)',
            timezone: 'Asia/Almaty',
            currency: 'KZT',
            checkInTime: '14:00',
            checkOutTime: '12:00',
          },
          select: { id: true },
        });
        const typeB = await tx.accommodationType.create({
          data: { propertyId: propB.id, code: 'cat-1', name: 'Номер B', kind: 'PRIVATE_ROOM', capacityAdults: 2 },
          select: { id: true },
        });
        // тот же код места у второго объекта — теперь это законно (UNIQUE(property_id, code))
        await tx.inventoryUnit.create({
          data: {
            propertyId: propB.id,
            code: unit!.code,
            kind: unit!.kind,
            physicalRoomId: unit!.physicalRoomId,
            accommodationTypeId: typeB.id,
          },
        });
        const siteA = await tx.trackedSite.create({
          data: { propertyId: unit!.propertyId, name: 'Сайт A', hosts: ['a.example.invalid'], publicKey: `pms_${randomUUID().slice(0, 12)}` },
          select: { id: true },
        });
        const prisma = { db: tx } as unknown as PrismaService;
        const units = new PrismaUnitsRepository(prisma);
        const sites = new PrismaAnalyticsRepository(prisma);
        const as = <T>(organizationId: string, fn: () => Promise<T>) =>
          withSignedInUser({ userId: randomUUID(), organizationId }, fn);
        seen['B'] = {
          unitType: (await as(orgB.id, () => units.unitByCode(unit!.code)))?.accommodationTypeId,
          sites: (await as(orgB.id, () => sites.sites())).map((x) => x.id).includes(siteA.id),
          site: (await as(orgB.id, () => sites.site(siteA.id))) !== null,
          update: (await as(orgB.id, () => sites.updateSite(siteA.id, { status: 'PAUSED' }))) !== null,
          delete: await as(orgB.id, () => sites.deleteSite(siteA.id)),
        };
        seen['A'] = {
          unitType: (await as(orgA.id, () => units.unitByCode(unit!.code)))?.accommodationTypeId,
          site: (await as(orgA.id, () => sites.site(siteA.id))) !== null,
        };
        seen['typeB'] = typeB.id;
        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);
    forgetPropertyRef();

    expect(seen['B']).toEqual({
      unitType: seen['typeB'],
      sites: false,
      site: false,
      update: false,
      delete: false,
    });
    expect(seen['A']).toEqual({ unitType: unit!.accommodationTypeId, site: true });
  });

  /**
   * План tenant-isolation п. 5: публикация остатков в Channex брала сопоставления, блокировки и продажи всех объектов
   * вперемешку — продажи чужой категории с тем же кодом ушли бы в остатки Luxx на OTA.
   */
  it('чужая организация не получает сопоставления Channex и продажи объекта', async () => {
    const item = await db.reservationItem.findFirst({
      where: { status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
      select: { arrivalDate: true, departureDate: true, reservation: { select: { propertyId: true } } },
    });
    expect(item).toBeTruthy();
    const from = item!.arrivalDate.toISOString().slice(0, 10);
    const to = item!.departureDate.toISOString().slice(0, 10);
    const seen: Record<string, unknown> = {};
    await expect(
      db.$transaction(async (tx) => {
        forgetPropertyRef();
        const propertyId = item!.reservation.propertyId;
        const orgA = await tx.organization.create({ data: { name: 'Integration A3' }, select: { id: true } });
        const orgB = await tx.organization.create({ data: { name: 'Integration B3' }, select: { id: true } });
        await tx.property.update({ where: { id: propertyId }, data: { organizationId: orgA.id } });
        await tx.property.create({
          data: {
            organizationId: orgB.id,
            name: 'Чужой объект 3 (integration)',
            timezone: 'Asia/Almaty',
            currency: 'KZT',
            checkInTime: '14:00',
            checkOutTime: '12:00',
          },
        });
        await tx.channelMapping.create({
          data: { propertyId, provider: 'channex', providerPropertyId: 'integration-channex-property' },
        });
        const repo = new PrismaChannelsRepository({ db: tx } as unknown as PrismaService);
        const as = <T>(organizationId: string, fn: () => Promise<T>) =>
          withSignedInUser({ userId: randomUUID(), organizationId }, fn);
        seen['B'] = {
          mappings: (await as(orgB.id, () => repo.mappings('channex'))).length,
          sold: (await as(orgB.id, () => repo.soldItems(from, to))).length,
        };
        seen['A'] = {
          mappings: (await as(orgA.id, () => repo.mappings('channex'))).length > 0,
          sold: (await as(orgA.id, () => repo.soldItems(from, to))).length > 0,
        };
        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);
    forgetPropertyRef();
    expect(seen['B']).toEqual({ mappings: 0, sold: 0 });
    expect(seen['A']).toEqual({ mappings: true, sold: true });
  });
});
