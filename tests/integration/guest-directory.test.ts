import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db, type DbTx } from '@pms/database';
import { LUXX_APARTS_PROPERTY, shiftDate } from '@pms/domain';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { forgetPropertyRef, propertyToday } from '../../apps/api/src/database/property-ref';
import {
  PrismaGuestsRepository,
  type GuestDirectoryQuery,
  type GuestDirectoryResult,
} from '../../apps/api/src/guests/guests.repository';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;
class Rollback extends Error {}

/**
 * «Гости v2», G7 (ТЗ §28, §30, §31): отборы и порядок справочника считаются в SQL по тем же фактам, что
 * колонки таблицы (`summarizeGuestStays`). Своя организация с вымышленными гостями — только её гости
 * в выдаче; всё откатывается.
 */
describe.skipIf(!url)(
  'справочник гостей: отборы визита, число визитов, порядок (integration)',
  () => {
    let db: Db;
    beforeAll(() => {
      db = createPrismaClient(url);
    });
    afterAll(async () => {
      await db?.$disconnect();
    });

    it('раздел NONE, последний визит, число визитов, сортировки и числа чипов с отборами', async () => {
      const seen: Record<string, GuestDirectoryResult> = {};
      let today = '';
      await expect(
        db.$transaction(
          async (tx) => {
            forgetPropertyRef();
            // «сегодня» — тот же, что берёт выборка: по поясу объекта стенда
            today = await propertyToday(tx as never, LUXX_APARTS_PROPERTY.name);
            const org = await tx.organization.create({
              data: { name: 'Integration G7' },
              select: { id: true },
            });
            const property = await tx.property.create({
              data: {
                organizationId: org.id,
                name: 'Объект G7 (integration)',
                timezone: 'Asia/Almaty',
                currency: 'KZT',
                checkInTime: '14:00',
                checkOutTime: '12:00',
              },
              select: { id: true },
            });
            const type = await tx.accommodationType.create({
              data: {
                propertyId: property.id,
                code: 'G7-ROOM',
                name: 'Номер G7',
                kind: 'PRIVATE_ROOM',
                capacityAdults: 2,
              },
              select: { id: true },
            });
            const guest = (lastName: string) =>
              tx.guest.create({
                data: { organizationId: org.id, firstName: 'Фикстура', lastName },
                select: { id: true },
              });
            const stay = async (
              tx2: DbTx,
              guestId: string,
              status: 'CHECKED_IN' | 'CHECKED_OUT' | 'CONFIRMED' | 'CANCELLED',
              from: number,
              to: number,
            ) => {
              const arrivalDate = new Date(`${shiftDate(today, from)}T00:00:00Z`);
              const departureDate = new Date(`${shiftDate(today, to)}T00:00:00Z`);
              const r = await tx2.reservation.create({
                data: {
                  propertyId: property.id,
                  confirmationNumber: `G7-${randomUUID().slice(0, 8)}`,
                  source: 'DESK',
                  status,
                  arrivalDate,
                  departureDate,
                  adults: 1,
                  currency: 'KZT',
                  totalAmount: 0n,
                  primaryGuestId: guestId,
                },
                select: { id: true },
              });
              const item = await tx2.reservationItem.create({
                data: {
                  reservationId: r.id,
                  accommodationTypeId: type.id,
                  arrivalDate,
                  departureDate,
                  price: 0n,
                  status,
                },
                select: { id: true },
              });
              await tx2.stayGuest.create({
                data: { reservationItemId: item.id, guestId, isPrimary: true },
              });
            };
            // А — один визит, выехал 3 дня назад: «Недавние», последний визит в 7 днях
            const a = await guest('Алфавитов');
            await stay(tx, a.id, 'CHECKED_OUT', -5, -3);
            // Б — три визита, последний выезд 20 дней назад, плюс будущая бронь: «Ожидаются»
            const b = await guest('Буквин');
            await stay(tx, b.id, 'CHECKED_OUT', -60, -58);
            await stay(tx, b.id, 'CHECKED_OUT', -40, -38);
            await stay(tx, b.id, 'CHECKED_OUT', -22, -20);
            await stay(tx, b.id, 'CONFIRMED', 10, 12);
            // В — живёт сейчас, до этого визитов не было
            const v = await guest('Ведомостев');
            await stay(tx, v.id, 'CHECKED_IN', -1, 2);
            // Г — выехал 60 дней назад и больше не бронировал: «Без активного проживания»
            const g = await guest('Глаголев');
            await stay(tx, g.id, 'CHECKED_OUT', -62, -60);
            // Д — только отменённая бронь: визитов 0, тоже «Без активного проживания»
            const d = await guest('Добров');
            await stay(tx, d.id, 'CANCELLED', 3, 5);

            const guests = new PrismaGuestsRepository({ db: tx } as unknown as PrismaService);
            const run = (over: Partial<GuestDirectoryQuery>) =>
              withSignedInUser({ userId: randomUUID(), organizationId: org.id }, () =>
                guests.directory({ state: 'ALL', q: '', page: 1, pageSize: 25, ...over }),
              );
            seen['all'] = await run({});
            seen['none'] = await run({ state: 'NONE' });
            seen['last7'] = await run({ lastVisit: { days: 7 } });
            seen['last30'] = await run({ lastVisit: { days: 30 } });
            seen['period'] = await run({
              lastVisit: { from: shiftDate(today, -61), to: shiftDate(today, -59) },
            });
            seen['visits1'] = await run({ visits: '1' });
            seen['visits25'] = await run({ visits: '2-5' });
            seen['visits6'] = await run({ visits: '6+' });
            seen['next'] = await run({ sort: 'next' });
            seen['last'] = await run({ sort: 'last' });
            seen['byVisits'] = await run({ sort: 'visits' });
            seen['page2'] = await run({ pageSize: 2, page: 2 });
            seen['search'] = await run({ q: 'букв' });
            throw new Rollback();
          },
          { timeout: 120_000, maxWait: 30_000 },
        ),
      ).rejects.toBeInstanceOf(Rollback);
      forgetPropertyRef();

      const names = (k: string) => seen[k]!.rows.map((r) => r.lastName);
      // по имени по умолчанию; только гости своей организации
      expect(names('all')).toEqual(['Алфавитов', 'Буквин', 'Ведомостев', 'Глаголев', 'Добров']);
      expect(seen['all']!.counts).toEqual({ ALL: 5, INHOUSE: 1, EXPECTED: 1, RECENT: 1, NONE: 2 });
      expect(names('none')).toEqual(['Глаголев', 'Добров']);
      expect(seen['none']!.total).toBe(2);
      // последний визит — дата выезда последнего состоявшегося визита
      expect(names('last7')).toEqual(['Алфавитов']);
      expect(names('last30')).toEqual(['Алфавитов', 'Буквин']);
      expect(names('period')).toEqual(['Глаголев']);
      // числа чипов — с отборами, но без раздела
      expect(seen['last30']!.counts).toEqual({
        ALL: 2,
        INHOUSE: 0,
        EXPECTED: 1,
        RECENT: 1,
        NONE: 0,
      });
      // визиты — состоявшиеся проживания; отменённая бронь визитом не считается
      expect(names('visits1')).toEqual(['Алфавитов', 'Ведомостев', 'Глаголев']);
      expect(names('visits25')).toEqual(['Буквин']);
      expect(names('visits6')).toEqual([]);
      // порядок: ближайший заезд, у кого его нет — в конце по имени
      expect(names('next')).toEqual(['Буквин', 'Алфавитов', 'Ведомостев', 'Глаголев', 'Добров']);
      expect(names('last')).toEqual(['Алфавитов', 'Буквин', 'Глаголев', 'Ведомостев', 'Добров']);
      expect(names('byVisits')).toEqual([
        'Буквин',
        'Алфавитов',
        'Ведомостев',
        'Глаголев',
        'Добров',
      ]);
      // строки страницы — полные, как раньше: состояние и визиты вычислены
      expect(names('page2')).toEqual(['Ведомостев', 'Глаголев']);
      expect(seen['page2']!.total).toBe(5);
      expect(seen['all']!.rows.find((r) => r.lastName === 'Буквин')).toMatchObject({
        state: 'EXPECTED',
        staysCount: 3,
      });
      expect(names('search')).toEqual(['Буквин']);
    });
  },
);
