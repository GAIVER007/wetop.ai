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
 * Производные тарифы и промокоды через API (DATA_MODEL §20, ADR-124, срез D4): создание и правка производного,
 * создание, список и правка промокода; отказы словами, журнал, неизменность процента промокода.
 */
describe.skipIf(!process.env.DATABASE_URL)('derived rate plans and promo codes API', () => {
  it('creates and edits a derived plan and a promo code with validation and audit', async () => {
    const db = createPrismaClient(),
      marker = randomUUID();
    const org = await db.organization.create({ data: { name: `TEST d4api ${marker}` } });
    const user = await db.user.create({ data: { email: `d4api-${marker}@example.invalid` } });
    const property = await createPropertyInChain(db, org.id, {
      name: `TEST d4api ${marker}`,
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
      await db.ratePlan.create({
        data: { propertyId: property.id, code: 'base-d4', name: 'Базовый D4', currency: 'KZT' },
      });
      await withSignedInUser({ userId: user.id, organizationId: org.id }, async () => {
        const http = () => request(app.getHttpServer());

        // производный: создание, код даёт система, валюта и штраф — от родителя
        const created = (
          await http()
            .post('/rates/plans/derived')
            .send({ name: 'Раннее бронирование', parentCode: 'base-d4', discountPercent: 15, minDaysBeforeArrival: 30, minNights: 2 })
            .expect(201)
        ).body as { code: string; derived: { parentName: string; discountPercent: number; minDaysBeforeArrival: number | null } };
        expect(created.code).toBeTruthy();
        expect(created.derived).toMatchObject({ parentName: 'Базовый D4', discountPercent: 15, minDaysBeforeArrival: 30 });

        // отказы словами
        const bad = (body: Record<string, unknown>, status: number) =>
          http().post('/rates/plans/derived').send(body).expect(status);
        expect((await bad({ name: 'X', parentCode: 'base-d4', discountPercent: 0 }, 400)).body.message).toMatch(/1 до 90/);
        expect((await bad({ name: 'X', parentCode: 'base-d4', discountPercent: 10, minDaysBeforeArrival: 9, maxDaysBeforeArrival: 3 }, 400)).body.message).toMatch(/Окно/);
        await bad({ name: '', parentCode: 'base-d4', discountPercent: 10 }, 400);
        await bad({ name: 'X', parentCode: 'нет-такого', discountPercent: 10 }, 404);
        // родитель не может быть производным
        expect((await bad({ name: 'X', parentCode: created.code, discountPercent: 10 }, 400)).body.message).toMatch(/производн/);

        // правка правила, журнал «было / стало»
        const edited = (
          await http().patch(`/rates/plans/${created.code}/derived`).send({ discountPercent: 20, minNights: 3 }).expect(200)
        ).body as { derived: { discountPercent: number; minNights: number | null } };
        expect(edited.derived).toMatchObject({ discountPercent: 20, minNights: 3 });
        await http().patch('/rates/plans/base-d4/derived').send({ discountPercent: 20 }).expect(400); // обычный тариф

        // список показывает правило у производного и null у обычного
        const list = (await http().get('/rates/plans').expect(200)).body as Array<{ code: string; derived: unknown }>;
        expect(list.find((p) => p.code === 'base-d4')?.derived).toBeNull();
        expect(list.find((p) => p.code === created.code)?.derived).not.toBeNull();

        // промокод: код приводится к верхнему регистру, дубль — отказ, процент не меняется
        const promo = (
          await http().post('/rates/promo-codes').send({ code: ' summer10 ', discountPercent: 10, maxUses: 5 }).expect(201)
        ).body as { code: string; discountPercent: number; uses: number; active: boolean };
        expect(promo).toMatchObject({ code: 'SUMMER10', discountPercent: 10, uses: 0, active: true });
        await http().post('/rates/promo-codes').send({ code: 'SUMMER10', discountPercent: 5 }).expect(409);
        await http().post('/rates/promo-codes').send({ code: 'x', discountPercent: 5 }).expect(400);
        await http().post('/rates/promo-codes').send({ code: 'BIG', discountPercent: 91 }).expect(400);
        await http().post('/rates/promo-codes').send({ code: 'PERIOD', discountPercent: 5, stayFrom: '2026-12-10', stayTo: '2026-12-01' }).expect(400);
        await http().patch('/rates/promo-codes/SUMMER10').send({ discountPercent: 50 }).expect(400);
        const off = (await http().patch('/rates/promo-codes/SUMMER10').send({ active: false }).expect(200)).body as { active: boolean };
        expect(off.active).toBe(false);
        await http().patch('/rates/promo-codes/NOPE99').send({ active: false }).expect(404);
        const promos = (await http().get('/rates/promo-codes').expect(200)).body as Array<{ code: string }>;
        expect(promos.map((p) => p.code)).toEqual(['SUMMER10']);

        const actions = (
          await db.auditLog.findMany({ where: { userId: user.id }, select: { action: true } })
        ).map((a) => a.action);
        expect(actions).toEqual(
          expect.arrayContaining(['rate_plan.derived.created', 'rate_plan.derived.updated', 'promo_code.created', 'promo_code.updated']),
        );
      });
    } finally {
      await app.close();
      forgetPropertyRef();
      await purgeAuditRows(db, { userId: user.id });
      await db.promoCode.deleteMany({ where: { propertyId: property.id } });
      await db.ratePlan.deleteMany({ where: { propertyId: property.id, parentRatePlanId: { not: null } } });
      await db.ratePlan.deleteMany({ where: { propertyId: property.id } });
      await db.property.delete({ where: { id: property.id } });
      await deleteOrganizationChain(db, [org.id]);
      await db.user.delete({ where: { id: user.id } });
      await db.organization.delete({ where: { id: org.id } });
      await db.$disconnect();
    }
  });
});
