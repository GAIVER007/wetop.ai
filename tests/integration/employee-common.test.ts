import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db, type DbTx } from '@pms/database';
import { BeautyCatalogService } from '../../apps/api/src/beauty/beauty.module';
import { BeautyScheduleService } from '../../apps/api/src/beauty/schedule';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { isLocalDatabase } from '../tools/seed-local';

describe.skipIf(!process.env.DATABASE_URL)('Employee common fixed export candidate', () => {
  let db: Db;
  let catalog: BeautyCatalogService;
  let schedule: BeautyScheduleService;
  const org = randomUUID();
  const user = randomUUID();
  let business: string;
  let location: string;
  const actor = () => ({
    userId: user,
    organizationId: org,
    role: 'OWNER' as const,
    scope: 'LOCATION' as const,
    businessId: business,
    locationId: location,
    vertical: 'BEAUTY' as const,
  });
  const run = <T>(fn: () => Promise<T>) => withSignedInUser(actor(), fn);
  const input = { name: 'Тестовый мастер', active: true };
  beforeAll(async () => {
    if (!isLocalDatabase(process.env.DATABASE_URL!)) throw new Error('Own localhost DB required');
    process.env.SESSION_SECRET = 'local-onboarding-contract-key-not-production';
    db = createPrismaClient(process.env.DATABASE_URL, 'pms_test');
    catalog = new BeautyCatalogService({ db } as never);
    schedule = new BeautyScheduleService({ db } as never);
    await db.organization.create({
      data: { id: org, name: 'Employee common synthetic', status: 'ACTIVE' },
    });
    await db.user.create({
      data: {
        id: user,
        email: `employee-common-${user}@example.invalid`,
        name: 'Тестовый владелец',
      },
    });
  });
  beforeEach(async () => {
    await db.organization.update({
      where: { id: org },
      data: { status: 'ACTIVE', trialEndsAt: null },
    });
    business = randomUUID();
    location = randomUUID();
    await db.business.create({
      data: { id: business, organizationId: org, name: 'Тестовый бизнес', vertical: 'BEAUTY' },
    });
    await db.location.create({
      data: {
        id: location,
        businessId: business,
        name: 'Тестовый филиал',
        currency: 'KZT',
        timezone: 'Asia/Almaty',
      },
    });
  });
  afterAll(async () => {
    if (!db) return;
    const bs = (
      await db.business.findMany({ where: { organizationId: org }, select: { id: true } })
    ).map((b) => b.id);
    const ls = (
      await db.location.findMany({ where: { businessId: { in: bs } }, select: { id: true } })
    ).map((l) => l.id);
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('wetop.audit_purge','on',true)`;
      await tx.auditLog.deleteMany({ where: { organizationId: org } });
      await tx.workingHours.deleteMany({ where: { locationId: { in: ls } } });
      await tx.employeeService.deleteMany({ where: { employee: { businessId: { in: bs } } } });
      await tx.employeeLocation.deleteMany({ where: { locationId: { in: ls } } });
      await tx.employee.deleteMany({ where: { businessId: { in: bs } } });
      await tx.beautyService.deleteMany({ where: { businessId: { in: bs } } });
      await tx.location.deleteMany({ where: { id: { in: ls } } });
      await tx.business.deleteMany({ where: { id: { in: bs } } });
      await tx.user.delete({ where: { id: user } });
      await tx.organization.delete({ where: { id: org } });
    });
    await db.$disconnect();
  });
  it('same key/same initial normalized input and fresh service instance return one ID', async () => {
    const creationId = randomUUID();
    const a = await run(() => catalog.createEmployee({ ...input, creationId }));
    const fresh = new BeautyCatalogService({ db } as never);
    const b = await run(() => fresh.createEmployee({ ...input, creationId }));
    expect(a.id).toBe(creationId);
    expect(b.id).toBe(creationId);
    expect(await db.employee.count({ where: { businessId: business } })).toBe(1);
    expect(await db.employeeLocation.count({ where: { employeeId: creationId } })).toBe(1);
    expect(await db.employeeService.count({ where: { employeeId: creationId } })).toBe(0);
    expect(a.servicesRevision).toMatch(/^[a-f0-9]{64}$/);
  });
  it('two concurrent identical creates are one Employee, one assignment, one receipt', async () => {
    const creationId = randomUUID();
    const results = await Promise.all(
      [1, 2].map(() => run(() => catalog.createEmployee({ ...input, creationId }))),
    );
    expect(results.map((r) => r.id)).toEqual([creationId, creationId]);
    expect(await db.employee.count({ where: { businessId: business } })).toBe(1);
    expect(
      await db.auditLog.count({
        where: { entityId: creationId, action: 'beauty.employee.created' },
      }),
    ).toBe(1);
  });
  it('same key/different input conflicts without modifying the employee', async () => {
    const creationId = randomUUID();
    await run(() => catalog.createEmployee({ ...input, creationId }));
    await expect(
      run(() => catalog.createEmployee({ name: 'Другой запрос', creationId })),
    ).rejects.toThrow('не подтверждено');
    expect((await db.employee.findUniqueOrThrow({ where: { id: creationId } })).name).toBe(
      input.name,
    );
  });
  it('replay compares original receipt and does not revert later profile edits', async () => {
    const creationId = randomUUID();
    const employee = await run(() => catalog.createEmployee({ ...input, creationId }));
    await run(() => catalog.updateEmployee(creationId, { name: 'Новое имя', expectedProfileRevision: employee.profileRevision }));
    expect((await run(() => catalog.createEmployee({ ...input, creationId }))).name).toBe(
      'Новое имя',
    );
  });
  it('different initial Location/initiator and STAFF cannot claim replay', async () => {
    const creationId = randomUUID();
    await run(() => catalog.createEmployee({ ...input, creationId }));
    const second = await db.location.create({
      data: { businessId: business, name: 'Второй', currency: 'KZT', timezone: 'Asia/Almaty' },
    });
    await expect(
      withSignedInUser({ ...actor(), locationId: second.id }, () =>
        catalog.createEmployee({ ...input, creationId }),
      ),
    ).rejects.toThrow('не подтверждено');
    await expect(
      withSignedInUser({ ...actor(), userId: randomUUID() }, () =>
        catalog.createEmployee({ ...input, creationId }),
      ),
    ).rejects.toThrow('не подтверждено');
    await expect(
      withSignedInUser({ ...actor(), role: 'STAFF' as const }, () =>
        catalog.createEmployee({ ...input, creationId }),
      ),
    ).rejects.toThrow();
    expect(await db.employeeLocation.count({ where: { employeeId: creationId } })).toBe(1);
  });
  it('foreign organization context and inactive parent are denied', async () => {
    await expect(
      withSignedInUser({ ...actor(), organizationId: randomUUID() }, () =>
        catalog.createEmployee({ ...input, creationId: randomUUID() }),
      ),
    ).rejects.toThrow();
    await db.location.update({ where: { id: location }, data: { status: 'ARCHIVED' } });
    await expect(
      run(() => catalog.createEmployee({ ...input, creationId: randomUUID() })),
    ).rejects.toThrow();
    expect(await db.employee.count({ where: { businessId: business } })).toBe(0);
  });
  it('read-only/expired trial denies replay before returning saved data', async () => {
    const creationId = randomUUID();
    await run(() => catalog.createEmployee({ ...input, creationId }));
    for (const data of [
      { status: 'READ_ONLY' as const },
      { status: 'TRIAL' as const, trialEndsAt: new Date('2000-01-01T00:00:00Z') },
    ]) {
      await db.organization.update({ where: { id: org }, data });
      await expect(run(() => catalog.createEmployee({ ...input, creationId }))).rejects.toThrow(
        'чтения',
      );
    }
    expect(await db.employee.count({ where: { businessId: business } })).toBe(1);
  });
  it('missing receipt and archived resource fail closed without replacement', async () => {
    const creationId = randomUUID();
    await run(() => catalog.createEmployee({ ...input, creationId }));
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('wetop.audit_purge','on',true)`;
      await tx.auditLog.deleteMany({ where: { entityId: creationId } });
    });
    await expect(run(() => catalog.createEmployee({ ...input, creationId }))).rejects.toThrow(
      'не подтверждено',
    );
    const second = randomUUID();
    const employee = await run(() => catalog.createEmployee({ ...input, creationId: second }));
    await run(() => catalog.updateEmployee(second, { active: false, expectedProfileRevision: employee.profileRevision }));
    await expect(
      run(() => catalog.createEmployee({ ...input, creationId: second })),
    ).rejects.toThrow('архиве');
    expect(await db.employee.count({ where: { businessId: business } })).toBe(2);
  });
  it('retained receipt without resource reserves the old operation', async () => {
    const creationId = randomUUID();
    await run(() => catalog.createEmployee({ ...input, creationId }));
    await db.employeeLocation.deleteMany({ where: { employeeId: creationId } });
    await db.employee.delete({ where: { id: creationId } });
    await expect(run(() => catalog.createEmployee({ ...input, creationId }))).rejects.toThrow(
      'прежнего создания',
    );
    expect(await db.employee.count({ where: { businessId: business } })).toBe(0);
  });
  it('receipt failure rolls back Employee and initial assignment in the real transaction', async () => {
    const creationId = randomUUID();
    const failing = new Proxy(db, {
      get(target, key) {
        if (key === '$transaction')
          return (fn: (tx: DbTx) => Promise<unknown>) =>
            target.$transaction((tx) =>
              fn(
                new Proxy(tx, {
                  get(t, p) {
                    if (p === 'auditLog')
                      return {
                        ...t.auditLog,
                        create: async () => {
                          throw new Error('Injected receipt failure');
                        },
                      };
                    return Reflect.get(t, p);
                  },
                }),
              ),
            );
        return Reflect.get(target, key);
      },
    });
    await expect(
      run(() =>
        new BeautyCatalogService({ db: failing } as never).createEmployee({ ...input, creationId }),
      ),
    ).rejects.toThrow('Injected');
    expect(await db.employee.count({ where: { id: creationId } })).toBe(0);
    expect(await db.employeeLocation.count({ where: { employeeId: creationId } })).toBe(0);
  });
  it('receipt contains no open phone/email and is bounded', async () => {
    const creationId = randomUUID();
    const email = 'synthetic-person@example.invalid';
    const phone = '+7 700 000 00 00';
    await run(() => catalog.createEmployee({ ...input, email, phone, creationId }));
    const event = await db.auditLog.findFirstOrThrow({
      where: { entityId: creationId, action: 'beauty.employee.created' },
    });
    const after = JSON.stringify(event.after);
    expect(after).not.toContain(email);
    expect(after).not.toContain(phone);
    expect(after.length).toBeLessThan(500);
  });
  it('legacy callers without key remain valid but do not gain retry protection', async () => {
    const a = await run(() => catalog.createEmployee(input));
    const b = await run(() => catalog.createEmployee(input));
    expect(a.id).not.toBe(b.id);
  });
  it('services revision rejects a second valid stale replace and profile does not restore skills', async () => {
    const employee = await run(() =>
      catalog.createEmployee({ ...input, creationId: randomUUID() }),
    );
    const service = await run(() =>
      catalog.createService({
        name: 'Услуга',
        durationMinutes: '30',
        priceMinor: '0',
        currency: 'KZT',
      }),
    );
    const revision = employee.servicesRevision;
    await run(() =>
      catalog.setEmployeeServices(employee.id, {
        serviceIds: [service.id],
        expectedRevision: revision,
      }),
    );
    await expect(
      run(() =>
        catalog.setEmployeeServices(employee.id, { serviceIds: [], expectedRevision: revision }),
      ),
    ).rejects.toThrow('другом окне');
    await run(() => catalog.updateEmployee(employee.id, { name: 'Новое имя', expectedProfileRevision: employee.profileRevision }));
    const saved = (await run(() => catalog.employees())).items.find((e) => e.id === employee.id)!;
    expect(saved.name).toBe('Новое имя');
    expect(saved.serviceIds).toEqual([service.id]);
  });
  it('week snapshot/revision are compatible and stale replace cannot overwrite', async () => {
    const employee = await run(() =>
      catalog.createEmployee({ ...input, creationId: randomUUID() }),
    );
    const state = await run(() => schedule.overview(employee.id));
    await run(() =>
      schedule.setWorkingHours(employee.id, {
        intervals: [{ weekday: 1, timeFrom: '09:00', timeTo: '12:00' }],
        expectedRevision: state.weekRevision,
      }),
    );
    await expect(
      run(() =>
        schedule.setWorkingHours(employee.id, {
          intervals: [],
          expectedRevision: state.weekRevision,
        }),
      ),
    ).rejects.toThrow('другом окне');
    expect(
      (await run(() => schedule.overview(employee.id))).week.find((d) => d.weekday === 1)
        ?.intervals,
    ).toEqual([{ timeFrom: '09:00', timeTo: '12:00' }]);
  });
});
