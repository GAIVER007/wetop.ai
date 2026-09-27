import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { forgetPropertyRef, propertyIdRef } from '../../apps/api/src/database/property-ref';
import { organizationLocationRef, forgetLocationRef } from '../../apps/api/src/database/location-ref';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * Phase 2 (ADR-100 §17.1, DATA_MODEL v2.2 §17.6): backfill миграции 20260927000029 даёт каждому объекту
 * ровно одну Location копией полей точки бизнеса, и путь вошедшего к объекту идёт через неё
 * (v1 §D.4 шаг 2) с тем же ответом, что прежний путь по properties.organization_id.
 * На коде/базе без Phase 2 этот файл красный: таблицы locations нет.
 */
describe.skipIf(!url)('Phase 2: Location для каждого объекта, путь через Location (integration, DATABASE_URL required)', () => {
  let db: Db;
  beforeAll(() => {
    db = createPrismaClient(url);
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  it('каждый объект привязан к своей Location, поля скопированы, вертикаль HOSPITALITY', async () => {
    const properties = await db.property.findMany({
      select: {
        id: true,
        name: true,
        timezone: true,
        currency: true,
        organizationId: true,
        locationId: true,
        location: { select: { id: true, organizationId: true, vertical: true, name: true, timezone: true, currency: true } },
      },
    });
    expect(properties.length).toBeGreaterThan(0);
    for (const p of properties) {
      expect(p.locationId, `объект ${p.name} без location_id`).not.toBeNull();
      expect(p.location!.vertical).toBe('HOSPITALITY');
      expect(p.location!.organizationId).toBe(p.organizationId);
      expect(p.location!.name).toBe(p.name);
      expect(p.location!.timezone).toBe(p.timezone);
      expect(p.location!.currency).toBe(p.currency);
    }
    // 1:1: локаций с объектом ровно столько же, сколько объектов; лишних локаций backfill не создаёт
    const locations = await db.location.count();
    expect(locations).toBe(properties.length);
  });

  it('вошедший получает тот же объект через Location, что и прежним путём; резолвер Location его видит', async () => {
    forgetPropertyRef();
    forgetLocationRef();
    const property = await db.property.findFirstOrThrow({
      orderBy: { createdAt: 'asc' },
      select: { id: true, organizationId: true, locationId: true },
    });
    const viaRef = await withSignedInUser(
      { userId: '00000000-0000-4000-8000-000000000001', organizationId: property.organizationId },
      () => propertyIdRef(db, 'какое бы имя ни просил репозиторий'),
    );
    expect(viaRef).toBe(property.id);
    const loc = await organizationLocationRef(db, property.organizationId);
    expect(loc?.id).toBe(property.locationId);
    forgetPropertyRef();
    forgetLocationRef();
  });
});
