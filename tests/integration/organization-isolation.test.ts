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
import { channelOperatorOrganizationId } from '../../apps/api/src/channels/operator-access';
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
    // Гости v2 (план guests-v2-2026-09-27): справочник ходит тем же замком visible()
    const dir: Record<string, { total: number; sawGuest: boolean }> = {};

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
        const dirLook = (organizationId: string) =>
          as(organizationId, async () => {
            const d = await guests.directory({ state: 'ALL', q: '', page: 1, pageSize: 100 });
            return { total: d.counts.ALL, sawGuest: d.rows.some((r) => r.id === guestId) };
          });
        dir['B'] = await dirLook(orgB.id);
        dir['A'] = await dirLook(orgA.id);
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
    // чужой организации справочник пуст — не «отфильтрован», а нулевой, включая счётчики чипов
    expect(dir['B']).toEqual({ total: 0, sawGuest: false });
    expect(dir['A']).toMatchObject({ sawGuest: true });
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

/**
 * Аудит комиссии 26.09.2026, В-1 и В-3: модуль ячеек искал ячейку по коду на всю базу, а аналитика сайта — сайт по
 * голому id. Вошедший из другой организации видел гостей и брони объекта в карточке ячейки, ставил и снимал
 * блокировки, читал, менял и удалял сайт объекта. Две организации — в откатываемой транзакции, как выше.
 */
describe.skipIf(!url)('изоляция организаций: ячейки и сайты (integration, DATABASE_URL required)', () => {
  let db: Db;
  beforeAll(() => {
    db = createPrismaClient(url);
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  it('чужая организация не видит ячейку, её блокировку и сайт объекта; своя — видит', async () => {
    const unit = await db.inventoryUnit.findFirst({
      select: { id: true, code: true, accommodationType: { select: { propertyId: true } } },
    });
    expect(unit).toBeTruthy();
    const { propertyId } = unit!.accommodationType;
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
        const block = await tx.inventoryBlock.create({
          data: {
            inventoryUnitId: unit!.id,
            dateFrom: new Date('2099-01-01T00:00:00Z'),
            dateTo: new Date('2099-01-02T00:00:00Z'),
            type: 'MAINTENANCE',
          },
          select: { id: true },
        });
        const site = await tx.trackedSite.create({
          data: {
            propertyId,
            name: 'Сайт объекта A (integration)',
            hosts: ['isolation-a.local'],
            publicKey: `pms_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
          },
          select: { id: true },
        });
        const prisma = { db: tx } as unknown as PrismaService;
        const units = new PrismaUnitsRepository(prisma);
        const sites = new PrismaAnalyticsRepository(prisma);
        const as = <T>(organizationId: string, fn: () => Promise<T>) =>
          withSignedInUser({ userId: randomUUID(), organizationId }, fn);
        const look = async (organizationId: string) => ({
          unit: (await as(organizationId, () => units.unitByCode(unit!.code))) !== null,
          card: (await as(organizationId, () => units.card(unit!.code, '2099-01-01', '2099-01-02'))) !== null,
          block: (await as(organizationId, () => units.blockById(block.id))) !== null,
          siteInList: (await as(organizationId, () => sites.sites())).some((s) => s.id === site.id),
          site: (await as(organizationId, () => sites.site(site.id))) !== null,
          siteUpdated: (await as(organizationId, () => sites.updateSite(site.id, { name: 'Переименован' }))) !== null,
        });
        seen['B'] = await look(orgB.id);
        seen['B:deleted'] = await as(orgB.id, () => sites.deleteSite(site.id));
        seen['A'] = await look(orgA.id);
        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);

    expect(seen['B']).toEqual({
      unit: false,
      card: false,
      block: false,
      siteInList: false,
      site: false,
      siteUpdated: false,
    });
    expect(seen['B:deleted']).toBe(false);
    expect(seen['A']).toEqual({
      unit: true,
      card: true,
      block: true,
      siteInList: true,
      site: true,
      siteUpdated: true,
    });
  });
});

/**
 * Аудит 26.09, В-2 и С-3 (ADR-095): маршрутами Channex и сторожа распоряжается организация, чей объект подключён к
 * Channex. Здесь — что запрос «чья организация подключена» работает на настоящей базе: по сопоставлениям, а без них —
 * по объекту установки.
 */
describe.skipIf(!url)('организация подключённого к Channex объекта (integration, DATABASE_URL required)', () => {
  let db: Db;
  beforeAll(() => {
    db = createPrismaClient(url);
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  it('по сопоставлению Channex — организация объекта с сопоставлениями', async () => {
    const unit = await db.inventoryUnit.findFirst({
      select: { accommodationType: { select: { propertyId: true } } },
    });
    expect(unit).toBeTruthy();
    const { propertyId } = unit!.accommodationType;
    let seen: string | null = 'не спрашивали';
    await expect(
      db.$transaction(async (tx) => {
        const org = await tx.organization.create({ data: { name: 'Integration Channex' }, select: { id: true } });
        await tx.property.update({ where: { id: propertyId }, data: { organizationId: org.id } });
        await tx.channelMapping.deleteMany({ where: { provider: 'channex' } });
        await tx.channelMapping.create({
          data: { propertyId, provider: 'channex', providerPropertyId: `integration-${randomUUID()}` },
        });
        seen = await channelOperatorOrganizationId(tx as unknown as Db);
        expect(seen).toBe(org.id);
        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);
    expect(seen).not.toBe('не спрашивали');
  });
});

