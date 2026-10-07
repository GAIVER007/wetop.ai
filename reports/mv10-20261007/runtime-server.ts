import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
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
if (!url || !['127.0.0.1', 'localhost'].includes(new URL(url).hostname) || !process.env.MV10_PYTHON) throw new Error('Own loopback DB and MV10_PYTHON required');
async function verify() {
  let db: Db, scoped: Db, app: INestApplication;
  const org = randomUUID(), user = randomUUID();
  const businesses: string[] = [], locations: string[] = [], agents: string[] = [];
  try {
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
    app = m.createNestApplication({ logger: false });
    process.env.SELLER_QUOTE_KEY = 'synthetic-mv10-key'; process.env.AUTH_REQUIRED = '1';
    await app.listen(0, '127.0.0.1');
    const result = await promisify(execFile)(process.env.MV10_PYTHON!, ['../../reports/mv10-20261007/runtime-client.py'], { cwd: 'apps/ai-seller', env: { ...process.env, PYTHONPATH: '.', MV10_RUNTIME_FIXTURE: JSON.stringify({ url: await app.getUrl(), organization: org, hotelAgent: agents[0], beautyAgent: agents[1], foodAgent: agents[2], foreignLocation: locations[0] }) } });
    console.log(result.stdout);
  } finally {
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
    if (scoped) await scoped.$disconnect();
  }
}
await verify();
