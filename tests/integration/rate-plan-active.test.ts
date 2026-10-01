import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { describe, expect, it } from 'vitest';
import { createPrismaClient, createPropertyInChain } from '@pms/database';
import { RatesModule } from '../../apps/api/src/rates/rates.module';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { forgetPropertyRef } from '../../apps/api/src/database/property-ref';
import { purgeAuditRows } from '../tools/audit-purge';
import { deleteOrganizationChain } from '../tools/property-owner';
config({ quiet: true });

/**
 * Выключить и включить тариф через API на настоящей PostgreSQL (ТЗ QA 01.10.2026, WET-04, ADR-134): список считает,
 * что держит тариф (действующие производные, брони впереди), запросом Prisma с отбором по связям; выключение с
 * причинами отказывает, без них пишет `active=false` и журнал; включение обратно без условий.
 */
describe.skipIf(!process.env.DATABASE_URL)('rate plan on/off API', () => {
  it('lists blockers, refuses to switch off a held plan, switches a free plan off and on with audit', async () => {
    const db = createPrismaClient(),
      marker = randomUUID();
    const org = await db.organization.create({ data: { name: `TEST wet04 ${marker}` } });
    const user = await db.user.create({ data: { email: `wet04-${marker}@example.invalid` } });
    const property = await createPropertyInChain(db, org.id, {
      name: `TEST wet04 ${marker}`,
      timezone: 'Asia/Almaty',
      currency: 'KZT',
      checkInTime: '14:00',
      checkOutTime: '12:00',
    });
    const module = await Test.createTestingModule({ imports: [RatesModule] })
      .overrideProvider(PrismaService)
      .useValue({ db } as PrismaService)
      .compile();
    const app = module.createNestApplication();
    app.use((_req: unknown, _res: unknown, next: () => void) => {
      void withSignedInUser({ userId: user.id, organizationId: org.id }, async () => next());
    });
    await app.init();
    try {
      const type = await db.accommodationType.create({
        data: { propertyId: property.id, code: 'wet04-room', name: 'Номер WET-04', kind: 'PRIVATE_ROOM', capacityAdults: 2 },
      });
      const base = await db.ratePlan.create({
        data: { propertyId: property.id, code: 'base-wet04', name: 'Базовый WET-04', currency: 'KZT' },
      });
      await db.ratePlan.create({
        data: { propertyId: property.id, code: 'spare-wet04', name: 'Запасной WET-04', currency: 'KZT' },
      });
      // бронь впереди по базовому тарифу держит его
      const arrival = new Date(Date.now() + 30 * 86_400_000),
        departure = new Date(Date.now() + 32 * 86_400_000);
      await db.reservation.create({
        data: {
          propertyId: property.id,
          confirmationNumber: `WET04-${marker.slice(0, 8)}`,
          source: 'DESK',
          status: 'CONFIRMED',
          arrivalDate: arrival,
          departureDate: departure,
          adults: 1,
          currency: 'KZT',
          totalAmount: 0n,
          items: {
            create: [{ accommodationTypeId: type.id, ratePlanId: base.id, arrivalDate: arrival, departureDate: departure, price: 0n, status: 'CONFIRMED' }],
          },
        },
      });
      await withSignedInUser({ userId: user.id, organizationId: org.id }, async () => {
        const http = () => request(app.getHttpServer());
        type Row = { code: string; active: boolean; offBlockers: string[]; upcomingReservations: number };
        const plans = async () => (await http().get('/rates/plans').expect(200)).body as Row[];
        const row = (list: Row[], code: string) => list.find((p) => p.code === code)!;

        // производный от базового: держит родителя, пока действует
        const derived = (
          await http().post('/rates/plans/derived').send({ name: 'Скидка WET-04', parentCode: 'base-wet04', discountPercent: 10 }).expect(201)
        ).body as { code: string };

        let list = await plans();
        expect(row(list, 'base-wet04')).toMatchObject({ active: true, upcomingReservations: 1 });
        expect(row(list, 'base-wet04').offBlockers).toEqual([
          'Действующих производных тарифов: 1. Сначала выключите их.',
          'Броней впереди по тарифу: 1. Тариф выключается, когда по нему не остаётся будущих броней.',
        ]);
        expect(row(list, 'spare-wet04').offBlockers).toEqual([]);
        expect(row(list, derived.code).offBlockers).toEqual([]);

        // держат: 409 со всеми причинами, тариф остаётся действующим
        const refused = await http().patch('/rates/plans/base-wet04').send({ active: false }).expect(409);
        expect(refused.body.message).toContain('Действующих производных тарифов: 1.');
        expect(refused.body.message).toContain('Броней впереди по тарифу: 1.');
        expect((await db.ratePlan.findUniqueOrThrow({ where: { id: base.id } })).active).toBe(true);

        // производный выключается: родителя держит уже только бронь
        const offDerived = (await http().patch(`/rates/plans/${derived.code}`).send({ active: false }).expect(200)).body as Row;
        expect(offDerived.active).toBe(false);
        list = await plans();
        expect(row(list, 'base-wet04').offBlockers).toEqual([
          'Броней впереди по тарифу: 1. Тариф выключается, когда по нему не остаётся будущих броней.',
        ]);
        // от выключенного родителя производный не создаётся
        await http().patch(`/rates/plans/spare-wet04`).send({ active: false }).expect(200);
        expect((await http().post('/rates/plans/derived').send({ name: 'X', parentCode: 'spare-wet04', discountPercent: 5 }).expect(400)).body.message).toMatch(/выключен/);

        // свободный тариф: выключен и включён обратно, оба раза с журналом; то же значение без записи
        const on = (await http().patch('/rates/plans/spare-wet04').send({ active: true }).expect(200)).body as Row;
        expect(on.active).toBe(true);
        await http().patch('/rates/plans/spare-wet04').send({ active: true }).expect(200);
        await http().patch('/rates/plans/spare-wet04').send({ active: true, cancellationPenalty: 'NONE' }).expect(400);

        const audit = await db.auditLog.findMany({
          where: { userId: user.id, action: 'rate_plan.active.updated' },
          orderBy: { createdAt: 'asc' },
          select: { entityId: true, before: true, after: true },
        });
        expect(audit).toHaveLength(3);
        expect(audit.map((a) => a.after)).toEqual([
          { active: false, upcomingReservations: 0 },
          { active: false, upcomingReservations: 0 },
          { active: true, upcomingReservations: 0 },
        ]);
      });
    } finally {
      await app.close();
      forgetPropertyRef();
      await purgeAuditRows(db, { userId: user.id });
      await db.reservationItem.deleteMany({ where: { reservation: { propertyId: property.id } } });
      await db.reservation.deleteMany({ where: { propertyId: property.id } });
      await db.ratePlan.deleteMany({ where: { propertyId: property.id, parentRatePlanId: { not: null } } });
      await db.ratePlan.deleteMany({ where: { propertyId: property.id } });
      await db.accommodationType.deleteMany({ where: { propertyId: property.id } });
      await db.property.delete({ where: { id: property.id } });
      await deleteOrganizationChain(db, [org.id]);
      await db.user.delete({ where: { id: user.id } });
      await db.organization.delete({ where: { id: org.id } });
      await db.$disconnect();
    }
  });
});
