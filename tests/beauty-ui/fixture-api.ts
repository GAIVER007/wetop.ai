/** Local synthetic identity; real Beauty HTTP guards/controllers/services/database. */
import 'reflect-metadata';
import '../../apps/api/src/hotel/hotel.module';
import { randomUUID } from 'node:crypto';
import { Controller, Get, Post, Body } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { createPrismaClient } from '@pms/database';
import type { MembershipRole } from '@pms/domain';
import { MarketingBudgetModule } from '../../apps/api/src/marketing-budget/marketing-budget.module';
import { BeautyModule } from '../../apps/api/src/beauty/beauty.module';
import { EmployeePortalModule } from '../../apps/api/src/employee-portal/employee-portal.module';
import { FoodStockController } from '../../apps/api/src/food-service/food.module';
import { StockService } from '../../apps/api/src/food-service/stock.service';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { SITE_ASSET_STORAGE } from '../../apps/api/src/marketing-site/asset-storage';
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
process.env.SESSION_SECRET ??= 'synthetic-beauty-ui-replay-key-not-production';
const db = createPrismaClient(process.env.DATABASE_URL, 'pms_test');
const prisma = { db } as unknown as PrismaService;
const onboarding = new SharedOnboardingService(prisma);
const org = randomUUID(),
  user = randomUUID(),
  managerUserId = randomUUID(),
  staffUserId = randomUUID();
