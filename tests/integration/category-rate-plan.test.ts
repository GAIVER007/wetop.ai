import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { describe, it, expect } from 'vitest';
import { createPrismaClient } from '@pms/database';
import { InventoryModule } from '../../apps/api/src/inventory/inventory.module';
import { InventoryEditor } from '../../apps/api/src/inventory/inventory-editor';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { forgetPropertyRef } from '../../apps/api/src/database/property-ref';
import { purgeAuditRows } from '../tools/audit-purge';
config({ quiet: true });

/**
 * ADR-118 («Категории v2» C3): категория создаётся без тарифа только явным «настроить позже», тариф привязывается
 * потом — существующий или новый с названием; повтор той же пары не плодит связь; чужая организация не привязывает.
 */
describe.skipIf(!process.env.DATABASE_URL)('category without a rate plan, rate plan linked later', () => {
  it('requires an explicit choice, creates without a link on «later», links existing and new plans once', async () => {
    const db = createPrismaClient(),
      marker = randomUUID();
    const org = await db.organization.create({ data: { name: `TEST c3 ${marker}` } });
    const user = await db.user.create({ data: { email: `c3-${marker}@example.invalid` } });
    const property = await db.property.create({
      data: {
        organizationId: org.id,
        name: `TEST c3 ${marker}`,
        timezone: 'Asia/Almaty',
        currency: 'KZT',
        checkInTime: '14:00',
        checkOutTime: '12:00',
      },
    });
    const provider = { db } as PrismaService;
    const module = await Test.createTestingModule({ imports: [InventoryModule] })
      .overrideProvider(PrismaService)
      .useValue(provider)
      .compile();
    const app = module.createNestApplication();
    app.use((_req: unknown, _res: unknown, next: () => void) => {
      void withSignedInUser({ userId: user.id, organizationId: org.id }, async () => next());
    });
    await app.init();
    const editor = app.get(InventoryEditor);
    const links = (categoryCode?: string) =>
      db.ratePlanAccommodationType.count({
        where: {
          accommodationType: { propertyId: property.id, ...(categoryCode ? { code: categoryCode } : {}) },
        },
      });
    try {
      await withSignedInUser({ userId: user.id, organizationId: org.id }, async () => {
        const http = () => request(app.getHttpServer());
        // без выбора тарифа категория молча не создаётся
        await http()
          .post('/inventory/categories')
          .send({ name: 'Без выбора', kind: 'PRIVATE_ROOM', capacityAdults: 2 })
          .expect(400)
          .expect((res) => expect(res.body.message).toMatch(/Настроить позже/));

        // «настроить позже» — категория есть, связи нет, тариф не создан
        const later = await http()
          .post('/inventory/categories')
          .send({ name: 'Двухместный C3', kind: 'PRIVATE_ROOM', capacityAdults: 2, ratePlanLater: true })
          .expect(201);
        const room = (later.body as { code: string }).code;
        expect(await links(room)).toBe(0);
        expect(await db.ratePlan.count({ where: { propertyId: property.id } })).toBe(0);
        await http()
          .get('/inventory/categories')
          .expect(200)
          .expect((res) => {
            const row = (res.body as { code: string; ratePlans: number }[]).find((c) => c.code === room);
            expect(row?.ratePlans).toBe(0);
          });

        // «Настроить тариф» — новый тариф с названием, связь одна
        await http()
          .post(`/inventory/categories/${room}/rate-plan`)
          .send({ newRatePlanName: 'Тестовый тариф C3' })
          .expect(201);
        expect(await links(room)).toBe(1);
        const plan = await db.ratePlan.findFirstOrThrow({
          where: { propertyId: property.id, name: 'Тестовый тариф C3' },
        });

        // вторая категория — койки, тариф позже, затем существующий тариф; повтор — без дубля и без записи в журнал
        const bed = (
          (
            await http()
              .post('/inventory/categories')
              .send({ name: 'Койки C3', kind: 'DORM_BED', capacityAdults: 1, ratePlanLater: true })
              .expect(201)
          ).body as { code: string }
        ).code;
        await http()
          .post(`/inventory/categories/${bed}/rate-plan`)
          .send({ ratePlanCode: plan.code })
          .expect(201)
          .expect((res) => expect(res.body).toMatchObject({ linked: true }));
        await http()
          .post(`/inventory/categories/${bed}/rate-plan`)
          .send({ ratePlanCode: plan.code })
          .expect(201)
          .expect((res) => expect(res.body).toMatchObject({ linked: false }));
        expect(await links(bed)).toBe(1);
        await http()
          .get('/inventory/categories')
          .expect(200)
          .expect((res) => {
            const row = (res.body as { code: string; ratePlanNames: string[] }[]).find((c) => c.code === bed);
            expect(row?.ratePlanNames).toEqual(['Тестовый тариф C3']);
          });

        // неизвестная категория и неизвестный тариф — 404; без выбора тарифа — 400
        await http().post('/inventory/categories/no-such/rate-plan').send({ ratePlanCode: plan.code }).expect(404);
        await http().post(`/inventory/categories/${bed}/rate-plan`).send({ ratePlanCode: 'no-such' }).expect(404);
        await http().post(`/inventory/categories/${bed}/rate-plan`).send({}).expect(400);

        // чужая организация не привязывает тариф к этой категории
        await expect(
          withSignedInUser({ userId: user.id, organizationId: randomUUID() }, () =>
            editor.linkRatePlan(room, { ratePlanCode: plan.code }),
          ),
        ).rejects.toThrow();

        expect(
          await db.auditLog.count({ where: { userId: user.id, action: 'inventory.category.rate_plan_linked' } }),
        ).toBe(2);
      });
    } finally {
      await purgeAuditRows(db, { userId: user.id });
      await db.ratePlanAccommodationType.deleteMany({
        where: { accommodationType: { propertyId: property.id } },
      });
      await db.ratePlan.deleteMany({ where: { propertyId: property.id } });
      await db.accommodationType.deleteMany({ where: { propertyId: property.id } });
      await db.property.delete({ where: { id: property.id } });
      await db.user.delete({ where: { id: user.id } });
      await db.organization.delete({ where: { id: org.id } });
      forgetPropertyRef();
      await app.close();
      await db.$disconnect();
    }
  }, 120000);
});
