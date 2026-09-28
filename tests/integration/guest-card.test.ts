import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { PrismaGuestsRepository } from '../../apps/api/src/guests/guests.repository';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * «Гости v2», G4 (ТЗ §20–§21): история проживаний в карточке гостя называет источник брони и сумму по
 * счёту проживания, а текущее проживание — его остаток. Деньги — из Folio проживания (ТЗ §24: своих
 * «денег гостя» нет), поэтому здесь сумма сверяется с начислениями счёта на настоящей базе.
 */
describe.skipIf(!url)('карточка гостя: источник и счёт каждого проживания (integration, DATABASE_URL required)', () => {
  let db: Db;
  beforeAll(() => {
    db = createPrismaClient(url);
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  it('проживание со счётом: источник и канал брони, валюта, начислено и остаток — из счёта', async () => {
    const stay = await db.stayGuest.findFirst({
      where: { reservationItem: { folio: { charges: { some: { voidedAt: null } } } } },
      select: {
        guestId: true,
        reservationItem: {
          select: {
            arrivalDate: true,
            reservation: {
              select: { confirmationNumber: true, source: true, channel: true, currency: true },
            },
            folio: {
              select: {
                charges: { where: { voidedAt: null }, select: { amount: true } },
                allocations: { where: { payment: { status: 'COMPLETED' } }, select: { amount: true } },
                refunds: { select: { amount: true } },
              },
            },
          },
        },
      },
    });
    expect(stay).toBeTruthy();
    const { reservation, folio, arrivalDate } = stay!.reservationItem;
    const sum = (xs: Array<{ amount: bigint }>) => xs.reduce((s, x) => s + x.amount, 0n);
    const charged = sum(folio!.charges);
    const paid = sum(folio!.allocations);
    const refunded = sum(folio!.refunds);
    const balance = charged - paid + refunded;

    const guests = new PrismaGuestsRepository({ db } as unknown as PrismaService);
    const card = await guests.byId(stay!.guestId);
    const row = card!.stays.find(
      (s) =>
        s.confirmationNumber === reservation.confirmationNumber &&
        s.arrivalDate === arrivalDate.toISOString().slice(0, 10),
    );
    expect(row).toMatchObject({
      source: reservation.source,
      channel: reservation.channel,
      currency: reservation.currency,
      chargedMinor: charged.toString(),
      // G5 (ТЗ §24): финансовый свод гостя складывается из счетов его проживаний
      paidMinor: paid.toString(),
      refundedMinor: refunded.toString(),
      balanceMinor: balance.toString(),
    });
  });

  it('проживание без счёта: сумм нет — null, а не ноль', async () => {
    const stay = await db.stayGuest.findFirst({
      where: { reservationItem: { folio: { is: null } } },
      select: {
        guestId: true,
        reservationItem: {
          select: { arrivalDate: true, reservation: { select: { confirmationNumber: true } } },
        },
      },
    });
    // в сиде каждое проживание может оказаться со счётом — тогда проверять нечего
    if (!stay) return;
    const guests = new PrismaGuestsRepository({ db } as unknown as PrismaService);
    const card = await guests.byId(stay.guestId);
    const row = card!.stays.find(
      (s) =>
        s.confirmationNumber === stay.reservationItem.reservation.confirmationNumber &&
        s.arrivalDate === stay.reservationItem.arrivalDate.toISOString().slice(0, 10),
    );
    expect(row).toMatchObject({
      chargedMinor: null,
      paidMinor: null,
      refundedMinor: null,
      balanceMinor: null,
    });
  });
});
