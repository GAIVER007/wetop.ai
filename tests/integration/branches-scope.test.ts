import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { expect, it } from 'vitest';
import { createPrismaClient } from '@pms/database';
import { HotelModule } from '../../apps/api/src/hotel/hotel.module';
import { RoleGuard } from '../../apps/api/src/auth/role.guard';
import { AuthorInterceptor } from '../../apps/api/src/auth/author.interceptor';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * Область доступа в выборе филиала (DATA_MODEL §31.1, STAFF2.3b S3) по настоящему HTTP: человек с назначением на один
 * филиал видит в `/branches` только его; без назначений видит все; владелец видит все, назначения у него не действуют.
 */
it('GET /branches отдаёт человеку с областью только его филиалы', async () => {
  if (!isLocalDatabase(process.env.DATABASE_URL ?? ''))
    throw new Error('Own local database required');
  const db = createPrismaClient(process.env.DATABASE_URL, 'pms_test');
  const org = randomUUID();
  const user = randomUUID();
  let app: INestApplication | undefined;
  let businessId: string | undefined;
  try {
    await db.organization.create({ data: { id: org, name: `Область-${org}`, status: 'ACTIVE' } });
    await db.user.create({
      data: {
        id: user,
        email: `scope-http-${user}@example.invalid`,
        name: 'Тестовый администратор',
      },
    });
    const business = await db.business.create({
      data: { organizationId: org, name: 'Синтетический Food', vertical: 'FOOD_SERVICE' },
    });
    businessId = business.id;
    const mk = (name: string) =>
      db.location.create({
        data: { businessId: business.id, name, timezone: 'Asia/Almaty', currency: 'KZT' },
      });
    const l1 = await mk('Ресторан 1');
    await mk('Ресторан 2');
    const prisma = { db } as unknown as PrismaService;
    const module = await Test.createTestingModule({ imports: [HotelModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = module.createNestApplication();
    let current: object = {};
    app.use((req: { user?: object }, _res: unknown, next: () => void) => {
      req.user = current;
      next();
    });
    app.useGlobalGuards(new RoleGuard(new Reflector()));
    app.useGlobalInterceptors(new AuthorInterceptor(prisma));
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    const names = async () =>
      (
        (await (await fetch(`${base}/branches`)).json()) as {
          items: Array<{ name: string }>;
        }
      ).items
        .map((i) => i.name)
        .sort();

    current = { id: user, organizationId: org, role: 'STAFF' };
    expect(await names()).toEqual(['Ресторан 1', 'Ресторан 2']);

    current = {
      id: user,
      organizationId: org,
      role: 'STAFF',
      scopes: [{ role: 'STAFF', businessId: business.id, locationId: l1.id }],
    };
    expect(await names()).toEqual(['Ресторан 1']);

    // владельцу назначения не мешают: он видит всё
    current = {
      id: user,
      organizationId: org,
      role: 'OWNER',
      scopes: [{ role: 'STAFF', businessId: business.id, locationId: l1.id }],
    };
    expect(await names()).toEqual(['Ресторан 1', 'Ресторан 2']);
  } finally {
    await app?.close();
    if (businessId) {
      await db.location.deleteMany({ where: { businessId } });
      await db.business.delete({ where: { id: businessId } });
    }
    await db.user.delete({ where: { id: user } }).catch(() => undefined);
    await db.organization.delete({ where: { id: org } }).catch(() => undefined);
    await db.$disconnect();
  }
});
