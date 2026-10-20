import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { createPrismaClient, type Db } from '@pms/database';
import { BeautyCatalogService } from '../../apps/api/src/beauty/beauty.module';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * Назначение в «Персонале» на настоящей базе (миграция 138): назначение и журнал, чужая организация 404,
 * устаревшая версия 409, не руководитель 403, CHECK колонки и создание с назначением.
 */
describe.skipIf(!process.env.DATABASE_URL)('Beauty personnel kind', () => {
  let db: Db;
  let catalog: BeautyCatalogService;
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
    vertical: 'BEAUTY' as const,
  });
  const run = <T>(fn: () => Promise<T>, role?: 'OWNER' | 'MANAGER' | 'STAFF') =>
    withSignedInUser(actor(role), fn);

  beforeAll(async () => {
    if (!isLocalDatabase(process.env.DATABASE_URL!)) throw new Error('Own localhost DB required');
    process.env.SESSION_SECRET = 'local-personnel-kind-contract-key-not-production';
    db = createPrismaClient(process.env.DATABASE_URL, 'pms_test');
    catalog = new BeautyCatalogService({ db } as never);
    for (const id of [org, foreignOrg])
      await db.organization.create({ data: { id, name: 'Personnel synthetic', status: 'ACTIVE' } });
    await db.user.create({
      data: { id: user, email: `personnel-${user}@example.invalid`, name: 'Тестовый владелец' },
    });
    foreignBusiness = randomUUID();
    await db.business.create({
      data: { id: foreignBusiness, organizationId: foreignOrg, name: 'Чужой салон', vertical: 'BEAUTY' },
    });
  });
  beforeEach(async () => {
    await db.organization.update({ where: { id: org }, data: { status: 'ACTIVE', trialEndsAt: null } });
    business = randomUUID();
    location = randomUUID();
    await db.business.create({
      data: { id: business, organizationId: org, name: 'Тестовый салон', vertical: 'BEAUTY' },
    });
    await db.location.create({
      data: { id: location, businessId: business, name: 'Тестовый филиал', currency: 'KZT', timezone: 'Asia/Almaty' },
    });
  });
  afterAll(async () => {
    if (!db) return;
    const bs = (
      await db.business.findMany({ where: { organizationId: { in: [org, foreignOrg] } }, select: { id: true } })
    ).map((b) => b.id);
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

  it('старая запись остаётся «не назначено», руководитель назначает, журнал пишет до и после', async () => {
    const created = await run(() => catalog.createEmployee({ name: 'Старая запись', active: true }));
    expect(created.personnelKind).toBeNull();
    const list = await run(() => catalog.employees());
    expect(list.canAssignPersonnelKind).toBe(true);
    expect(list.items[0]!.personnelKind).toBeNull();
    const saved = await run(() =>
      catalog.assignPersonnelKind(created.id, { personnelKind: 'BOTH', expectedProfileRevision: created.profileRevision }),
    );
    expect(saved.personnelKind).toBe('BOTH');
    expect(saved.profileRevision > created.profileRevision).toBe(true);
    expect((await db.employee.findUniqueOrThrow({ where: { id: created.id } })).personnelKind).toBe('BOTH');
    const audit = await db.auditLog.findFirstOrThrow({
      where: { entityId: created.id, action: 'beauty.employee.personnel_kind' },
    });
    expect(audit.before).toEqual({ personnelKind: null });
    expect(audit.after).toEqual({ personnelKind: 'BOTH' });
    expect(audit.userId).toBe(user);
    // услуги, имя и прочее не меняются
    const after = (await run(() => catalog.employees())).items[0]!;
    expect(after).toMatchObject({ name: 'Старая запись', personnelKind: 'BOTH', serviceIds: [] });
  });

  it('создание с явным назначением сохраняет его', async () => {
    const created = await run(() =>
      catalog.createEmployee({ name: 'Администратор зала', active: true, personnelKind: 'OTHER_EMPLOYEE' }),
    );
    expect(created.personnelKind).toBe('OTHER_EMPLOYEE');
    await expect(
      run(() => catalog.createEmployee({ name: 'Плохое', active: true, personnelKind: 'ADMIN' })),
    ).rejects.toThrow('Назначение');
  });

  it('устаревшая версия: 409, значение не меняется', async () => {
    const created = await run(() => catalog.createEmployee({ name: 'Мастер', active: true }));
    await run(() => catalog.updateEmployee(created.id, { name: 'Мастер 2', expectedProfileRevision: created.profileRevision }));
    await expect(
      run(() => catalog.assignPersonnelKind(created.id, { personnelKind: 'SPECIALIST', expectedProfileRevision: created.profileRevision })),
    ).rejects.toBeInstanceOf(ConflictException);
    expect((await db.employee.findUniqueOrThrow({ where: { id: created.id } })).personnelKind).toBeNull();
  });

  it('сотрудник чужой организации: 404, без записи', async () => {
    const foreign = await db.employee.create({ data: { businessId: foreignBusiness, name: 'Чужой мастер' } });
    const [row] = await db.$queryRaw<Array<{ v: string }>>`
      SELECT to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS v FROM employees WHERE id=${foreign.id}::uuid`;
    await expect(
      run(() => catalog.assignPersonnelKind(foreign.id, { personnelKind: 'BOTH', expectedProfileRevision: row!.v })),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect((await db.employee.findUniqueOrThrow({ where: { id: foreign.id } })).personnelKind).toBeNull();
    expect(await db.auditLog.count({ where: { entityId: foreign.id } })).toBe(0);
  });

  it('не руководитель: 403 и без права в списке; организация только для чтения: 403', async () => {
    const created = await run(() => catalog.createEmployee({ name: 'Мастер', active: true }));
    const body = { personnelKind: 'SPECIALIST', expectedProfileRevision: created.profileRevision };
    await expect(run(() => catalog.assignPersonnelKind(created.id, body), 'STAFF')).rejects.toBeInstanceOf(ForbiddenException);
    expect((await run(() => catalog.employees(), 'STAFF')).canAssignPersonnelKind).toBe(false);
    expect((await run(() => catalog.employees(), 'MANAGER')).canAssignPersonnelKind).toBe(true);
    await db.organization.update({ where: { id: org }, data: { status: 'READ_ONLY' } });
    expect((await run(() => catalog.employees())).canAssignPersonnelKind).toBe(false);
    await expect(run(() => catalog.assignPersonnelKind(created.id, body))).rejects.toThrow('чтения');
    expect((await db.employee.findUniqueOrThrow({ where: { id: created.id } })).personnelKind).toBeNull();
  });

  it('CHECK в базе не пускает чужое значение', async () => {
    const created = await run(() => catalog.createEmployee({ name: 'Мастер', active: true }));
    await expect(
      db.$executeRaw`UPDATE employees SET personnel_kind='ADMIN' WHERE id=${created.id}::uuid`,
    ).rejects.toThrow(/employees_personnel_kind_check/);
  });
});
