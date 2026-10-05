/** Local synthetic identity; real Food and Beauty HTTP guards/controllers/services/database. */
import 'reflect-metadata';
import '../../apps/api/src/hotel/hotel.module';
import { randomUUID } from 'node:crypto';
import { Controller, Get, Post, Body } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { createPrismaClient } from '@pms/database';
import type { MembershipRole } from '@pms/domain';
import { FoodModule } from '../../apps/api/src/food-service/food.module';
import { BeautyModule } from '../../apps/api/src/beauty/beauty.module';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { AuthorInterceptor } from '../../apps/api/src/auth/author.interceptor';
import { RoleGuard } from '../../apps/api/src/auth/role.guard';
import { Access } from '../../apps/api/src/auth/access.decorator';
import {
  currentBusinessId,
  currentLocationId,
  currentVertical,
} from '../../apps/api/src/auth/request-context';
import { SharedOnboardingService } from '../../apps/api/src/onboarding/onboarding.module';
import { isLocalDatabase } from '../tools/seed-local';

if (!isLocalDatabase(process.env.DATABASE_URL ?? ''))
  throw new Error('Own local database required');
const db = createPrismaClient(process.env.DATABASE_URL, 'pms_test');
const prisma = { db } as unknown as PrismaService;
const onboarding = new SharedOnboardingService(prisma);
const org = randomUUID(),
  user = randomUUID();
let role: MembershipRole = 'OWNER';
const calls: string[] = [];
const creationKeys: string[] = [];
let unavailable = false;
let failCreate = false;
await db.organization.create({ data: { id: org, name: `MV7-browser-${org}`, status: 'ACTIVE' } });
await db.user.create({
  data: { id: user, name: 'Тестовый владелец', email: `mv7-${user}@example.invalid` },
});

