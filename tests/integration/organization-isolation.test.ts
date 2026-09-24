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
