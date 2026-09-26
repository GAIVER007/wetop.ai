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
 * Аудит 26.09, В-2 и С-3 (ADR-085): маршрутами Channex и сторожа распоряжается организация, чей объект подключён к
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

