import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db, type DbTx } from '@pms/database';
import { SharedOnboardingService } from '../../apps/api/src/onboarding/onboarding.module';
import { BeautyCatalogService } from '../../apps/api/src/beauty/beauty.module';
import { BeautyScheduleService } from '../../apps/api/src/beauty/schedule';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { isLocalDatabase } from '../tools/seed-local';

describe.skipIf(!process.env.DATABASE_URL)('Beauty v2 real database', () => {
  let db: Db;
  let onboarding: SharedOnboardingService;
  let catalog: BeautyCatalogService;
  let schedule: BeautyScheduleService;
  const org = randomUUID();
  const user = randomUUID();
  let business: string;
  let location: string;
  const draft = {
    businessName: 'Синтетический салон',
    locationName: 'Тестовый филиал',
    timezone: 'Asia/Almaty',
    currency: 'KZT',
  };
  const input = {
    name: 'Тестовая услуга',
    durationMinutes: '60',
    priceMinor: '0',
    currency: 'KZT',
    active: true,
  };
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
  const values = (state: Awaited<ReturnType<SharedOnboardingService['status']>>) =>
    Object.fromEntries(Object.keys(draft).map((k) => [k, (state.draft as Record<string, unknown>)[k]]));
  const save = async (action: string) => {
    const state = await run(() => onboarding.status());
    return run(() => onboarding.save({ action, draft: values(state), updatedAt: state.updatedAt }));
  };
  beforeAll(async () => {
    if (!isLocalDatabase(process.env.DATABASE_URL!))
      throw new Error('Own localhost database required');
    process.env.SESSION_SECRET = 'local-onboarding-contract-key-not-production';
    db = createPrismaClient(process.env.DATABASE_URL, 'pms_test');
    const prisma = { db } as never;
    onboarding = new SharedOnboardingService(prisma);
    catalog = new BeautyCatalogService(prisma);
    schedule = new BeautyScheduleService(prisma);
    await db.organization.create({
      data: { id: org, name: 'Onboarding synthetic tenant', status: 'ACTIVE' },
    });
    await db.user.create({
      data: { id: user, email: `onboarding-${user}@example.invalid`, name: 'Тестовый владелец' },
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
      data: { id: business, organizationId: org, name: draft.businessName, vertical: 'BEAUTY' },
    });
    await db.location.create({
      data: {
        id: location,
        businessId: business,
        name: draft.locationName,
        currency: 'KZT',
        timezone: 'Asia/Almaty',
      },
    });
  });
  afterAll(async () => {
    if (!db) return;
    const businesses = await db.business.findMany({
      where: { organizationId: org },
      select: { id: true },
    });
    const ids = businesses.map((b) => b.id);
    const locs = await db.location.findMany({
      where: { businessId: { in: ids } },
      select: { id: true },
    });
    const ls = locs.map((l) => l.id);
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('wetop.audit_purge', 'on', true)`;
      await tx.auditLog.deleteMany({ where: { organizationId: org } });
      await tx.auditLog.deleteMany({ where: { userId: user } });
      await tx.workingHours.deleteMany({ where: { locationId: { in: ls } } });
      await tx.employeeService.deleteMany({ where: { employee: { businessId: { in: ids } } } });
      await tx.employeeLocation.deleteMany({ where: { locationId: { in: ls } } });
      await tx.locationService.deleteMany({ where: { locationId: { in: ls } } });
      await tx.timeOff.deleteMany({ where: { employee: { businessId: { in: ids } } } });
      await tx.employee.deleteMany({ where: { businessId: { in: ids } } });
      await tx.beautyService.deleteMany({ where: { businessId: { in: ids } } });
      await tx.onboardingProgress.deleteMany({ where: { locationId: { in: ls } } });
      await tx.location.deleteMany({ where: { id: { in: ls } } });
      await tx.business.deleteMany({ where: { id: { in: ids } } });
      await tx.user.delete({ where: { id: user } });
      await tx.organization.delete({ where: { id: org } });
    });
    await db.$disconnect();
  });
  const profile = async () => {
    await save('next');
    await save('apply-profile');
  };
  const chain = async () => {
    await profile();
    const service = await run(() => catalog.createService({ ...input, creationId: randomUUID() }));
    await run(() => catalog.setLocationService(service.id, { enabled: true }));
    const employee = await run(() =>
      catalog.createEmployee({ name: 'Тестовый мастер', active: true, creationId: randomUUID() }),
    );
    await run(() => catalog.setEmployeeServices(employee.id, { serviceIds: [service.id] }));
    await run(async () =>
      schedule.setWorkingHours(employee.id, { expectedRevision: (await schedule.overview(employee.id)).weekRevision,
        intervals: [{ weekday: 1, timeFrom: '09:00', timeTo: '10:00' }],
      }),
    );
    // Weekly setup advances the common source version; the scenario starts from this snapshot.
    const readyEmployee = (await run(() => catalog.employees())).items.find((e) => e.id === employee.id)!;
    expect(readyEmployee.profileRevision).not.toBe(employee.profileRevision);
    return { service, employee: readyEmployee };
  };
  it('O04: an empty pilot must not complete as ready', async () => {
    const state = await run(() => onboarding.status());
    if (state.flowVersion === 1) {
      await save('next');
      await save('next');
    }
    await expect(save('complete')).rejects.toThrow();
    expect(await db.appointment.count({ where: { locationId: location } })).toBe(0);
  });
  it('O07: concurrent create retries return one resource and original receipt', async () => {
    const creationId = randomUUID();
    const results = await Promise.all(
      [1, 2].map(() =>
        run(() => catalog.createEmployee({ name: 'Тестовый мастер', active: true, creationId })),
      ),
    );
    expect(results.map((r) => r.id)).toEqual([creationId, creationId]);
    expect(await db.employee.count({ where: { businessId: business } })).toBe(1);
    await run(() => catalog.updateEmployee(creationId, { name: 'Изменённый мастер', expectedProfileRevision: results[0]!.profileRevision }));
    expect(
      (
        await run(() =>
          catalog.createEmployee({ name: 'Тестовый мастер', active: true, creationId }),
        )
      ).name,
    ).toBe('Изменённый мастер');
    await expect(
      run(() => catalog.createEmployee({ name: 'Другой запрос', active: true, creationId })),
    ).rejects.toThrow();
  });
  it('O07: service retries never implicitly enable Location and do not roll back edits', async () => {
    const creationId = randomUUID();
    const a = await run(() => catalog.createService({ ...input, creationId }));
    const b = await run(() => catalog.createService({ ...input, creationId }));
    expect(a.id).toBe(b.id);
    expect(await db.locationService.count({ where: { locationId: location } })).toBe(0);
    await run(() => catalog.updateService(a.id, { name: 'Изменённая услуга' }));
    expect((await run(() => catalog.createService({ ...input, creationId }))).name).toBe(
      'Изменённая услуга',
    );
  });
  it('O07/O17: missing receipt or different Location cannot claim an existing PK', async () => {
    const creationId = randomUUID();
    await db.employee.create({
      data: { id: creationId, businessId: business, name: 'Тестовый мастер' },
    });
    await expect(
      run(() => catalog.createEmployee({ name: 'Тестовый мастер', active: true, creationId })),
    ).rejects.toThrow();
  });
  it('O09/O11/O24: linked future weekly configuration is ready; completion creates no appointment', async () => {
    await chain();
    expect(await run(() => onboarding.status())).toMatchObject({
      readiness: { ready: true },
      currentStep: 'review',
    });
    const completed = await save('complete');
    expect(completed).toMatchObject({ completedFlowVersion: 2, readiness: { ready: true } });
    expect((await save('complete')).completedAt).toBe(completed.completedAt);
    expect(await db.appointment.count({ where: { locationId: location } })).toBe(0);
    const fresh = new SharedOnboardingService({ db } as never);
    expect(await run(() => fresh.status())).toMatchObject({ completedFlowVersion: 2 });
  });
  it('O10/O12: unrelated hours and intervals separated by a break are not ready', async () => {
    const { employee } = await chain();
    await run(async () =>
      schedule.setWorkingHours(employee.id, { expectedRevision: (await schedule.overview(employee.id)).weekRevision,
        intervals: [
          { weekday: 1, timeFrom: '09:00', timeTo: '09:30' },
          { weekday: 1, timeFrom: '10:00', timeTo: '10:30' },
        ],
      }),
    );
    expect(await run(() => onboarding.status())).toMatchObject({ readiness: { ready: false } });
    await expect(save('complete')).rejects.toThrow();
  });
  it('O14: resource loss preserves history and exposes honest readiness', async () => {
    const { employee } = await chain();
    const state = await save('complete');
    await run(() => catalog.updateEmployee(employee.id, { active: false, expectedProfileRevision: employee.profileRevision }));
    expect(await run(() => onboarding.status())).toMatchObject({
      completedAt: state.completedAt,
      completedFlowVersion: 2,
      readiness: { ready: false },
    });
  });
  it('O19: v1 pilot read is non-mutating, conversion preserves completedAt, stale tab is rejected', async () => {
    const historic = new Date('2026-10-01T12:00:00Z');
    await db.onboardingProgress.create({
      data: {
        locationId: location,
        flowVersion: 1,
        currentStep: 'review',
        draft,
        completedAt: historic,
      },
    });
    const old = await run(() => onboarding.status());
    expect(old.flowVersion).toBe(2);
    expect(
      (await db.onboardingProgress.findUniqueOrThrow({ where: { locationId: location } }))
        .flowVersion,
    ).toBe(1);
    const payload = { action: 'apply-profile', draft, updatedAt: old.updatedAt };
    const results = await Promise.allSettled([1, 2].map(() => run(() => onboarding.save(payload))));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      (await db.onboardingProgress.findUniqueOrThrow({ where: { locationId: location } }))
        .completedAt,
    ).toEqual(historic);
  });
  it('O06: two skills replaces cannot both overwrite the same revision', async () => {
    const { employee } = await chain();
    const row = (await run(() => catalog.employees())).items.find((e) => e.id === employee.id)!;
    const expectedRevision = (row as typeof row & { servicesRevision: string }).servicesRevision;
    expect(expectedRevision).toMatch(/^[a-f0-9]{64}$/);
    const other = await run(() => catalog.createService({ ...input, name: 'Вторая услуга' }));
    const results = await Promise.allSettled(
      [[], [other.id]].map((serviceIds) =>
        run(() => catalog.setEmployeeServices(employee.id, { serviceIds, expectedRevision })),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      (results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason.message,
    ).toContain('другом окне');
  });
  it('O06: two week replaces check revision in the writing transaction', async () => {
    const { employee } = await chain();
    const overview = await run(() => schedule.overview(employee.id));
    const expectedRevision = (overview as typeof overview & { weekRevision: string }).weekRevision;
    expect(expectedRevision).toMatch(/^[a-f0-9]{64}$/);
    const results = await Promise.allSettled(
      ['10:30', '11:00'].map((timeTo) =>
        run(() =>
          schedule.setWorkingHours(employee.id, {
            intervals: [{ weekday: 1, timeFrom: '09:00', timeTo }],
            expectedRevision,
          }),
        ),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });
  it('O07: atomic failure of receipt rolls back Employee and first Location assignment', async () => {
    const creationId = randomUUID();
    const failing = new Proxy(db, {
      get(target, key) {
        if (key === '$transaction')
          return (fn: (tx: DbTx) => Promise<unknown>) =>
            target.$transaction((tx) =>
              fn(
                new Proxy(tx, {
                  get(t, property) {
                    if (property === 'auditLog')
                      return {
                        ...t.auditLog,
                        create: async () => {
                          throw new Error('Injected receipt failure');
                        },
                      };
                    return Reflect.get(t, property);
                  },
                }),
              ),
            );
        return Reflect.get(target, key);
      },
    });
    const instance = new BeautyCatalogService({ db: failing } as never);
    await expect(
      run(() => instance.createEmployee({ name: 'Тестовый мастер', active: true, creationId })),
    ).rejects.toThrow('Injected');
    expect(await db.employee.count({ where: { id: creationId } })).toBe(0);
    expect(await db.employeeLocation.count({ where: { employeeId: creationId } })).toBe(0);
    expect(await db.auditLog.count({ where: { entityId: creationId } })).toBe(0);
  });
  it('O07/O17: replay requires the original initiator, Location and still-active resource', async () => {
    const creationId = randomUUID();
    const body = { name: 'Тестовый мастер', active: true, creationId };
    const employee = await run(() => catalog.createEmployee(body));
    const fresh = new BeautyCatalogService({ db } as never);
    expect((await run(() => fresh.createEmployee(body))).id).toBe(creationId);
    await expect(
      withSignedInUser({ ...actor(), userId: randomUUID() }, () => fresh.createEmployee(body)),
    ).rejects.toThrow('не подтверждено');
    const second = await db.location.create({
      data: {
        businessId: business,
        name: 'Второй филиал',
        timezone: 'Asia/Almaty',
        currency: 'KZT',
      },
    });
    await expect(
      withSignedInUser({ ...actor(), locationId: second.id }, () => fresh.createEmployee(body)),
    ).rejects.toThrow('не подтверждено');
    await run(() => catalog.updateEmployee(creationId, { active: false, expectedProfileRevision: employee.profileRevision }));
    await expect(run(() => fresh.createEmployee(body))).rejects.toThrow('архиве');
    expect(await db.employee.count({ where: { businessId: business } })).toBe(1);
    expect(await db.employeeLocation.count({ where: { employeeId: creationId } })).toBe(1);
  });
  it('O07: receipt purge fails closed rather than claiming or duplicating the remaining resource', async () => {
    const creationId = randomUUID();
    const body = { name: 'Тестовый мастер', active: true, creationId };
    await run(() => catalog.createEmployee(body));
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('wetop.audit_purge', 'on', true)`;
      await tx.auditLog.deleteMany({ where: { entityId: creationId } });
    });
    await expect(run(() => catalog.createEmployee(body))).rejects.toThrow('не подтверждено');
    expect(await db.employee.count({ where: { businessId: business } })).toBe(1);
  });
  it('O05: profile apply changes no shared Business row when name is unchanged', async () => {
    const before = await db.business.findUniqueOrThrow({ where: { id: business } });
    await profile();
    const after = await db.business.findUniqueOrThrow({ where: { id: business } });
    expect(after.updatedAt).toEqual(before.updatedAt);
    expect(await run(() => onboarding.status())).toMatchObject({ profileApplied: true });
  });
  it('O11: finite TimeOff does not erase a suitable weekly configuration', async () => {
    const { employee } = await chain();
    await run(() =>
      schedule.addTimeOff(employee.id, {
        dateFrom: '2026-10-19',
        dateTo: '2026-10-20',
        reason: 'Синтетическое отсутствие',
      }),
    );
    expect(await run(() => onboarding.status())).toMatchObject({ readiness: { ready: true } });
  });
  it('O15/O18: role change and expired trial block retry and completion without losing saved data', async () => {
    const { employee } = await chain();
    await expect(
      withSignedInUser({ ...actor(), role: 'STAFF' as const }, () =>
        onboarding.save({ action: 'complete', draft }),
      ),
    ).rejects.toThrow();
    await db.organization.update({
      where: { id: org },
      data: { status: 'TRIAL', trialEndsAt: new Date('2000-01-01T00:00:00Z') },
    });
    expect(await run(() => onboarding.status())).toMatchObject({
      canEdit: false,
      readiness: { ready: true },
    });
    await expect(
      run(() =>
        catalog.createEmployee({ name: 'Тестовый мастер', active: true, creationId: employee.id }),
      ),
    ).rejects.toThrow('чтения');
    await expect(save('complete')).rejects.toThrow('чтения');
    expect(await db.employee.count({ where: { businessId: business } })).toBe(1);
  });
  it('O19: unfinished v1 draft survives normalization; future versions fail without mutation', async () => {
    const typed = { ...draft, businessName: 'Набранный черновик' };
    await db.onboardingProgress.create({
      data: { locationId: location, flowVersion: 1, currentStep: 'location', draft: typed },
    });
    expect(await run(() => onboarding.status())).toMatchObject({
      draft: typed,
      currentStep: 'profile',
      completedAt: null,
    });
    await db.onboardingProgress.update({
      where: { locationId: location },
      data: { flowVersion: 99 },
    });
    await expect(run(() => onboarding.status())).rejects.toThrow('не поддерживается');
    expect(
      (await db.onboardingProgress.findUniqueOrThrow({ where: { locationId: location } }))
        .flowVersion,
    ).toBe(99);
  });
  it('O08/O17: client ready/currentStep/protected metadata cannot assert readiness', async () => {
    await expect(
      run(() => onboarding.save({ action: 'complete', draft, ready: true, currentStep: 'review' })),
    ).rejects.toThrow('Неизвестное');
    await expect(
      run(() =>
        onboarding.save({
          action: 'apply-profile',
          draft: { ...draft, profileApplied: true },
          updatedAt: null,
        }),
      ),
    ).rejects.toThrow('Неизвестное');
    expect(await db.onboardingProgress.count({ where: { locationId: location } })).toBe(0);
  });
  it.each([
    'employee archive',
    'service archive',
    'disable location service',
    'clear skills',
    'shorten hours',
  ])('complete waits for concurrent %s and rejects the now-incomplete chain', async (kind) => {
    const { employee, service } = await chain();
    const state = await run(() => onboarding.status());
    let unlock!: () => void;
    let locked!: () => void;
    const hold = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    const reached = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const blockedDb = new Proxy(db, {
      get(target, key) {
        if (key === '$transaction')
          return (fn: (tx: DbTx) => Promise<unknown>) =>
            target.$transaction(
              (tx) =>
                fn(
                  new Proxy(tx, {
                    get(t, property) {
                      if (property === '$queryRaw')
                        return async (...args: unknown[]) => {
                          const result = await (
                            t.$queryRaw as unknown as (...values: unknown[]) => Promise<unknown>
                          )(...args);
                          const sql = Array.isArray(args[0]) ? args[0].join('') : '';
                          if (sql.includes('businesses') && sql.includes('FOR UPDATE')) {
                            locked();
                            await hold;
                          }
                          return result;
                        };
                      return Reflect.get(t, property);
                    },
                  }),
                ),
              { timeout: 10000 },
            );
        return Reflect.get(target, key);
      },
    });
    const c = new BeautyCatalogService({ db: blockedDb } as never);
    const h = new BeautyScheduleService({ db: blockedDb } as never);
    const mutation = run<unknown>(async () =>
      kind === 'employee archive'
        ? c.updateEmployee(employee.id, { active: false, expectedProfileRevision: employee.profileRevision })
        : kind === 'service archive'
          ? c.updateService(service.id, { active: false })
          : kind === 'disable location service'
            ? c.setLocationService(service.id, { enabled: false })
            : kind === 'clear skills'
              ? c.setEmployeeServices(employee.id, { serviceIds: [] })
              : h.setWorkingHours(employee.id, { expectedRevision: (await schedule.overview(employee.id)).weekRevision,
                  intervals: [{ weekday: 1, timeFrom: '09:00', timeTo: '09:30' }],
                }),
    );
    await reached;
    const completing = run(() =>
      onboarding.save({ action: 'complete', draft, updatedAt: state.updatedAt }),
    ).then(
      (value) => ({ value, error: null }),
      (error) => ({ value: null, error }),
    );
    unlock();
    await mutation;
    const result = await completing;
    expect(result.error?.message).toContain('ещё не готов');
    expect(
      await db.auditLog.count({
        where: { entityId: location, action: 'onboarding.beauty.complete' },
      }),
    ).toBe(0);
    expect(await run(() => onboarding.status())).toMatchObject({
      readiness: { ready: false },
      completedAt: null,
    });
  });
});
