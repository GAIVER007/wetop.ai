import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { VerticalToolsService } from '../../apps/api/src/ai-seller/vertical-tools.service';
import { VerticalToolsController } from '../../apps/api/src/ai-seller/vertical-tools.controller';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { PrismaExtensionsRepository } from '../../apps/api/src/platform/extensions.repository';
import { ExtensionsService } from '../../apps/api/src/platform/extensions.service';
import { databaseTenant } from '../../apps/api/src/auth/request-context';
import { SessionGuard } from '../../apps/api/src/auth/auth.guard';
import { AuthService } from '../../apps/api/src/auth/auth.service';
const url = process.env.DATABASE_URL;
describe.skipIf(!url)('MV10 real API/DB and tenant role', () => {
  let db: Db, scoped: Db, app: INestApplication;
  const org = randomUUID(), user = randomUUID();
  const businesses: string[] = [], locations: string[] = [], agents: string[] = [];
  beforeAll(async () => {
    db = createPrismaClient(url, 'pms_test');
    const appUrl = new URL(url!); appUrl.username = 'wetop_app'; appUrl.password = '';
    scoped = createPrismaClient(url, 'pms_test', { of: databaseTenant, appConnectionString: appUrl.toString() });
    await db.organization.create({ data: { id: org, name: `MV10-${org}`, status: 'ACTIVE' } });
    await db.user.create({ data: { id: user, email: `mv10-${user}@example.invalid`, name: 'Вымышленный владелец' } });
    await db.organizationExtension.create({ data: { organizationId: org, extension: 'AI_SELLER', status: 'ACTIVE', updatedAt: new Date() } });
    for (const vertical of ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'] as const) {
      const b = await db.business.create({ data: { organizationId: org, name: vertical, vertical } }); businesses.push(b.id);
      const l = await db.location.create({ data: { businessId: b.id, name: 'Филиал', timezone: 'Asia/Almaty', currency: 'KZT' } }); locations.push(l.id);
      const a = await db.sellerAgent.create({ data: { organizationId: org, createdBy: user, locationId: l.id, name: 'Агент', lifecycle: 'active' } }); agents.push(a.id);
    }
    const s = await db.beautyService.create({ data: { businessId: businesses[1]!, name: 'Услуга', durationMinutes: 30, price: 10000n, currency: 'KZT' } });
    await db.locationService.create({ data: { serviceId: s.id, locationId: locations[1]!, enabled: true, priceOverride: 12000n, durationOverride: 45 } });
    await db.beautyService.create({ data: { businessId: businesses[1]!, name: 'Не включена', durationMinutes: 30, price: 999n, currency: 'KZT' } });
    await db.servicePeriod.create({ data: { locationId: locations[2]!, name: 'Ужин', weekday: 2, timeFrom: new Date('1970-01-01T18:00:00Z'), timeTo: new Date('1970-01-01T23:00:00Z'), defaultDurationMinutes: 90 } });
    const prisma = { db: scoped } as PrismaService;
    const extensions = new ExtensionsService(new PrismaExtensionsRepository(prisma));
    const m = await Test.createTestingModule({ controllers: [VerticalToolsController], providers: [
      VerticalToolsService, { provide: PrismaService, useValue: prisma }, { provide: ExtensionsService, useValue: extensions },
      { provide: AuthService, useValue: { whoami: async () => null } }, { provide: APP_GUARD, useClass: SessionGuard },
    ] }).compile();
    app = m.createNestApplication({ logger: false }); await app.init();
    vi.stubEnv('SELLER_QUOTE_KEY', 'synthetic-mv10-key'); vi.stubEnv('AUTH_REQUIRED', '1');
  });
  afterAll(async () => {
    if (app) await app.close();
    if (db) {
      await db.locationService.deleteMany({ where: { locationId: { in: locations } } });
      await db.beautyService.deleteMany({ where: { businessId: { in: businesses } } });
      await db.servicePeriod.deleteMany({ where: { locationId: { in: locations } } });
      await db.sellerAgent.deleteMany({ where: { organizationId: org } });
      await db.organizationExtension.deleteMany({ where: { organizationId: org } });
      await db.location.deleteMany({ where: { id: { in: locations } } });
      await db.business.deleteMany({ where: { organizationId: org } });
      await db.organization.deleteMany({ where: { id: org } });
      await db.user.deleteMany({ where: { id: user } });
      await db.$disconnect();
    }
    if (scoped) await scoped.$disconnect(); vi.unstubAllEnvs();
  });
  const get = (path: string, index: number) => request(app.getHttpServer()).get(`/bot/${path}`).query({ agent: agents[index] }).set('x-wetop-service-key', 'synthetic-mv10-key');
  it('server context and canonical tools for all three directions', async () => {
    for (const [i, vertical] of ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'].entries()) {
      const r = await get('agent-context', i).expect(200);
      expect(r.body).toMatchObject({ agentId: agents[i], organizationId: org, businessId: businesses[i], locationId: locations[i], vertical });
      expect(r.headers['cache-control']).toBe('no-store');
    }
  });
  it('Beauty HTTP equals stored effective price and excludes disabled catalog', async () => {
    const r = await get('beauty-services', 1).expect(200);
    expect(r.body.items).toEqual([{ name: 'Услуга', category: null, durationMinutes: 45, priceMinor: '12000', currency: 'KZT' }]);
  });
  it('Food HTTP equals stored local periods and has no booking/guest/money data', async () => {
    const r = await get('food-service-periods', 2).expect(200);
    expect(r.body.items).toEqual([{ name: 'Ужин', weekday: 2, timeFrom: '18:00', timeTo: '23:00', endsNextDay: false, defaultDurationMinutes: 90 }]);
  });
  it('foreign tool and forged override rejected', async () => {
    await get('beauty-services', 2).expect(403);
    await get('food-service-periods', 1).expect(403);
    await request(app.getHttpServer()).get('/bot/agent-context').query({ agent: agents[1], location: locations[2] }).set('x-wetop-service-key', 'synthetic-mv10-key').expect(400);
  });
  it('archive after earlier lookup and entitlement off immediately revoke', async () => {
    await get('agent-context', 1).expect(200);
    await db.location.update({ where: { id: locations[1]! }, data: { status: 'ARCHIVED' } });
    await get('beauty-services', 1).expect(404);
    await db.location.update({ where: { id: locations[1]! }, data: { status: 'ACTIVE' } });
    await db.organizationExtension.update({ where: { organizationId_extension: { organizationId: org, extension: 'AI_SELLER' } }, data: { status: 'OFF' } });
    await get('food-service-periods', 2).expect(404);
  });
});
