import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { describe, expect, it } from 'vitest';
import { createPrismaClient, createPropertyInChain } from '@pms/database';
import { todayAt } from '@pms/domain';
import { RatePlansService } from '../../apps/api/src/rates/rate-plans';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { forgetPropertyRef } from '../../apps/api/src/database/property-ref';
import { purgeAuditRows } from '../tools/audit-purge';
import { deleteOrganizationChain } from '../tools/property-owner';
config({ quiet: true });

const day = 86_400_000;
const shift = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * day).toISOString().slice(0, 10);

/**
 * «Тарифные планы» (SET4; решение владельца 29.09): правка правила отмены действует для всех броней тарифа, поэтому
 * экран называет, сколько броней она заденет, — разные брони по тарифу, ещё не заехавшие и не отменённые, с выездом
 * сегодня или позже. Проверка на живом PostgreSQL: SQL счёта и запись правила с журналом в одной транзакции.
 */
describe.skipIf(!process.env.DATABASE_URL)('rate plan cancellation rule', () => {
  it('counts reservations the rule can still affect and saves the rule with an audit row', async () => {
    const db = createPrismaClient(),
      marker = randomUUID();
    const org = await db.organization.create({ data: { name: `TEST set4 ${marker}` } });
    const user = await db.user.create({ data: { email: `set4-${marker}@example.invalid` } });
    const property = await createPropertyInChain(db, org.id, {
      name: `TEST set4 ${marker}`,
      timezone: 'Asia/Almaty',
      currency: 'KZT',
      checkInTime: '14:00',
      checkOutTime: '12:00',
    });
    const service = new RatePlansService({ db } as PrismaService);
    const today = todayAt('Asia/Almaty');
    try {
      const type = await db.accommodationType.create({
        data: {
          propertyId: property.id,
          code: `set4-${marker}`,
          name: 'Двухместный SET4',
          kind: 'PRIVATE_ROOM',
          capacityAdults: 2,
        },
      });
      const plan = await db.ratePlan.create({
        data: { propertyId: property.id, code: `rate-${marker}`, name: 'Базовый SET4', currency: 'KZT' },
      });
      const other = await db.ratePlan.create({
        data: { propertyId: property.id, code: `rate-other-${marker}`, name: 'Другой SET4', currency: 'KZT' },
      });
      await db.ratePlanAccommodationType.create({
        data: { ratePlanId: plan.id, accommodationTypeId: type.id },
      });

      type Status = 'TENTATIVE' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW';
      let n = 0;
      const book = async (from: number, to: number, statuses: Status[], ratePlanId = plan.id) => {
        n += 1;
        const arrival = new Date(`${shift(today, from)}T00:00:00Z`),
          departure = new Date(`${shift(today, to)}T00:00:00Z`);
        await db.reservation.create({
          data: {
            propertyId: property.id,
            confirmationNumber: `S4-${marker.slice(0, 8)}-${n}`,
            source: 'DESK',
            status: statuses[0]!,
            arrivalDate: arrival,
            departureDate: departure,
            adults: statuses.length,
            currency: 'KZT',
            totalAmount: 0n,
            items: {
              create: statuses.map((status) => ({
                accommodationTypeId: type.id,
                ratePlanId,
                arrivalDate: arrival,
                departureDate: departure,
                price: 0n,
                status,
              })),
            },
          },
        });
      };
      await book(3, 6, ['CONFIRMED', 'CONFIRMED']); // два проживания одной брони — одна бронь
      await book(1, 2, ['TENTATIVE']); // не подтверждена — отменить ещё можно
      await book(-1, 0, ['CONFIRMED']); // не заехал, выезд сегодня — незаезд ещё возможен
      await book(-1, 2, ['CHECKED_IN']); // уже живёт — штрафа за отмену не будет
      await book(4, 6, ['CANCELLED']); // отменена
      await book(-6, -3, ['CONFIRMED']); // выезд прошёл — не впереди
      await book(-9, -7, ['CHECKED_OUT']); // история
      await book(2, 4, ['CONFIRMED'], other.id); // другой тариф

      await withSignedInUser({ userId: user.id, organizationId: org.id, role: 'OWNER' }, async () => {
        const list = await service.list();
        expect(list.find((p) => p.code === plan.code)).toMatchObject({
          name: 'Базовый SET4',
          cancellationPenalty: 'FIRST_NIGHT',
          categories: ['Двухместный SET4'],
          upcomingReservations: 3,
        });
        expect(list.find((p) => p.code === other.code)).toMatchObject({
          categories: [],
          upcomingReservations: 1,
        });

        const saved = await service.updatePenalty(plan.code, { cancellationPenalty: 'NONE' });
        expect(saved).toMatchObject({ cancellationPenalty: 'NONE', upcomingReservations: 3 });
      });
      const stored = await db.ratePlan.findUniqueOrThrow({ where: { id: plan.id } });
      expect(stored.cancellationPenalty).toBe('NONE');
      const audit = await db.auditLog.findFirstOrThrow({
        where: { entityId: plan.id, action: 'rate_plan.cancellation_penalty.updated' },
      });
      expect(audit).toMatchObject({
        userId: user.id,
        entityType: 'RatePlan',
        before: { cancellationPenalty: 'FIRST_NIGHT' },
        after: { cancellationPenalty: 'NONE', upcomingReservations: 3 },
      });
    } finally {
      await purgeAuditRows(db, { userId: user.id });
      await db.reservationItem.deleteMany({ where: { reservation: { propertyId: property.id } } });
      await db.reservation.deleteMany({ where: { propertyId: property.id } });
      await db.ratePlanAccommodationType.deleteMany({
        where: { ratePlan: { propertyId: property.id } },
      });
      await db.ratePlan.deleteMany({ where: { propertyId: property.id } });
      await db.accommodationType.deleteMany({ where: { propertyId: property.id } });
      await db.property.delete({ where: { id: property.id } });
      await deleteOrganizationChain(db, [org.id]);
      await db.user.delete({ where: { id: user.id } });
      await db.organization.delete({ where: { id: org.id } });
      forgetPropertyRef();
      await db.$disconnect();
    }
  }, 120000);
});
