import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, createPropertyInChain, type Db } from '@pms/database';
import { isLocalDatabase } from '../tools/seed-local';
import { AuthorInterceptor } from '../../apps/api/src/auth/author.interceptor';
import { RequiresBusinessCapability } from '../../apps/api/src/auth/capability.decorator';
import { databaseTenant } from '../../apps/api/src/auth/request-context';
import { forgetPropertyRef } from '../../apps/api/src/database/property-ref';

let reads = 0;
@RequiresBusinessCapability('hospitality.reservations')
@Controller('mv1-test')
class BoundaryController {
  @Get()
  read() {
    reads += 1;
    return { ok: true };
  }
}

describe.skipIf(!process.env.DATABASE_URL)('MV1 HTTP + database + RLS boundary', () => {
  let db: Db;
  let app: INestApplication;
  let own: string;
  let foreign: string;
  let hotel: string;
  let beauty: string;
  let food: string;
  let alien: string;
  let archived: string;
  beforeAll(async () => {
    const url = process.env.DATABASE_URL!;
    if (!isLocalDatabase(url)) throw new Error('MV1 test requires localhost PostgreSQL');
    const appUrl = new URL(url);
    appUrl.username = 'wetop_app';
    appUrl.password = '';
    db = createPrismaClient(url, 'pms_test', {
      of: databaseTenant,
      appConnectionString: appUrl.toString(),
    });
    own = (await db.organization.create({ data: { name: `MV1 synthetic ${randomUUID()}` } })).id;
    foreign = (await db.organization.create({ data: { name: `MV1 foreign ${randomUUID()}` } })).id;
    const property = await createPropertyInChain(db, own, {
      name: 'MV1 synthetic hotel',
      timezone: 'Asia/Almaty',
      currency: 'KZT',
      checkInTime: '14:00',
      checkOutTime: '12:00',
    });
    hotel = (await db.location.findUniqueOrThrow({ where: { id: property.locationId } }))
      .businessId;
    beauty = (
      await db.business.create({
        data: { organizationId: own, name: 'MV1 beauty', vertical: 'BEAUTY' },
      })
    ).id;
    food = (
      await db.business.create({
        data: { organizationId: own, name: 'MV1 food', vertical: 'FOOD_SERVICE' },
      })
    ).id;
    alien = (
      await db.business.create({
        data: { organizationId: foreign, name: 'MV1 alien', vertical: 'HOSPITALITY' },
      })
    ).id;
    archived = (
      await db.business.create({
        data: {
          organizationId: own,
          name: 'MV1 archive',
          vertical: 'HOSPITALITY',
          status: 'ARCHIVED',
        },
      })
    ).id;
    const module = await Test.createTestingModule({ controllers: [BoundaryController] }).compile();
    app = module.createNestApplication();
    app.use((_req: unknown, _res: unknown, next: () => void) => {
      (_req as { user: unknown }).user = { id: randomUUID(), organizationId: own, role: 'OWNER' };
      next();
    });
    app.useGlobalInterceptors(new AuthorInterceptor({ db } as never));
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
    if (own && foreign) {
      await db.property.deleteMany({ where: { organizationId: { in: [own, foreign] } } });
      await db.location.deleteMany({
        where: { business: { organizationId: { in: [own, foreign] } } },
      });
      await db.business.deleteMany({ where: { organizationId: { in: [own, foreign] } } });
      await db.organization.deleteMany({ where: { id: { in: [own, foreign] } } });
    }
    forgetPropertyRef();
    await db?.$disconnect();
  });
  const get = (id?: string) => {
    const call = request(app.getHttpServer()).get('/mv1-test');
    return id ? call.set('X-Wetop-Scope', `business=${id}`) : call;
  };
  it('preserves the legacy organization-level Hospitality route', async () => {
    expect((await get()).status).toBe(200);
  });
  it('opens the selected Hospitality Business', async () => {
    expect((await get(hotel)).status).toBe(200);
  });
  it.each(['beauty', 'food', 'foreign', 'archived', 'invalid'])(
    'denies %s without entering the domain handler',
    async (kind) => {
      const id = { beauty, food, foreign: alien, archived, invalid: 'bad' }[kind];
      const before = reads;
      expect((await get(id)).status).toBe(403);
      expect(reads).toBe(before);
    },
  );
});