class FixtureController {
  async me() {
    return {
      user: {
        id: user,
        name: 'Тестовый владелец',
        email: 'owner@example.invalid',
        role,
        organization: await db.organization.findUniqueOrThrow({ where: { id: org } }),
      },
      context: {
        businessId: currentBusinessId(),
        locationId: currentLocationId(),
        vertical: currentVertical(),
      },
    };
  }
  async branches() {
    const locations = await db.location.findMany({
      include: { business: true },
      where: { business: { organizationId: org }, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
    });
    return {
      organization: { id: org },
      canCreate: false,
      items: locations.map((l) => ({
        ...l,
        locationId: l.id,
        vertical: l.business.vertical,
        location: { businessId: l.businessId },
        _count: { inventoryUnits: 0, accommodationTypes: 0 },
      })),
    };
  }
  status() {
    return onboarding.status();
  }
  save(body: Record<string, unknown>) {
    return onboarding.save(body);
  }
}
Controller()(FixtureController);
for (const [name, path, method] of [
  ['me', 'auth/me', Get],
  ['branches', 'branches', Get],
  ['status', 'onboarding', Get],
  ['save', 'onboarding', Post],
] as const) {
  const descriptor = Object.getOwnPropertyDescriptor(FixtureController.prototype, name)!;
  method(path)(FixtureController.prototype, name, descriptor);
  Access('desk')(FixtureController.prototype, name, descriptor);
}
Body()(FixtureController.prototype, 'save', 0);
const module = await Test.createTestingModule({
  imports: [FoodModule, BeautyModule],
  controllers: [FixtureController],
})
  .overrideProvider(PrismaService)
  .useValue(prisma)
  .compile();
const app = module.createNestApplication();
app.use(
  async (
    req: {
      path: string;
      method: string;
      headers: Record<string, string>;
      body?: Record<string, unknown>;
      user?: object;
      on: (name: string, fn: (chunk?: Buffer) => void) => void;
    },
    res: { status: (s: number) => typeof res; json: (data: unknown) => void },
    next: () => void,
  ) => {
    if (req.path.startsWith('/__test/')) {
      try {
        const chunks: Buffer[] = [];
        req.on('data', (chunk) => {
          if (chunk) chunks.push(chunk);
        });
        req.on('end', () => {
          void (async () => {
            const raw = Buffer.concat(chunks).toString();
            const body = raw ? JSON.parse(raw) : {};
            if (req.path === '/__test/health') return res.json({ ok: true });
            if (req.path === '/__test/calls') return res.json(calls);
            if (req.path === '/__test/keys') return res.json(creationKeys);
            if (req.path === '/__test/reset') {
              role = 'OWNER';
              calls.length = 0;
              creationKeys.length = 0;
              unavailable = false;
              failCreate = false;
              await db.location.updateMany({
                where: { business: { organizationId: org } },
                data: { status: 'ARCHIVED' },
              });
              await db.organization.update({ where: { id: org }, data: { status: 'ACTIVE' } });
              const b1 = await db.business.create({
                data: {
                  organizationId: org,
                  name: 'Тестовый ресторан А',
                  vertical: 'FOOD_SERVICE',
                },
              });
              const b2 = await db.business.create({
                data: {
                  organizationId: org,
                  name: 'Тестовый ресторан Б',
                  vertical: 'FOOD_SERVICE',
                },
              });
              const beauty = await db.business.create({
                data: { organizationId: org, name: 'Тестовый салон', vertical: 'BEAUTY' },
              });
              const hotel = await db.business.create({
                data: { organizationId: org, name: 'Тестовый отель', vertical: 'HOSPITALITY' },
              });
              const locations = [];
              for (const [businessId, name] of [
                [b1.id, 'Тестовый филиал Центр'],
                [b1.id, 'Тестовый филиал Парк'],
                [b2.id, 'Другой тестовый бизнес'],
                [beauty.id, 'Тестовый салон'],
                [hotel.id, 'Тестовый отель'],
              ])
                locations.push(
                  await db.location.create({
                    data: {
                      businessId: businessId!,
                      name: name!,
                      timezone: 'Asia/Almaty',
                      currency: 'KZT',
                    },
                  }),
                );
              return res.json({
                business: b1.id,
                otherBusiness: b2.id,
                beauty: beauty.id,
                hotel: hotel.id,
                locations: locations.map((l) => l.id),
              });
            }
            if (req.path === '/__test/control') {
              role = body.role === 'STAFF' ? 'STAFF' : 'OWNER';
              unavailable = body.unavailable === true;
              failCreate = body.failCreate === true;
              await db.organization.update({
                where: { id: org },
                data: { status: body.readOnly ? 'READ_ONLY' : 'ACTIVE' },
              });
              return res.json({ ok: true });
            }
            if (req.path === '/__test/cleanup') {
              const marker = await db.organization.findUniqueOrThrow({ where: { id: org } });
              if (marker.name !== `MV7-browser-${org}`) throw new Error('Marker mismatch');
              const b = { organizationId: org };
              await db.$transaction(async (tx) => {
                await tx.tableAssignment.deleteMany({
                  where: { reservation: { location: { business: b } } },
                });
                await tx.restaurantReservation.deleteMany({ where: { location: { business: b } } });
                await tx.diningTable.deleteMany({ where: { area: { location: { business: b } } } });
                await tx.diningArea.deleteMany({ where: { location: { business: b } } });
                await tx.servicePeriod.deleteMany({ where: { location: { business: b } } });
                await tx.appointment.deleteMany({ where: { location: { business: b } } });
                await tx.timeOff.deleteMany({ where: { employee: { business: b } } });
                await tx.workingHours.deleteMany({ where: { employee: { business: b } } });
                await tx.employeeService.deleteMany({ where: { employee: { business: b } } });
                await tx.employeeLocation.deleteMany({ where: { employee: { business: b } } });
                await tx.locationService.deleteMany({ where: { service: { business: b } } });
                await tx.customerBusiness.deleteMany({ where: { business: b } });
                await tx.customer.deleteMany({ where: { organizationId: org } });
                await tx.employee.deleteMany({ where: { business: b } });
                await tx.beautyService.deleteMany({ where: { business: b } });
                await tx.$executeRaw`SELECT set_config('wetop.audit_purge', 'on', true)`;
                await tx.auditLog.deleteMany({ where: { organizationId: org } });
                await tx.onboardingProgress.deleteMany({ where: { location: { business: b } } });
                await tx.location.deleteMany({ where: { business: b } });
                await tx.business.deleteMany({ where: b });
                await tx.organization.delete({ where: { id: org } });
                await tx.user.delete({ where: { id: user } });
              });
              return res.json({ ok: true });
            }
            res.status(404).json({ message: 'Unknown fixture route' });
          })().catch((e: unknown) =>
            res.status(500).json({ message: e instanceof Error ? e.message : 'Fixture failed' }),
          );
        });
      } catch {
        res.status(500).json({ message: 'Fixture failed' });
      }
      return;
    }
    calls.push(req.path);
    if (req.path === '/food-service/reservations' && req.method === 'POST')
      creationKeys.push(req.headers['idempotency-key'] ?? '');
    if (failCreate && req.path === '/food-service/reservations' && req.method === 'POST') {
      failCreate = false;
      res.status(503).json({ message: 'Тестовый сбой сохранения' });
      return;
    }
    if (unavailable && req.path.startsWith('/food-service') && req.method === 'GET') {
      res.status(503).json({ message: 'Тестовый сбой Food API' });
      return;
    }
    req.user = { id: user, organizationId: org, role };
    next();
  },
);
app.useGlobalGuards(new RoleGuard(new Reflector()));
app.useGlobalInterceptors(new AuthorInterceptor(prisma));
await app.listen(55824, '127.0.0.1');
for (const signal of ['SIGTERM', 'SIGINT'] as const)
  process.on(signal, () => {
    void app
      .close()
      .then(() => db.$disconnect())
      .finally(() => process.exit(0));
  });
