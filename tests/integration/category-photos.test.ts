import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID, createHash } from 'node:crypto';
import { config } from 'dotenv';
import { describe, it, expect } from 'vitest';
import { createPrismaClient, createPropertyInChain } from '@pms/database';
import { deleteOrganizationChain } from '../tools/property-owner';
import { InventoryModule } from '../../apps/api/src/inventory/inventory.module';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { forgetPropertyRef } from '../../apps/api/src/database/property-ref';
import { purgeAuditRows } from '../tools/audit-purge';
config({ quiet: true });

/** Фото категории (DATA_MODEL §30, ADR-153): порядок, чужая библиотека, вид, лимит и триггер базы. Вымышленные данные. */
describe.skipIf(!process.env.DATABASE_URL)('category photos', () => {
  it('stores order, refuses foreign or non-image assets and over ten, trigger guards raw SQL', async () => {
    const db = createPrismaClient(),
      marker = randomUUID();
    const org = await db.organization.create({ data: { name: `TEST photos ${marker}` } });
    const other = await db.organization.create({ data: { name: `TEST photos other ${marker}` } });
    const user = await db.user.create({ data: { email: `photos-${marker}@example.invalid` } });
    const mk = (organizationId: string) =>
      createPropertyInChain(db, organizationId, {
        name: `TEST photos ${randomUUID()}`,
        timezone: 'Asia/Almaty',
        currency: 'KZT',
        checkInTime: '14:00',
        checkOutTime: '12:00',
      });
    const property = await mk(org.id);
    const foreign = await mk(other.id);
    const asset = async (locationId: string, kind: 'IMAGE' | 'LOGO' = 'IMAGE') => {
      const id = randomUUID();
      const sha256 = createHash('sha256').update(id).digest('hex');
      return db.siteAsset.create({
        data: {
          id,
          locationId,
          kind,
          status: 'READY',
          source: 'UPLOAD',
          mimeType: 'image/webp',
          storageRef: `site-assets/${locationId}/${id}/${sha256}.webp`,
          byteSize: 1000,
          width: 800,
          height: 600,
          sha256,
        },
      });
    };
    const loc = async (propertyId: string) =>
      (await db.property.findUniqueOrThrow({ where: { id: propertyId }, select: { locationId: true } }))
        .locationId!;
    const module = await Test.createTestingModule({ imports: [InventoryModule] })
      .overrideProvider(PrismaService)
      .useValue({ db } as PrismaService)
      .compile();
    const app = module.createNestApplication();
    app.use((_req: unknown, _res: unknown, next: () => void) => {
      void withSignedInUser({ userId: user.id, organizationId: org.id }, async () => next());
    });
    await app.init();
    const assets: string[] = [];
    try {
      await withSignedInUser({ userId: user.id, organizationId: org.id }, async () => {
        const created = await request(app.getHttpServer())
          .post('/inventory/categories')
          .send({ name: 'Тестовый номер', kind: 'PRIVATE_ROOM', capacityAdults: 2, newRatePlanName: 'Тариф' })
          .expect(201);
        const code = (created.body as { code: string }).code;
        const a = await asset(await loc(property.id));
        const b = await asset(await loc(property.id));
        const logo = await asset(await loc(property.id), 'LOGO');
        const alien = await asset(await loc(foreign.id));
        assets.push(a.id, b.id, logo.id, alien.id);
        const put = (ids: string[]) =>
          request(app.getHttpServer()).put(`/inventory/categories/${code}/photos`).send({ assetIds: ids });
        await put([b.id, a.id]).expect(200);
        const listed = await request(app.getHttpServer()).get('/inventory/photos').expect(200);
        expect(listed.body[code].map((p: { assetId: string }) => p.assetId)).toEqual([b.id, a.id]);
        // замена целиком: один элемент, порядок с нуля
        await put([a.id]).expect(200);
        expect(
          (await db.accommodationTypePhoto.findMany({ orderBy: { position: 'asc' }, where: { siteAssetId: { in: assets } } })).map(
            (r) => [r.siteAssetId, r.position],
          ),
        ).toEqual([[a.id, 0]]);
        // чужая библиотека, логотип, повтор и больше десяти отклоняются, прежний выбор не теряется
        await put([alien.id]).expect(400);
        await put([logo.id]).expect(400);
        await put([a.id, a.id]).expect(400);
        await put(Array.from({ length: 11 }, () => randomUUID())).expect(400);
        await request(app.getHttpServer()).put('/inventory/categories/нет-такой/photos').send({ assetIds: [] }).expect(404);
        expect(Object.keys((await request(app.getHttpServer()).get('/inventory/photos')).body)).toEqual([code]);
        // удалённое изображение читатель не показывает
        await db.siteAsset.update({ where: { id: a.id }, data: { status: 'DELETED', deletedAt: new Date() } });
        expect((await request(app.getHttpServer()).get('/inventory/photos')).body).toEqual({});
        // база сама не пускает чужой Location и не-IMAGE мимо API
        const type = await db.accommodationType.findFirstOrThrow({ where: { propertyId: property.id, code } });
        await expect(
          db.accommodationTypePhoto.create({ data: { accommodationTypeId: type.id, siteAssetId: alien.id, position: 5 } }),
        ).rejects.toThrow(/не из библиотеки филиала/);
        await expect(
          db.accommodationTypePhoto.create({ data: { accommodationTypeId: type.id, siteAssetId: logo.id, position: 6 } }),
        ).rejects.toThrow(/только вида IMAGE/);
        await put([]).expect(200);
      });
    } finally {
      await purgeAuditRows(db, { userId: user.id });
      await db.accommodationTypePhoto.deleteMany({ where: { accommodationType: { propertyId: property.id } } });
      await db.siteAsset.deleteMany({ where: { id: { in: assets } } });
      for (const p of [property, foreign]) {
        await db.ratePlanAccommodationType.deleteMany({ where: { accommodationType: { propertyId: p.id } } });
        await db.ratePlan.deleteMany({ where: { propertyId: p.id } });
        await db.accommodationType.deleteMany({ where: { propertyId: p.id } });
        await db.property.delete({ where: { id: p.id } });
      }
      await deleteOrganizationChain(db, [org.id, other.id]);
      await db.user.delete({ where: { id: user.id } });
      await db.organization.deleteMany({ where: { id: { in: [org.id, other.id] } } });
      forgetPropertyRef();
      await app.close();
      await db.$disconnect();
    }
  }, 120000);
});
