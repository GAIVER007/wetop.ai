import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { LUXX_APARTS_PROPERTY } from '@pms/domain';
import { PrismaFinanceRepository } from '../../apps/api/src/finance/finance.repository';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * «Сколько принёс сотрудник» гостиницы (docs/decisions/2026-10-20-personnel-revenue.md): оплаты броней минус
 * возвраты за окно периода по поясу объекта, сотрудник = кто создал бронь по журналу; брони из каналов отдельно.
 * Брони и платежи в мае 2031, вымышленные (ADR-010), удаляются.
 */
describe.skipIf(!url)('staff revenue: hotel (integration)', () => {
  let db: Db;
  let repo: PrismaFinanceRepository;
  let propertyId = '';
  let organizationId = '';
  let accommodationTypeId = '';
  const PREFIX = 'IT-STREV-';
  const admin = randomUUID();
  const day = (d: string) => new Date(`${d}T00:00:00Z`);
  // «сейчас»: среда 14.05.2031 12:00 по Алматы
  const now = new Date('2031-05-14T07:00:00Z');

  async function booking(suffix: string, createdBy: string | null) {
    const r = await db.reservation.create({
      data: {
        propertyId, confirmationNumber: `${PREFIX}${suffix}`, source: createdBy ? 'DESK' : 'OTA', status: 'CONFIRMED',
        arrivalDate: day('2031-05-14'), departureDate: day('2031-05-16'), adults: 1, currency: 'KZT', totalAmount: 0n,
      },
    });
    const item = await db.reservationItem.create({
      data: { reservationId: r.id, accommodationTypeId, arrivalDate: day('2031-05-14'), departureDate: day('2031-05-16'), price: 0n, status: 'CONFIRMED' },
    });
    if (createdBy)
      await db.auditLog.create({
        data: { organizationId, userId: createdBy, entityType: 'Reservation', entityId: r.id, action: 'reservation.create' },
      });
    return (await db.folio.create({ data: { reservationItemId: item.id, currency: 'KZT' } })).id;
  }
  const pay = (folioId: string, amount: bigint, paidAt: string, status: 'COMPLETED' | 'VOIDED' = 'COMPLETED') =>
    db.payment.create({
      data: {
        propertyId, method: 'CASH', amount, currency: 'KZT', status, paidAt: new Date(paidAt),
        allocations: { create: [{ folioId, amount }] },
      },
    });

  async function cleanup() {
    const folioIds = (
      await db.folio.findMany({ where: { reservationItem: { reservation: { confirmationNumber: { startsWith: PREFIX } } } }, select: { id: true } })
    ).map((f) => f.id);
    const paymentIds = (await db.paymentAllocation.findMany({ where: { folioId: { in: folioIds } }, select: { paymentId: true } })).map((a) => a.paymentId);
    const resIds = (await db.reservation.findMany({ where: { confirmationNumber: { startsWith: PREFIX } }, select: { id: true } })).map((r) => r.id);
    await db.refund.deleteMany({ where: { folioId: { in: folioIds } } });
    await db.paymentAllocation.deleteMany({ where: { folioId: { in: folioIds } } });
    await db.payment.deleteMany({ where: { id: { in: paymentIds } } });
    await db.folio.deleteMany({ where: { id: { in: folioIds } } });
    await db.reservationItem.deleteMany({ where: { reservationId: { in: resIds } } });
    await db.reservation.deleteMany({ where: { id: { in: resIds } } });
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('wetop.audit_purge', 'on', true)`;
      await tx.auditLog.deleteMany({ where: { entityId: { in: resIds } } });
    });
    await db.user.deleteMany({ where: { id: admin } });
  }

  beforeAll(async () => {
    db = createPrismaClient(url);
    repo = new PrismaFinanceRepository({ db } as unknown as PrismaService);
    const property = await db.property.findFirst({
      where: { name: LUXX_APARTS_PROPERTY.name }, orderBy: { createdAt: 'asc' }, select: { id: true, organizationId: true },
    });
    expect(property, 'в тестовой базе нужен объект').toBeTruthy();
    propertyId = property!.id;
    organizationId = property!.organizationId!;
    accommodationTypeId = (await db.accommodationType.findFirstOrThrow({ where: { propertyId }, select: { id: true } })).id;
    await cleanup();
    await db.user.create({ data: { id: admin, email: `strev-${admin}@example.invalid`, name: 'Администратор Тест' } });
    const a = await booking('A', admin);
    const b = await booking('B', null);
    const p = await pay(a, 30_000n, '2031-05-14T05:00:00Z');
    await pay(a, 999n, '2031-05-14T05:10:00Z', 'VOIDED');
    await db.refund.create({ data: { paymentId: p.id, folioId: a, amount: 5_000n, createdAt: new Date('2031-05-14T06:00:00Z') } });
    await pay(b, 12_000n, '2031-05-14T05:00:00Z');
    // понедельник 12.05: в неделю входит, в день нет
    await pay(a, 1_000n, '2031-05-12T05:00:00Z');
  });
  afterAll(async () => {
    if (!db) return;
    await cleanup();
    await db.$disconnect();
  });

  it('день: создавший бронь получает оплату минус возврат, канал отдельно, аннулированное не считается', async () => {
    const r = await repo.staffRevenueEntries('day', now);
    expect([r.fromDate, r.toDate]).toEqual(['2031-05-14', '2031-05-14']);
    const mine = r.entries.filter((e) => e.employeeId === admin);
    expect(mine.reduce((s, e) => s + e.paidMinor, 0n)).toBe(30_000n);
    expect(mine.reduce((s, e) => s + e.refundedMinor, 0n)).toBe(5_000n);
    expect(r.entries.filter((e) => e.employeeId === null).reduce((s, e) => s + e.paidMinor, 0n)).toBe(12_000n);
    expect(r.names[admin]).toBe('Администратор Тест');
  });

  it('неделя с понедельника включает оплату 12.05', async () => {
    const r = await repo.staffRevenueEntries('week', now);
    expect(r.fromDate).toBe('2031-05-12');
    expect(r.entries.filter((e) => e.employeeId === admin).reduce((s, e) => s + e.paidMinor, 0n)).toBe(31_000n);
  });
});
