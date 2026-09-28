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
 * ADR-113, F2: список «Оплаты и возвраты» читает операции одним SQL-запросом. Проверяется на настоящей схеме: границы
 * суток по поясу объекта, аннулированная оплата со своим статусом, способ возврата — от платежа, бронь — через
 * распределение платежа, отборы и порядок. Брони и платежи теста — в мае 2031, вымышленные (ADR-010), удаляются.
 */
describe.skipIf(!url)('оплаты и возвраты за период — запрос (integration, ADR-113 F2)', () => {
  let db: Db;
  let repo: PrismaFinanceRepository;
  let propertyId = '';
  let organizationId = '';
  let accommodationTypeId = '';
  const PREFIX = 'IT-OPS-';
  const ids: Record<string, string> = {};
  const day = (d: string) => new Date(`${d}T00:00:00Z`);

  async function booking(suffix: string, guest: string | null): Promise<string> {
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
        arrivalDate: day('2031-05-10'),
        departureDate: day('2031-05-12'),
        adults: 1,
        currency: 'KZT',
        totalAmount: 0n,
        primaryGuestId: primaryGuest?.id ?? null,
      },
    });
    const item = await db.reservationItem.create({
      data: {
        reservationId: r.id,
        accommodationTypeId,
        arrivalDate: day('2031-05-10'),
        departureDate: day('2031-05-12'),
        price: 0n,
        status: 'CONFIRMED',
      },
    });
    return (await db.folio.create({ data: { reservationItemId: item.id, currency: 'KZT' } })).id;
  }

  async function payment(
    key: string,
    method: 'CASH' | 'KASPI',
    amount: bigint,
    paidAt: string,
    allocations: Array<[string, bigint]>,
    voided = false,
  ) {
    const p = await db.payment.create({
      data: {
        propertyId,
        method,
        amount,
        currency: 'KZT',
        status: voided ? 'VOIDED' : 'COMPLETED',
        paidAt: new Date(paidAt),
        allocations: { create: allocations.map(([folioId, a]) => ({ folioId, amount: a })) },
      },
    });
    ids[key] = p.id;
  }

  async function cleanup() {
    const folios = await db.folio.findMany({
      where: { reservationItem: { reservation: { confirmationNumber: { startsWith: PREFIX } } } },
      select: { id: true },
    });
    const folioIds = folios.map((f) => f.id);
    const paymentIds = (
      await db.paymentAllocation.findMany({
        where: { folioId: { in: folioIds } },
        select: { paymentId: true },
      })
    ).map((a) => a.paymentId);
    await db.refund.deleteMany({ where: { folioId: { in: folioIds } } });
    await db.paymentAllocation.deleteMany({ where: { folioId: { in: folioIds } } });
    await db.payment.deleteMany({ where: { id: { in: paymentIds } } });
    await db.folio.deleteMany({ where: { id: { in: folioIds } } });
    const reservations = await db.reservation.findMany({
      where: { confirmationNumber: { startsWith: PREFIX } },
      select: { primaryGuestId: true },
    });
    await db.reservationItem.deleteMany({
      where: { reservation: { confirmationNumber: { startsWith: PREFIX } } },
    });
    await db.reservation.deleteMany({ where: { confirmationNumber: { startsWith: PREFIX } } });
    await db.guest.deleteMany({
      where: {
        id: { in: reservations.flatMap((r) => (r.primaryGuestId ? [r.primaryGuestId] : [])) },
      },
    });
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
    const type = await db.accommodationType.findFirst({
      where: { propertyId },
      select: { id: true },
    });
    expect(type, 'в тестовой базе нужна категория').toBeTruthy();
    accommodationTypeId = type!.id;
    await cleanup();

    const a = await booking('A', 'Тестов Операций');
    const b = await booking('B', null);
    // 20:30 UTC 10 мая — уже 11 мая по Алматы: оплата относится к 11-му
    await payment('P1', 'CASH', 10_000n, '2031-05-10T20:30:00Z', [[a, 10_000n]]);
    // аннулированная оплата на счета двух броней — первой по номеру считается A, броней две
    await payment(
      'P2',
      'KASPI',
      20_000n,
      '2031-05-12T06:00:00Z',
      [
        [a, 15_000n],
        [b, 5_000n],
      ],
      true,
    );
    await payment('P3', 'KASPI', 7_000n, '2031-05-13T06:00:00Z', [[b, 7_000n]]);
    const refund = await db.refund.create({
      data: {
        paymentId: ids.P3!,
        folioId: b,
        amount: 3_000n,
        createdAt: new Date('2031-05-14T06:00:00Z'),
      },
    });
    ids.R1 = refund.id;
    // июнь — вне периода
    await payment('P4', 'CASH', 1_000n, '2031-06-02T06:00:00Z', [[a, 1_000n]]);
  });

  afterAll(async () => {
    if (!db) return;
    await cleanup();
    await db.$disconnect();
  });

  const mine = <T extends { id: string }>(rows: T[]) =>
    rows.filter((r) => Object.values(ids).includes(r.id));

  it('операции периода новыми первыми: время по часам объекта, статус аннулированной, способ возврата, бронь', async () => {
    const { rows, summary } = await repo.periodOperations('2031-05-11', '2031-05-31', {
      limit: 50,
    });
    const got = mine(rows);
    expect(got.map((r) => r.id)).toEqual([ids.R1, ids.P3, ids.P2, ids.P1]);
    expect(got[0]).toMatchObject({
      kind: 'REFUND',
      method: 'KASPI', // способ возврата — от платежа, с которого вернули
      amountMinor: 3_000n,
      status: 'COMPLETED',
      confirmationNumber: `${PREFIX}B`,
      reservations: 1,
      guestLabel: null,
    });
    expect(got[2]).toMatchObject({
      kind: 'PAYMENT',
      status: 'VOIDED',
      amountMinor: 20_000n,
      confirmationNumber: `${PREFIX}A`,
      reservations: 2,
      guestLabel: 'Тестов Операций',
    });
    expect(got[3]!.localAt).toMatch(/^2031-05-11 0[12]:30$/);
    expect(summary).toEqual(
      expect.arrayContaining([
        { kind: 'PAYMENT', method: 'CASH', status: 'COMPLETED', count: 1, amountMinor: 10_000n },
        { kind: 'PAYMENT', method: 'KASPI', status: 'VOIDED', count: 1, amountMinor: 20_000n },
        { kind: 'PAYMENT', method: 'KASPI', status: 'COMPLETED', count: 1, amountMinor: 7_000n },
        { kind: 'REFUND', method: 'KASPI', status: 'COMPLETED', count: 1, amountMinor: 3_000n },
      ]),
    );
  });

  it('границы суток — по поясу объекта; отборы по типу и способу; предел строк', async () => {
    const tenth = await repo.periodOperations('2031-05-10', '2031-05-10', { limit: 50 });
    expect(mine(tenth.rows)).toEqual([]);
    const refunds = await repo.periodOperations('2031-05-01', '2031-05-31', {
      type: 'REFUND',
      limit: 50,
    });
    expect(mine(refunds.rows).map((r) => r.id)).toEqual([ids.R1]);
    const cash = await repo.periodOperations('2031-05-01', '2031-05-31', {
      method: 'CASH',
      limit: 50,
    });
    expect(mine(cash.rows).map((r) => r.id)).toEqual([ids.P1]);
    const two = await repo.periodOperations('2031-05-01', '2031-05-31', { limit: 2 });
    expect(two.rows.map((r) => r.id)).toEqual([ids.R1, ids.P3]);
  });
});
