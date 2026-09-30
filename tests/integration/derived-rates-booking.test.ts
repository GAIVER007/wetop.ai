import 'reflect-metadata';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { UnprocessableEntityException } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { discountedMinor } from '@pms/domain';
import { PrismaReservationsRepository } from '../../apps/api/src/reservations/reservations.repository';
import { ReservationsService } from '../../apps/api/src/reservations/reservations.service';
import { NoopAriPublisher } from '../../apps/api/src/channels/ari-publisher';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;
const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
class Rollback extends Error {}

/**
 * Производный тариф и промокод в брони (DATA_MODEL §20, ADR-128, срез D4; Q-230, Q-231): цена производного — от
 * цен родителя со скидкой тарифа; промокод — одна большая скидка без суммирования; окно продаж и предел использований
 * отказывают словами; скидка промокода переживает продление. Всё внутри откатываемой транзакции на засеянном объекте.
 */
describe.skipIf(!url)('derived rate plans and promo codes in a booking (integration, rolled back)', () => {
  let db: Db;
  beforeAll(() => {
    db = createPrismaClient(url);
  });
  afterAll(async () => {
    await db.$disconnect();
  });

  it('prices by parent rates with the larger of plan and promo discount, enforces rules, keeps promo on extend', async () => {
    const seen: Record<string, unknown> = {};
    await expect(
      db.$transaction(
        async (tx) => {
          const property = await tx.property.findFirstOrThrow({
            where: { inventoryUnits: { some: { code: 'L1' } } },
            select: { id: true, name: true },
          });
          const repo = () => new PrismaReservationsRepository(tx, property.name);
          const service = new ReservationsService(
            { run: (fn) => fn(repo()), read: (fn) => fn(repo()) },
            new NoopAriPublisher(),
          );
          const base = await tx.ratePlan.findFirstOrThrow({
            where: { propertyId: property.id, code: 'L-BASE' },
          });
          const type = await tx.accommodationType.findFirstOrThrow({
            where: { propertyId: property.id, code: 'L-DOUBLE' },
          });
          const nightly = async (from: string, to: string) =>
            (
              await tx.dailyRate.findMany({
                where: {
                  ratePlanId: base.id,
                  accommodationTypeId: type.id,
                  occupancy: 1,
                  date: { gte: new Date(from), lt: new Date(to) },
                },
                orderBy: { date: 'asc' },
              })
            ).map((r) => r.price);
          const expected = (prices: bigint[], percent: number) =>
            prices.reduce((sum, p) => sum + (percent > 0 ? discountedMinor(p, percent) : p), 0n);

          await tx.ratePlan.create({
            data: {
              propertyId: property.id,
              code: 'L-EARLY10',
              name: 'Раннее бронирование −10%',
              currency: base.currency,
              parentRatePlanId: base.id,
              discountPercent: 10,
              minDaysBeforeArrival: 30,
            },
          });
          await tx.ratePlan.create({
            data: {
              propertyId: property.id,
              code: 'L-LATE-ONLY',
              name: 'Только за неделю',
              currency: base.currency,
              parentRatePlanId: base.id,
              discountPercent: 5,
              maxDaysBeforeArrival: 7,
            },
          });
          await tx.promoCode.create({
            data: { propertyId: property.id, code: 'BIG25', discountPercent: 25 },
          });
          await tx.promoCode.create({
            data: { propertyId: property.id, code: 'SMALL5', discountPercent: 5 },
          });
          await tx.promoCode.create({
            data: { propertyId: property.id, code: 'ONCE10', discountPercent: 10, maxUses: 1 },
          });

          // у категории мало ячеек, а продать можно не больше остатка (Q-107): каждая бронь — на своих датах
          let slot = 0;
          const stay = () => {
            slot += 1;
            return { from: day(200 + slot * 3), to: day(202 + slot * 3) };
          };
          const book = (ratePlanCode: string, promoCode?: string, dates = stay()) =>
            service.create({
              source: 'WALK_IN',
              arrivalDate: dates.from,
              departureDate: dates.to,
              guest: { firstName: 'Гость', lastName: 'Тест-D4' },
              ...(promoCode ? { promoCode } : {}),
              items: [{ accommodationTypeCode: 'L-DOUBLE', ratePlanCode, adults: 1, unitCode: null }],
            });
          /** Бронь по тарифу и промокоду: сумма брони и ожидаемая сумма по ценам родителя со скидкой `percent` */
          const priced = async (ratePlanCode: string, percent: number, promoCode?: string) => {
            const dates = stay();
            const card = await book(ratePlanCode, promoCode, dates);
            const stored = await tx.reservation.findFirstOrThrow({
              where: { propertyId: property.id, confirmationNumber: card.confirmationNumber },
              select: { totalAmount: true, promoCodeId: true },
            });
            return {
              ok: stored.totalAmount === expected(await nightly(dates.from, dates.to), percent),
              promoCodeId: stored.promoCodeId,
            };
          };

          // обычный тариф без промокода — цена родителя как есть
          seen['base'] = (await priced('L-BASE', 0)).ok;
          // производный: цены родителя со скидкой тарифа, 10 %
          seen['derived'] = (await priced('L-EARLY10', 10)).ok;
          // производный 10 % + промокод 25 % — одна большая (25), без суммирования
          const withBig = await priced('L-EARLY10', 25, 'big25');
          seen['bigger'] = withBig.ok;
          seen['promoStored'] = withBig.promoCodeId !== null;
          // производный 10 % + промокод 5 % — остаётся скидка тарифа
          seen['keepsPlan'] = (await priced('L-EARLY10', 10, 'SMALL5')).ok;
          // обычный тариф + промокод — скидка промокода
          seen['baseWithPromo'] = (await priced('L-BASE', 25, 'BIG25')).ok;

          // предел использований: вторая бронь по ONCE10 — отказ словами
          await book('L-BASE', 'ONCE10');
          seen['exhausted'] = await book('L-BASE', 'ONCE10').then(
            () => 'created',
            (e: unknown) => (e instanceof UnprocessableEntityException ? String(e.message) : String(e)),
          );
          // нет такого промокода и неверная запись
          seen['unknown'] = await book('L-BASE', 'NOPE99').then(
            () => 'created',
            (e: unknown) => (e instanceof UnprocessableEntityException ? String(e.message) : String(e)),
          );
          seen['malformed'] = await book('L-BASE', 'лето').then(
            () => 'created',
            (e: unknown) => (e instanceof UnprocessableEntityException ? String(e.message) : String(e)),
          );
          // окно продаж: «раннее бронирование за 30 дней» на заезд через 5 дней — отказ; «last minute» на заезд через 200 — отказ
          seen['tooLate'] = await book('L-EARLY10', undefined, { from: day(5), to: day(7) }).then(
            () => 'created',
            (e: unknown) => (e instanceof UnprocessableEntityException ? String(e.message) : String(e)),
          );
          seen['tooEarly'] = await book('L-LATE-ONLY').then(
            () => 'created',
            (e: unknown) => (e instanceof UnprocessableEntityException ? String(e.message) : String(e)),
          );

          // продление сохраняет скидку промокода: ночь считается по цене родителя с 25 %
          const extendDates = { from: day(300), to: day(302) };
          const withPromo = await book('L-BASE', 'BIG25', extendDates);
          const item = (
            await tx.reservationItem.findFirstOrThrow({
              where: { reservation: { confirmationNumber: withPromo.confirmationNumber } },
              select: { id: true },
            })
          ).id;
          const preview = (await service.preview(withPromo.confirmationNumber, item, {
            action: 'extend',
            nights: 1,
          })) as { differenceMinor: string };
          const oneNight = await nightly(day(302), day(303));
          seen['extend'] = preview.differenceMinor === expected(oneNight, 25).toString();
          throw new Rollback();
        },
        { timeout: 60_000 },
      ),
    ).rejects.toBeInstanceOf(Rollback);

    expect(seen['base']).toBe(true);
    expect(seen['derived']).toBe(true);
    expect(seen['bigger']).toBe(true);
    expect(seen['promoStored']).toBe(true);
    expect(seen['keepsPlan']).toBe(true);
    expect(seen['baseWithPromo']).toBe(true);
    expect(seen['exhausted']).toMatch(/исчерпан/);
    expect(seen['unknown']).toMatch(/не найден/);
    expect(seen['malformed']).toMatch(/неверно/);
    expect(seen['tooLate']).toMatch(/через 30 дн/);
    expect(seen['tooEarly']).toMatch(/через 7 дн/);
    expect(seen['extend']).toBe(true);
  });
});
