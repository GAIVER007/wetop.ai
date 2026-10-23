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
import { BarModule } from '../../apps/api/src/bar/bar.module';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import {
  MemorySiteAssetStorage,
  SITE_ASSET_STORAGE,
} from '../../apps/api/src/marketing-site/asset-storage';
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
const sessionExpiresAt = new Date(Date.now() + 24 * 3600_000).toISOString();
// Как настоящий /auth/me (#719): время выдачи сессии не меняется при продлении, по нему бар узнаёт ту же сессию
const sessionIssuedAt = new Date().toISOString();
let unavailable = false;
let failCreate = false;
await db.organization.create({ data: { id: org, name: `MV7-browser-${org}`, status: 'ACTIVE' } });
await db.user.create({
  data: { id: user, name: 'Тестовый владелец', email: `mv7-${user}@example.invalid` },
});
// Real Beauty writers revalidate live membership, not only the synthetic HTTP identity.
await db.membership.create({ data: { userId: user, organizationId: org, role: 'OWNER' } });

class FixtureController {
  async me() {
    return {
      user: {
        id: user,
        organizationId: org,
        name: 'Тестовый владелец',
        email: 'owner@example.invalid',
        role,
        organization: await db.organization.findUniqueOrThrow({ where: { id: org } }),
      },
      expiresAt: sessionExpiresAt,
      sessionIssuedAt,
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
  // как настоящие /auth/me и /branches (право `self`): «Личный кабинет» официанта тоже их получает (§33.6)
  Access(name === 'me' || name === 'branches' ? 'self' : 'desk')(FixtureController.prototype, name, descriptor);
}
Body()(FixtureController.prototype, 'save', 0);
const module = await Test.createTestingModule({
  // бар филиала (ADR-178): ресторан и салон пользуются баром наравне с гостиницей
  imports: [FoodModule, BeautyModule, BarModule],
  controllers: [FixtureController],
})
  .overrideProvider(PrismaService)
  .useValue(prisma)
  // фото блюд (§37): хранилище в памяти; адреса подписаны, но картинка в браузере не грузится (проверяется адрес)
  .overrideProvider(SITE_ASSET_STORAGE)
  .useValue(new MemorySiteAssetStorage('https://assets.storage.test'))
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
              // «marker guarded cleanup» сносит организацию и пользователя; следующий спек начинает заново
              await db.organization.upsert({
                where: { id: org },
                create: { id: org, name: `MV7-browser-${org}`, status: 'ACTIVE' },
                update: { status: 'ACTIVE' },
              });
              await db.user.upsert({
                where: { id: user },
                create: { id: user, name: 'Тестовый владелец', email: `mv7-${user}@example.invalid` },
                update: {},
              });
              await db.membership.upsert({
                where: { userId_organizationId: { userId: user, organizationId: org } },
                create: { userId: user, organizationId: org, role: 'OWNER' },
                update: { role: 'OWNER', status: 'ACTIVE' },
              });
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
              role = body.role === 'STAFF' ? 'STAFF' : body.role === 'EMPLOYEE' ? 'EMPLOYEE' : 'OWNER';
              // официант с телефона (§33.6): вход «Личного кабинета» привязан к сотруднику ресторана
              if (typeof body.employeeId === 'string') {
                await db.employee.updateMany({ where: { userId: user }, data: { userId: null } });
                await db.employee.update({ where: { id: body.employeeId }, data: { userId: user } });
              }
              await db.membership.update({
                where: { userId_organizationId: { userId: user, organizationId: org } },
                data: { role },
              });
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
                // бар филиала (ADR-178): строки бара держат филиал и кассу ресторана, уходят первыми
                const bl = { location: { business: b } };
                await tx.barSaleLine.deleteMany({ where: { sale: bl } });
                await tx.barStockMovement.deleteMany({ where: bl });
                await tx.barSupplierPayment.deleteMany({ where: { receipt: bl } });
                await tx.barSale.deleteMany({ where: bl });
                await tx.barStockLot.deleteMany({ where: bl });
                await tx.barReceiptLine.deleteMany({ where: { receipt: bl } });
                await tx.barReceipt.deleteMany({ where: bl });
                await tx.barProduct.deleteMany({ where: bl });
                await tx.barCategory.deleteMany({ where: bl });
                await tx.barSupplier.deleteMany({ where: bl });
                await tx.restaurantOrderItem.deleteMany({
                  where: { order: { location: { business: b } } },
                });
                await tx.restaurantPayment.deleteMany({ where: bl });
                await tx.restaurantCashOperation.deleteMany({ where: bl });
                await tx.restaurantOrder.deleteMany({ where: { location: { business: b } } });
                await tx.menuItemIngredient.deleteMany({ where: { menuItem: { business: b } } });
                await tx.menuItem.deleteMany({ where: { business: b } });
                await tx.menuCategory.deleteMany({ where: { business: b } });
                await tx.employeePayAdjustment.deleteMany({ where: { employee: { business: b } } });
                await tx.employeePaySetting.deleteMany({ where: { employee: { business: b } } });
                await tx.tableAssignment.deleteMany({
                  where: { reservation: { location: { business: b } } },
                });
                await tx.restaurantReservation.deleteMany({ where: { location: { business: b } } });
                await tx.diningTable.deleteMany({ where: { area: { location: { business: b } } } });
                await tx.diningArea.deleteMany({ where: { location: { business: b } } });
                await tx.servicePeriod.deleteMany({ where: { location: { business: b } } });
                await tx.foodBookingRules.deleteMany({ where: { location: { business: b } } });
                await tx.foodClosedDay.deleteMany({ where: { location: { business: b } } });
                await tx.appointmentLine.deleteMany({ where: { appointment: bl } });
                await tx.appointment.deleteMany({ where: { location: { business: b } } });
                await tx.employeeServicePrice.deleteMany({ where: { employee: { business: b } } });
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
                // лента склада только дописывается: удаление проходит только под audit_purge (DATA_MODEL §34)
                await tx.kitchenStockMovement.deleteMany({ where: { location: { business: b } } });
                await tx.kitchenStockLot.deleteMany({ where: { location: { business: b } } });
                await tx.kitchenProduct.deleteMany({ where: { business: b } });
                await tx.auditLog.deleteMany({ where: { organizationId: org } });
                await tx.onboardingProgress.deleteMany({ where: { location: { business: b } } });
                await tx.location.deleteMany({ where: { business: b } });
                await tx.business.deleteMany({ where: b });
                await tx.membership.deleteMany({ where: { organizationId: org, userId: user } });
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
await app.listen(Number(process.env.FOOD_UI_API_PORT ?? 55824), '127.0.0.1');
for (const signal of ['SIGTERM', 'SIGINT'] as const)
  process.on(signal, () => {
    void app
      .close()
      .then(() => db.$disconnect())
      .finally(() => process.exit(0));
  });
