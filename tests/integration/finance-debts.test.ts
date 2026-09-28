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
 * ADR-113: список «Брони с остатком к сбору» читает брони одним SQL-запросом, а не через Prisma — за год это тысячи
 * броней. Запрос проверяется здесь, на настоящей схеме: какие брони попадают в период, что считается в суммах.
 * Брони теста — в марте 2031, вымышленные (ADR-010), удаляются в конце.
 */
describe.skipIf(!url)('брони с остатком к сбору — запрос по счетам (integration, ADR-113)', () => {
  let db: Db;
  let repo: PrismaFinanceRepository;
  let propertyId = '';
  let organizationId = '';
  let accommodationTypeId = '';
  const PREFIX = 'IT-DEBT-';
  const FROM = '2031-03-01';
  const TO = '2031-03-31';
  const day = (d: string) => new Date(`${d}T00:00:00Z`);

  /** Бронь из одного или нескольких проживаний; у каждого свой счёт с начислениями, оплатами и возвратами. */
  async function reservation(
    suffix: string,
    guest: string | null,
    folios: Array<{
      charges: Array<{ amount: bigint; date: string; voided?: boolean }>;
      payments?: Array<{ amount: bigint; voided?: boolean; refund?: bigint }>;
    }>,
  ) {
    const primaryGuest = guest
      ? await db.guest.create({
          data: { firstName: guest.split(' ')[0]!, lastName: guest.split(' ')[1]!, organizationId },
        })
      : null;
    const r = await db.reservation.create({
      data: {
        propertyId,
        confirmationNumber: `${PREFIX}${suffix}`,
        source: 'DESK',
        status: 'CONFIRMED',
        arrivalDate: day('2031-03-10'),
        departureDate: day('2031-03-12'),
        adults: 1,
        currency: 'KZT',
        totalAmount: 0n,
        primaryGuestId: primaryGuest?.id ?? null,
      },
    });
    for (const f of folios) {
      const item = await db.reservationItem.create({
        data: {
          reservationId: r.id,
          accommodationTypeId,
          arrivalDate: day('2031-03-10'),
          departureDate: day('2031-03-12'),
          price: 0n,
          status: 'CONFIRMED',
        },
      });
      const folio = await db.folio.create({ data: { reservationItemId: item.id, currency: 'KZT' } });
      for (const c of f.charges)
        await db.charge.create({
          data: {
            folioId: folio.id,
            kind: 'SERVICE',
            description: 'integration: долги за период',
            quantity: 1,
            unitPrice: c.amount,
            amount: c.amount,
            serviceDate: day(c.date),
            voidedAt: c.voided ? new Date() : null,
          },
        });
      for (const p of f.payments ?? []) {
        const payment = await db.payment.create({
          data: {
            propertyId,
            method: 'CASH',
            amount: p.amount,
            currency: 'KZT',
            status: p.voided ? 'VOIDED' : 'COMPLETED',
            allocations: { create: [{ folioId: folio.id, amount: p.amount }] },
          },
        });
        if (p.refund)
          await db.refund.create({
            data: { paymentId: payment.id, folioId: folio.id, amount: p.refund },
          });
      }
    }
  }

  async function cleanup() {
    const reservations = await db.reservation.findMany({
      where: { confirmationNumber: { startsWith: PREFIX } },
      select: { primaryGuestId: true, items: { select: { folio: { select: { id: true } } } } },
    });
    const folioIds = reservations.flatMap((r) =>
      r.items.flatMap((i) => (i.folio ? [i.folio.id] : [])),
    );
    const paymentIds = (
      await db.paymentAllocation.findMany({
        where: { folioId: { in: folioIds } },
        select: { paymentId: true },
      })
    ).map((a) => a.paymentId);
    await db.refund.deleteMany({ where: { folioId: { in: folioIds } } });
    await db.paymentAllocation.deleteMany({ where: { folioId: { in: folioIds } } });
    await db.payment.deleteMany({ where: { id: { in: paymentIds } } });
    await db.charge.deleteMany({ where: { folioId: { in: folioIds } } });
    await db.folio.deleteMany({ where: { id: { in: folioIds } } });
    await db.reservationItem.deleteMany({
      where: { reservation: { confirmationNumber: { startsWith: PREFIX } } },
    });
    await db.reservation.deleteMany({ where: { confirmationNumber: { startsWith: PREFIX } } });
    const guestIds = reservations.flatMap((r) => (r.primaryGuestId ? [r.primaryGuestId] : []));
    await db.guest.deleteMany({ where: { id: { in: guestIds } } });
  }

  beforeAll(async () => {
    db = createPrismaClient(url);
    repo = new PrismaFinanceRepository({ db } as unknown as PrismaService);
    const property = await db.property.findFirst({
      where: { name: LUXX_APARTS_PROPERTY.name },
      orderBy: { createdAt: 'asc' },
      select: { id: true, organizationId: true },
    });
    expect(property, 'в тестовой базе нужен объект').toBeTruthy();
    propertyId = property!.id;
    organizationId = property!.organizationId;
    const type = await db.accommodationType.findFirst({ where: { propertyId }, select: { id: true } });
    expect(type, 'в тестовой базе нужна категория').toBeTruthy();
    accommodationTypeId = type!.id;
    await cleanup();

    // A: начисление в периоде и начисление в феврале (в остаток входит), сторно не считается; аннулированный платёж не
    // считается, возврат прибавляется
    await reservation('A', 'Тестов Долгов', [
      {
        charges: [
          { amount: 100_000n, date: '2031-03-10' },
          { amount: 5_000n, date: '2031-02-20' },
          { amount: 999_000n, date: '2031-03-11', voided: true },
        ],
        payments: [{ amount: 30_000n, refund: 10_000n }, { amount: 50_000n, voided: true }],
      },
    ]);
    // B: начисление только в апреле — в март не попадает
    await reservation('B', null, [{ charges: [{ amount: 70_000n, date: '2031-04-02' }] }]);
    // C: в марте только сторнированное начисление — не попадает
    await reservation('C', null, [
      { charges: [{ amount: 60_000n, date: '2031-03-15', voided: true }] },
    ]);
    // D: два проживания — суммы складываются по брони; гостя нет
    await reservation('D', null, [
      { charges: [{ amount: 40_000n, date: '2031-03-20' }], payments: [{ amount: 40_000n }] },
      { charges: [{ amount: 40_000n, date: '2031-03-21' }] },
    ]);
  });

  afterAll(async () => {
    if (!db) return;
    await cleanup();
    await db.$disconnect();
  });

  it('брони с действующим начислением в периоде; суммы — по всем счетам брони и за всё время', async () => {
    const rows = (await repo.periodDebts(FROM, TO))
      .filter((r) => r.confirmationNumber.startsWith(PREFIX))
      .sort((a, b) => a.confirmationNumber.localeCompare(b.confirmationNumber));
    expect(rows).toEqual([
      {
        confirmationNumber: `${PREFIX}A`,
        status: 'CONFIRMED',
        arrivalDate: '2031-03-10',
        departureDate: '2031-03-12',
        guestLabel: 'Тестов Долгов',
        chargedMinor: 105_000n,
        paidMinor: 30_000n,
        refundedMinor: 10_000n,
      },
      {
        confirmationNumber: `${PREFIX}D`,
        status: 'CONFIRMED',
        arrivalDate: '2031-03-10',
        departureDate: '2031-03-12',
        guestLabel: null,
        chargedMinor: 80_000n,
        paidMinor: 40_000n,
        refundedMinor: 0n,
      },
    ]);
    // апрельская B видна в апреле: отбор идёт по дате услуги, а не по датам проживания
    const april = (await repo.periodDebts('2031-04-01', '2031-04-30')).filter((r) =>
      r.confirmationNumber.startsWith(PREFIX),
    );
    expect(april.map((r) => r.confirmationNumber)).toEqual([`${PREFIX}B`]);
  });
});
