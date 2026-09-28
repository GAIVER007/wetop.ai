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
 * Platform P1 (ADR-104, DATA_MODEL §18; Q-199 — вариант Б): backfill миграции 20260927000030 строит
 * связную цепочку Organization → Business → Location → Property (для организации с объектами — один
 * Business HOSPITALITY имени организации, по Location на объект, properties.location_id проставлен),
 * reporting_currency берётся из фактической валюты объектов, где она однозначна, и путь вошедшего
 * к объекту идёт этой цепочкой с тем же ответом, что прежний путь по properties.organization_id.
 * На коде/базе без Platform P1 этот файл красный: таблиц businesses/locations нет.
 */
describe.skipIf(!url)('Platform P1: цепочка Organization → Business → Location → Property (integration, DATABASE_URL required)', () => {
  let db: Db;
  beforeAll(() => {
    db = createPrismaClient(url);
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  it('каждый объект привязан к Location своего Business своей организации; поля скопированы; вертикаль — HOSPITALITY на Business', async () => {
    const properties = await db.property.findMany({
      select: {
        id: true,
        name: true,
        timezone: true,
        currency: true,
        organizationId: true,
        locationId: true,
        location: {
          select: {
            id: true,
            name: true,
            timezone: true,
            currency: true,
            status: true,
            business: { select: { id: true, organizationId: true, vertical: true, name: true, status: true } },
          },
        },
      },
    });
    expect(properties.length).toBeGreaterThan(0);
    for (const p of properties) {
      expect(p.locationId, `объект ${p.name} без location_id`).not.toBeNull();
      const loc = p.location!;
      expect(loc.name).toBe(p.name);
      expect(loc.timezone).toBe(p.timezone);
      expect(loc.currency).toBe(p.currency);
      expect(loc.status).toBe('ACTIVE');
      expect(loc.business.vertical).toBe('HOSPITALITY');
      expect(loc.business.status).toBe('ACTIVE');
      // связность: Business принадлежит организации объекта
      expect(loc.business.organizationId).toBe(p.organizationId);
    }
    // 1:1: Location ровно столько же, сколько объектов; Business — один на организацию с объектами
    expect(await db.location.count()).toBe(properties.length);
    const orgs = new Set(properties.map((p) => p.organizationId));
    expect(await db.business.count()).toBe(orgs.size);
  });

  it('reporting_currency организации совпадает с однозначной фактической валютой её объектов', async () => {
    const orgs = await db.organization.findMany({
      where: { properties: { some: {} } },
      select: { id: true, reportingCurrency: true, properties: { select: { currency: true } } },
    });
    expect(orgs.length).toBeGreaterThan(0);
    for (const o of orgs) {
      const currencies = new Set(o.properties.map((p) => p.currency));
      if (currencies.size === 1) expect(o.reportingCurrency).toBe([...currencies][0]);
    }
  });

  it('вошедший получает тот же объект по цепочке, что и прежним путём; резолвер филиала его видит', async () => {
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
    expect(loc?.vertical).toBe('HOSPITALITY');
    forgetPropertyRef();
    forgetLocationRef();
  });
});
