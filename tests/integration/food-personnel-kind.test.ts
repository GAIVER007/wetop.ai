import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { createPrismaClient, type Db } from '@pms/database';
import { RestaurantService } from '../../apps/api/src/food-service/restaurant.service';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import type { StockService } from '../../apps/api/src/food-service/stock.service';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * Назначение «специалист / другой сотрудник / оба» у ресторана (решение владельца 20.10.2026,
 * docs/decisions/2026-10-20-personnel-and-currency-next.md): та же колонка employees.personnel_kind, что у салона.
 */
describe.skipIf(!process.env.DATABASE_URL)('Restaurant personnel kind', () => {
  let db: Db;
  let food: RestaurantService;
  const org = randomUUID();
  const foreignOrg = randomUUID();
  const user = randomUUID();
  let business: string;
  let location: string;
  let foreignBusiness: string;
  const actor = (role: 'OWNER' | 'MANAGER' | 'STAFF' = 'OWNER') => ({
    userId: user,
    organizationId: org,
    role,
    scope: 'LOCATION' as const,
    businessId: business,
    locationId: location,
    vertical: 'FOOD_SERVICE' as const,
  });
  const run = <T>(fn: () => Promise<T>, role?: 'OWNER' | 'MANAGER' | 'STAFF') => withSignedInUser(actor(role), fn);
  const list = async (role?: 'OWNER' | 'MANAGER' | 'STAFF') =>
    (await run(() => food.employees({}), role)) as unknown as {
      items: Array<{ id: string; name: string; personnelKind: string | null; profileRevision: string }>;
      canAssignPersonnelKind?: boolean;
    };

  beforeAll(async () => {
    if (!isLocalDatabase(process.env.DATABASE_URL!)) throw new Error('Own localhost DB required');
    db = createPrismaClient(process.env.DATABASE_URL, 'pms_test');
    food = new RestaurantService({ db } as PrismaService, null, {} as StockService);
    for (const id of [org, foreignOrg])
      await db.organization.create({ data: { id, name: 'Food personnel synthetic', status: 'ACTIVE' } });
    await db.user.create({ data: { id: user, email: `food-personnel-${user}@example.invalid`, name: 'Тестовый владелец' } });
    foreignBusiness = randomUUID();
    await db.business.create({
      data: { id: foreignBusiness, organizationId: foreignOrg, name: 'Чужой ресторан', vertical: 'FOOD_SERVICE' },
    });
  });
  beforeEach(async () => {
    await db.organization.update({ where: { id: org }, data: { status: 'ACTIVE', trialEndsAt: null } });
    business = randomUUID();
    location = randomUUID();
    await db.business.create({ data: { id: business, organizationId: org, name: 'Тестовый ресторан', vertical: 'FOOD_SERVICE' } });
    await db.location.create({
      data: { id: location, businessId: business, name: 'Тестовый зал', currency: 'KZT', timezone: 'Asia/Almaty' },
    });
  });
  afterAll(async () => {
    if (!db) return;
    const bs = (await db.business.findMany({ where: { organizationId: { in: [org, foreignOrg] } }, select: { id: true } })).map((b) => b.id);
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('wetop.audit_purge','on',true)`;
      await tx.auditLog.deleteMany({ where: { organizationId: { in: [org, foreignOrg] } } });
      await tx.employeeLocation.deleteMany({ where: { employee: { businessId: { in: bs } } } });
      await tx.employee.deleteMany({ where: { businessId: { in: bs } } });
      await tx.location.deleteMany({ where: { businessId: { in: bs } } });
      await tx.business.deleteMany({ where: { id: { in: bs } } });
      await tx.user.delete({ where: { id: user } });
      await tx.organization.deleteMany({ where: { id: { in: [org, foreignOrg] } } });
    });
    await db.$disconnect();
  });

  it('список отдаёт назначение, создание принимает его, руководитель назначает, журнал пишет до и после', async () => {
    await run(() => food.createEmployee({ name: 'Старая запись' }));
    await run(() => food.createEmployee({ name: 'Повар', personnelKind: 'OTHER_EMPLOYEE' }));
    const before = await list();
    expect(before.canAssignPersonnelKind).toBe(true);
    const old = before.items.find((r) => r.name === 'Старая запись')!;
    expect(old.personnelKind).toBeNull();
    expect(before.items.find((r) => r.name === 'Повар')!.personnelKind).toBe('OTHER_EMPLOYEE');
    const saved = await run(() =>
      food.assignPersonnelKind(old.id, { personnelKind: 'BOTH', expectedProfileRevision: old.profileRevision }),
    );
    expect(saved.personnelKind).toBe('BOTH');
    const audit = await db.auditLog.findFirstOrThrow({ where: { entityId: old.id, action: 'food.employee.personnel_kind' } });
    expect(audit.before).toEqual({ personnelKind: null });
    expect(audit.after).toEqual({ personnelKind: 'BOTH' });
  });

  it('устаревшая версия: 409; чужая организация: 404; администратор: 403 и без права в списке', async () => {
    await run(() => food.createEmployee({ name: 'Официант' }));
    const row = (await list()).items[0]!;
    await run(() => food.updateEmployee(row.id, { name: 'Официант 2', expectedProfileRevision: row.profileRevision }));
    await expect(
      run(() => food.assignPersonnelKind(row.id, { personnelKind: 'SPECIALIST', expectedProfileRevision: row.profileRevision })),
    ).rejects.toBeInstanceOf(ConflictException);
    const fresh = (await list()).items[0]!;
    await expect(
      run(() => food.assignPersonnelKind(fresh.id, { personnelKind: 'SPECIALIST', expectedProfileRevision: fresh.profileRevision }), 'STAFF'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect((await list('STAFF')).canAssignPersonnelKind).toBe(false);
    const foreign = await db.employee.create({ data: { businessId: foreignBusiness, name: 'Чужой' } });
    await expect(
      run(() => food.assignPersonnelKind(foreign.id, { personnelKind: 'BOTH', expectedProfileRevision: fresh.profileRevision })),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect((await db.employee.findUniqueOrThrow({ where: { id: foreign.id } })).personnelKind).toBeNull();
    expect((await db.employee.findUniqueOrThrow({ where: { id: fresh.id } })).personnelKind).toBeNull();
  });
});