let role: MembershipRole = 'OWNER';
const calls: string[] = [];

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
      context: {
        businessId: currentBusinessId(),
        locationId: currentLocationId(),
        vertical: currentVertical(),
      },
    };
  }
  async branches() {
    const locations = await db.location.findMany({
      where: { business: { organizationId: org }, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
    });
    return {
      organization: { id: org },
      canCreate: false,
      items: locations.map((l) => ({
        ...l,
        locationId: l.id,
        vertical: 'BEAUTY',
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
  // бюджет маркетинга общий для всех направлений (14.10.2026): настоящий модуль на той же базе
  imports: [BeautyModule, EmployeePortalModule, MarketingBudgetModule],
  controllers: [FixtureController, FoodStockController],
  providers: [StockService, { provide: PrismaService, useValue: prisma }],
})
  .overrideProvider(PrismaService)
  .useValue(prisma)
  .overrideProvider(SITE_ASSET_STORAGE)
  .useValue(null)
  .compile();
await db.organization.create({ data: { id: org, name: `MV5-browser-${org}`, status: 'ACTIVE' } });
await db.user.create({
  data: { id: user, name: 'Тестовый владелец', email: `mv5-${user}@example.invalid` },
});
const app = module.createNestApplication();
app.use(
  async (
    req: {
      path: string;
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
            if (req.path === '/__test/reset') {
              role = 'OWNER';
              calls.length = 0;
              // спеки делят стенд: cleanup предыдущего спека удаляет организацию, reset создаёт её заново
              await db.organization.upsert({
                where: { id: org },
                create: { id: org, name: `MV5-browser-${org}`, status: 'ACTIVE' },
                update: { status: 'ACTIVE' },
              });
              await db.user.upsert({
                where: { id: user },
                create: {
                  id: user,
                  name: 'Тестовый владелец',
                  email: `mv5-${user}@example.invalid`,
                  emailVerifiedAt: new Date(),
                  status: 'ACTIVE',
                },
                update: { emailVerifiedAt: new Date(), status: 'ACTIVE' },
              });
              const b1 = await db.business.create({
                data: { organizationId: org, name: 'Тестовая студия А', vertical: 'BEAUTY' },
              });
              const b2 = await db.business.create({
                data: { organizationId: org, name: 'Тестовая студия Б', vertical: 'BEAUTY' },
              });
              const locations = [];
              for (const [businessId, name] of [
                [b1.id, 'Тестовый филиал Центр'],
                [b1.id, 'Тестовый филиал Парк'],
                [b2.id, 'Другой тестовый бизнес'],
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
              for (const member of [
                  {
                    id: managerUserId,
                    name: 'Тестовая управляющая Мария',
                    email: `beauty-manager-${managerUserId}@example.invalid`,
                    emailVerifiedAt: new Date(),
                    status: 'ACTIVE' as const,
                  },
                  {
                    id: staffUserId,
                    name: 'Тестовый сотрудник Олег',
                    email: `beauty-staff-${staffUserId}@example.invalid`,
                    emailVerifiedAt: new Date(),
                    status: 'ACTIVE' as const,
                  },
                ])
                await db.user.upsert({
                  where: { id: member.id },
                  create: member,
                  update: {
                    name: member.name,
                    emailVerifiedAt: new Date(),
                    status: 'ACTIVE',
                  },
                });
              await db.membership.createMany({
                data: [
                  { userId: user, organizationId: org, role: 'OWNER' },
                  { userId: managerUserId, organizationId: org, role: 'MANAGER' },
                  { userId: staffUserId, organizationId: org, role: 'STAFF' },
                ],
                skipDuplicates: true,
              });
              await db.membershipScope.create({
                data: {
                  organizationId: org,
                  userId: staffUserId,
                  role: 'STAFF',
                  businessId: b1.id,
                  locationId: locations[0]!.id,
                },
              });
              return res.json({
                business: b1.id,
                otherBusiness: b2.id,
                locations: locations.map((l) => l.id),
                members: { manager: managerUserId, staff: staffUserId },
              });
            }
            if (req.path === '/__test/control') {
              role = body.role === 'STAFF' ? 'STAFF' : 'OWNER';
              await db.organization.update({
                where: { id: org },
                data: { status: body.readOnly ? 'READ_ONLY' : 'ACTIVE' },
              });
              return res.json({ ok: true });
            }
            if (req.path === '/__test/cleanup') {
              const marker = await db.organization.findUniqueOrThrow({ where: { id: org } });
              if (marker.name !== `MV5-browser-${org}`) throw new Error('Marker mismatch');
              const b = { organizationId: org };
              await db.$transaction(async (tx) => {
                const memberIds = await tx.membership.findMany({
                  where: { organizationId: org },
                  select: { userId: true },
                });
                const cleanupDatabaseUrl = process.env.DATABASE_URL ?? '';
                if (!isLocalDatabase(cleanupDatabaseUrl))
                  throw new Error('Beauty UI cleanup requires an own local database');
                // The append-only movement trigger is a production invariant. This synthetic local
                // fixture deletes only stock rows under its checked organization marker.
                await tx.$executeRaw`SET LOCAL session_replication_role = replica`;
                await tx.kitchenStockMovement.deleteMany({ where: { location: { business: b } } });
                await tx.kitchenStockLot.deleteMany({ where: { location: { business: b } } });
                await tx.$executeRaw`SET LOCAL session_replication_role = origin`;
                await tx.beautyLocationHours.deleteMany({ where: { location: { business: b } } });
                // оплаты записей (§49) держат запись RESTRICT: касса филиала первой
                await tx.restaurantCashOperation.deleteMany({ where: { location: { business: b } } });
                await tx.beautyReviewInvitation.deleteMany({ where: { appointment: { location: { business: b } } } });
                await tx.beautyAppointmentReview.deleteMany({ where: { appointment: { location: { business: b } } } });
                await tx.appointmentLine.deleteMany({ where: { appointment: { location: { business: b } } } });
                await tx.appointment.deleteMany({ where: { location: { business: b } } });
                await tx.timeOff.deleteMany({ where: { employee: { business: b } } });
                await tx.workingHours.deleteMany({ where: { employee: { business: b } } });
                await tx.employeeServicePrice.deleteMany({ where: { employee: { business: b } } });
                await tx.employeeService.deleteMany({ where: { employee: { business: b } } });
                await tx.employeeLocation.deleteMany({ where: { employee: { business: b } } });
                await tx.employeePortfolioItem.deleteMany({ where: { employee: { business: b } } });
                await tx.employeeMedia.deleteMany({ where: { employee: { business: b } } });
                await tx.employeePublicProfile.deleteMany({ where: { employee: { business: b } } });
                await tx.employeePayAdjustment.deleteMany({ where: { employee: { business: b } } });
                await tx.employeePaySetting.deleteMany({ where: { employee: { business: b } } });
                await tx.locationService.deleteMany({ where: { service: { business: b } } });
                await tx.beautyServiceMaterial.deleteMany({ where: { service: { business: b } } });
                await tx.beautyServiceMaterialRevision.deleteMany({ where: { service: { business: b } } });
                // журнал импорта клиентов (132) держит бизнес RESTRICT: строки, затем сам импорт
                await tx.customerImportRow.deleteMany({ where: { organizationId: org } });
                await tx.customerImport.deleteMany({ where: { organizationId: org } });
                await tx.customerBusiness.deleteMany({ where: { business: b } });
                await tx.customer.deleteMany({ where: { organizationId: org } });
                await tx.employee.deleteMany({ where: { business: b } });
                await tx.beautyService.deleteMany({ where: { business: b } });
                await tx.kitchenProduct.deleteMany({ where: { business: b } });
                await tx.beautyPayrollPolicy.deleteMany({ where: { business: b } });
                // Held 134 intentionally preserves revoked assignment history. This local synthetic
                // fixture bypasses that trigger only for rows under its checked organization marker.
                await tx.$executeRaw`SET LOCAL session_replication_role = replica`;
                await tx.beautyPositionAssignment.deleteMany({ where: { organizationId: org } });
                await tx.$executeRaw`SET LOCAL session_replication_role = origin`;
                await tx.beautyPositionPermission.deleteMany({
                  where: { position: { business: b } },
                });
                await tx.beautyPosition.deleteMany({ where: { business: b } });
                await tx.$executeRaw`SELECT set_config('wetop.audit_purge', 'on', true)`;
                await tx.auditLog.deleteMany({ where: { organizationId: org } });
                await tx.onboardingProgress.deleteMany({ where: { location: { business: b } } });
                // способы оплаты филиала (миграция 151, #807): RESTRICT на филиал, уходят до филиала
                await tx.branchPaymentMethodSetting.deleteMany({ where: { location: { business: b } } });
                await tx.marketingExpense.deleteMany({ where: { location: { business: b } } });
                await tx.marketingBudget.deleteMany({ where: { location: { business: b } } });
                await tx.membershipScope.deleteMany({ where: { organizationId: org } });
                await tx.location.deleteMany({ where: { business: b } });
                await tx.business.deleteMany({ where: b });
                await tx.membership.deleteMany({ where: { organizationId: org } });
                await tx.organization.delete({ where: { id: org } });
                await tx.user.deleteMany({
                  where: { id: { in: [...memberIds.map((member) => member.userId), user] } },
                });
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
    req.user = { id: user, organizationId: org, role };
    next();
  },
);
app.useGlobalGuards(new RoleGuard(new Reflector()));
app.useGlobalInterceptors(new AuthorInterceptor(prisma));
await app.listen(Number(process.env.BEAUTY_UI_API_PORT || '26814'), '127.0.0.1');
for (const signal of ['SIGTERM', 'SIGINT'] as const)
  process.on(signal, () => {
    void app
      .close()
      .then(() => db.$disconnect())
      .finally(() => process.exit(0));
  });
