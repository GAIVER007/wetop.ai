import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { SharedOnboardingService } from '../../apps/api/src/onboarding/onboarding.module';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { isLocalDatabase } from '../tools/seed-local';

describe.skipIf(!process.env.DATABASE_URL)('MV3 durable progress', () => {
  let db: Db;
  let service: SharedOnboardingService;
  const org = randomUUID();
  const user = randomUUID();
  const business = randomUUID();
  const location = randomUUID();
  const otherBusiness = randomUUID();
  const otherLocation = randomUUID();
  const actor = {
    userId: user,
    organizationId: org,
    role: 'OWNER' as const,
    scope: 'LOCATION' as const,
    businessId: business,
    locationId: location,
    vertical: 'BEAUTY' as const,
  };
  const draft = {
    businessName: 'MV3 Тестовый салон',
    locationName: 'Тестовый филиал',
    timezone: 'Asia/Almaty',
    currency: 'KZT',
  };
  const run = <T>(fn: () => Promise<T>) => withSignedInUser(actor, fn);
  beforeAll(async () => {
    if (!isLocalDatabase(process.env.DATABASE_URL!))
      throw new Error('MV3 requires isolated localhost database');
    db = createPrismaClient(process.env.DATABASE_URL, 'pms_test');
    service = new SharedOnboardingService({ db } as never);
    await db.organization.create({ data: { id: org, name: 'MV3 synthetic', status: 'ACTIVE' } });
    await db.user.create({
      data: { id: user, email: `mv3-${user}@example.invalid`, name: 'Тестовый владелец' },
    });
    await db.business.create({
      data: { id: business, organizationId: org, name: draft.businessName, vertical: 'BEAUTY' },
    });
    await db.business.create({
      data: { id: otherBusiness, organizationId: org, name: 'MV3 Food', vertical: 'FOOD_SERVICE' },
    });
    await db.location.create({
      data: {
        id: location,
        businessId: business,
        name: draft.locationName,
        timezone: draft.timezone,
        currency: draft.currency,
      },
    });
    await db.location.create({
      data: {
        id: otherLocation,
        businessId: otherBusiness,
        name: 'MV3 Food location',
        timezone: draft.timezone,
        currency: draft.currency,
      },
    });
  });
  afterAll(async () => {
    if (!db) return;
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('wetop.audit_purge', 'on', true)`;
      await tx.auditLog.deleteMany({ where: { userId: user } });
      await tx.onboardingProgress.deleteMany({
        where: { locationId: { in: [location, otherLocation] } },
      });
      await tx.location.deleteMany({ where: { businessId: { in: [business, otherBusiness] } } });
      await tx.business.deleteMany({ where: { organizationId: org } });
      await tx.user.delete({ where: { id: user } });
      await tx.organization.delete({ where: { id: org } });
    });
    await db.$disconnect();
  });
  it('persists steps and values across fresh service reads; completes without Property', async () => {
    let state = await run(() => service.status());
    expect(state.currentStep).toBe('business');
    state = await run(() => service.save({ action: 'next', draft, updatedAt: state.updatedAt }));
    expect(state.currentStep).toBe('location');
    const fresh = new SharedOnboardingService({ db } as never);
    expect(await run(() => fresh.status())).toMatchObject({ currentStep: 'location', draft });
    state = await run(() => service.save({ action: 'back', draft, updatedAt: state.updatedAt }));
    expect(state.currentStep).toBe('business');
    state = await run(() => service.save({ action: 'next', draft, updatedAt: state.updatedAt }));
    state = await run(() => service.save({ action: 'next', draft, updatedAt: state.updatedAt }));
    expect(state.currentStep).toBe('review');
    state = await run(() =>
      service.save({ action: 'complete', draft, updatedAt: state.updatedAt }),
    );
    expect(state.completedAt).not.toBeNull();
    expect(await db.property.count({ where: { organizationId: org } })).toBe(0);
    expect(await db.location.findUnique({ where: { id: location } })).toMatchObject({
      name: draft.locationName,
    });
    await expect(
      run(() => service.save({ action: 'save', draft, updatedAt: state.updatedAt })),
    ).rejects.toThrow('уже завершена');
  });
  it('Food flow saves separately and stale tab cannot overwrite latest progress', async () => {
    const foodActor = {
      ...actor,
      businessId: otherBusiness,
      locationId: otherLocation,
      vertical: 'FOOD_SERVICE' as const,
    };
    const results = await Promise.allSettled(
      [1, 2].map(() =>
        withSignedInUser(foodActor, () => service.save({ action: 'next', draft, updatedAt: null })),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(await withSignedInUser(foodActor, () => service.status())).toMatchObject({
      vertical: 'FOOD_SERVICE',
      currentStep: 'location',
    });
  });
  it('an invalid Location draft can go back and return to its editable step', async () => {
    const foodActor = {
      ...actor,
      businessId: otherBusiness,
      locationId: otherLocation,
      vertical: 'FOOD_SERVICE' as const,
    };
    const food = <T>(fn: () => Promise<T>) => withSignedInUser(foodActor, fn);
    let state = await food(() => service.status());
    const invalid = { ...draft, timezone: 'not-a-timezone' };
    state = await food(() =>
      service.save({ action: 'back', draft: invalid, updatedAt: state.updatedAt }),
    );
    state = await food(() =>
      service.save({ action: 'next', draft: invalid, updatedAt: state.updatedAt }),
    );
    expect(state.currentStep).toBe('location');
    await expect(
      food(() => service.save({ action: 'next', draft: invalid, updatedAt: state.updatedAt })),
    ).rejects.toThrow();
    expect((await food(() => service.status())).updatedAt).toBe(state.updatedAt);
    state = await food(() => service.save({ action: 'next', draft, updatedAt: state.updatedAt }));
    state = await food(() =>
      service.save({ action: 'complete', draft, updatedAt: state.updatedAt }),
    );
    expect(state.completedAt).not.toBeNull();
  });
  it('cross-business, cross-organization and READ_ONLY mutations are rejected', async () => {
    await expect(
      withSignedInUser({ ...actor, locationId: otherLocation }, () =>
        service.save({ action: 'next', draft }),
      ),
    ).rejects.toThrow();
    await expect(
      withSignedInUser({ ...actor, organizationId: randomUUID() }, () => service.status()),
    ).rejects.toThrow();
    await expect(
      withSignedInUser({ ...actor, role: 'STAFF' }, () => service.save({ action: 'next', draft })),
    ).rejects.toThrow();
  });
  it('READ_ONLY organization blocks owner mutations and keeps read access', async () => {
    await db.organization.update({ where: { id: org }, data: { status: 'READ_ONLY' } });
    expect(await run(() => service.status())).toMatchObject({ canEdit: false });
    await expect(run(() => service.save({ action: 'save', draft }))).rejects.toThrow();
    await db.organization.update({ where: { id: org }, data: { status: 'ACTIVE' } });
  });
  it('RLS hides progress owned by another organization', async () => {
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE wetop_app');
      await tx.$executeRaw`SELECT set_config('app.org_id', ${randomUUID()}, true)`;
      expect(await tx.onboardingProgress.findMany({ where: { locationId: location } })).toEqual([]);
      await tx.$executeRaw`SELECT set_config('app.org_id', ${org}, true)`;
      expect(await tx.onboardingProgress.count({ where: { locationId: location } })).toBe(1);
    });
  });
});
