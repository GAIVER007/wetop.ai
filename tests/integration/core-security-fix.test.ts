import { randomUUID } from 'node:crypto';
import { ForbiddenException } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPrismaClient,
  createPropertyInChain,
  NEW_PROPERTY_DEFAULTS,
  type Db,
} from '@pms/database';
import { PrismaGuestsRepository } from '../../apps/api/src/guests/guests.repository';
import { BeautyScheduleService } from '../../apps/api/src/beauty/schedule';
import { SharedOnboardingService } from '../../apps/api/src/onboarding/onboarding.module';
import { OnboardingService } from '../../apps/api/src/hotel/onboarding';
import { propertyRef } from '../../apps/api/src/database/property-ref';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';

const url = process.env.DATABASE_URL;

/** CORE-SECURITY-FIX (ADR-183): границы назначений и Property-fallback по итогам CORE-01. */
describe.skipIf(!url)('CORE-SECURITY-FIX: границы скоупа (настоящая PostgreSQL)', () => {
  let db: Db, prisma: PrismaService;
  const org = randomUUID(),
    user = randomUUID();
  let hotelBusiness: string,
    locationA: string,
    propertyA: string,
    propertyB: string;
  let beautyBusiness: string, beautyL1: string, beautyL2: string, master: string;
  let guestA: string, guestB: string, guestNew: string;

  const actor = (over: Record<string, unknown> = {}) => ({
    userId: user,
    organizationId: org,
    role: 'MANAGER' as const,
    ...over,
  });

  beforeAll(async () => {
    db = createPrismaClient(url);
    prisma = { db } as PrismaService;
    await db.organization.create({
      data: { id: org, name: 'ADR-183 synthetic', status: 'ACTIVE' },
    });
    await db.user.create({
      data: { id: user, name: 'Synthetic staff', email: `adr183-${user}@example.invalid` },
    });
    const pa = await createPropertyInChain(db, org, {
      name: 'ADR183 Hotel A',
      ...NEW_PROPERTY_DEFAULTS,
    });
    propertyA = pa.id;
    locationA = pa.locationId;
    hotelBusiness = (
      await db.location.findUniqueOrThrow({
        where: { id: locationA },
        select: { businessId: true },
      })
    ).businessId;
    const pb = await createPropertyInChain(
      db,
      org,
      { name: 'ADR183 Hotel B', ...NEW_PROPERTY_DEFAULTS },
      hotelBusiness,
    );
    propertyB = pb.id;

    const beauty = await db.business.create({
      data: { organizationId: org, name: 'ADR183 салон', vertical: 'BEAUTY' },
    });
    beautyBusiness = beauty.id;
    const mkLoc = (name: string) =>
      db.location.create({
        data: { businessId: beautyBusiness, name, timezone: 'Asia/Almaty', currency: 'KZT' },
      });
    beautyL1 = (await mkLoc('Салон 1')).id;
    beautyL2 = (await mkLoc('Салон 2')).id;
    const employee = await db.employee.create({
      data: { businessId: beautyBusiness, name: 'Мастер Синтетик' },
    });
    master = employee.id;
    await db.employeeLocation.create({ data: { employeeId: master, locationId: beautyL1 } });

    const mkGuest = (lastName: string) =>
      db.guest.create({ data: { organizationId: org, firstName: 'Гость', lastName } });
    guestA = (await mkGuest('Объекта-А')).id;
    guestB = (await mkGuest('Объекта-Б')).id;
    guestNew = (await mkGuest('Без-Брони')).id;
    const mkReservation = (propertyId: string, guestId: string, n: string) =>
      db.reservation.create({
        data: {
          propertyId,
          confirmationNumber: `ADR183-${n}-${org.slice(0, 8)}`,
          source: 'DESK',
          status: 'CONFIRMED',
          arrivalDate: new Date('2099-01-02'),
          departureDate: new Date('2099-01-05'),
          adults: 1,
          currency: 'KZT',
          totalAmount: 100_000n,
          primaryGuestId: guestId,
        },
      });
    await mkReservation(propertyA, guestA, 'A');
    await mkReservation(propertyB, guestB, 'B');
  });

  afterAll(async () => {
    await db.reservation.deleteMany({ where: { property: { organizationId: org } } });
    await db.guest.deleteMany({ where: { organizationId: org } });
    await db.workingHours.deleteMany({ where: { employee: { businessId: beautyBusiness } } });
    await db.employeeLocation.deleteMany({ where: { employee: { businessId: beautyBusiness } } });
    await db.employee.deleteMany({ where: { businessId: beautyBusiness } });
    await db.property.deleteMany({ where: { organizationId: org } });
    await db.location.deleteMany({ where: { business: { organizationId: org } } });
    await db.business.deleteMany({ where: { organizationId: org } });
    await db.user.delete({ where: { id: user } });
    await db.organization.delete({ where: { id: org } });
  });

  // ── U2-2: гость для назначенного сотрудника — гость его мест ──

  it('назначенный на объект A не видит гостя объекта B, свой и новый видит', async () => {
    const repo = new PrismaGuestsRepository(prisma);
    const restrictedToA = actor({
      role: 'STAFF' as const,
      scope: 'LOCATION' as const,
      businessId: hotelBusiness,
      locationId: locationA,
      vertical: 'HOSPITALITY' as const,
      scopes: [{ role: 'STAFF', businessId: hotelBusiness, locationId: locationA }],
    });
    const [own, foreign, fresh] = await withSignedInUser(restrictedToA, async () => [
      await repo.byId(guestA),
      await repo.byId(guestB),
      await repo.byId(guestNew),
    ]);
    expect(own?.id).toBe(guestA);
    expect(fresh?.id).toBe(guestNew);
    expect(foreign).toBeNull();
  });

  it('без назначений гости организации видны целиком, как раньше', async () => {
    const repo = new PrismaGuestsRepository(prisma);
    const owner = actor({ role: 'OWNER' as const });
    const foreign = await withSignedInUser(owner, () => repo.byId(guestB));
    expect(foreign?.id).toBe(guestB);
  });

  // ── U2-3: филиалы мастера меняет только тот, кому они назначены ──

  it('назначенный на один салон не добавит мастеру чужой филиал', async () => {
    const svc = new BeautyScheduleService(prisma);
    const restricted = actor({
      scope: 'LOCATION' as const,
      businessId: beautyBusiness,
      locationId: beautyL1,
      vertical: 'BEAUTY' as const,
      scopes: [{ role: 'MANAGER', businessId: beautyBusiness, locationId: beautyL1 }],
    });
    await expect(
      withSignedInUser(restricted, () =>
        svc.setLocations(master, { locationIds: [beautyL1, beautyL2] }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const rows = await db.employeeLocation.findMany({ where: { employeeId: master } });
    expect(rows.map((r) => r.locationId)).toEqual([beautyL1]);
  });

  // ── U2-4: онбординг подчиняется назначениям ──

  it('self-онбординг чужого филиала для назначенного закрыт', async () => {
    const onboarding = new SharedOnboardingService(prisma);
    const restricted = actor({
      scope: 'LOCATION' as const,
      businessId: beautyBusiness,
      locationId: beautyL2,
      vertical: 'BEAUTY' as const,
      scopes: [{ role: 'MANAGER', businessId: beautyBusiness, locationId: beautyL1 }],
    });
    await expect(withSignedInUser(restricted, () => onboarding.status())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    const assigned = actor({
      scope: 'LOCATION' as const,
      businessId: beautyBusiness,
      locationId: beautyL1,
      vertical: 'BEAUTY' as const,
      scopes: [{ role: 'MANAGER', businessId: beautyBusiness, locationId: beautyL1 }],
    });
    await expect(withSignedInUser(assigned, () => onboarding.status())).resolves.toBeTruthy();
  });

  // ── U1-C: новый бизнес из гостиничного онбординга — только владелец ──

  it('менеджер организации без отеля не создаст гостиничный бизнес онбордингом', async () => {
    const foodOrg = randomUUID();
    await db.organization.create({
      data: { id: foodOrg, name: 'ADR-183 food-only', status: 'ACTIVE' },
    });
    const food = await db.business.create({
      data: { organizationId: foodOrg, name: 'ADR183 ресторан', vertical: 'FOOD_SERVICE' },
    });
    await db.location.create({
      data: { businessId: food.id, name: 'Ресторан', timezone: 'Asia/Almaty', currency: 'KZT' },
    });
    const svc = new OnboardingService(prisma, { forget() {} } as never);
    const setup = {
      currency: 'KZT',
      categories: [
        { name: 'Номер', kind: 'PRIVATE_ROOM', capacityAdults: 2, units: 1, priceMinor: 100000 },
      ],
    };
    try {
      await expect(
        withSignedInUser({ userId: user, organizationId: foodOrg, role: 'MANAGER' }, () =>
          svc.provision(setup),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(
        await db.business.count({ where: { organizationId: foodOrg, vertical: 'HOSPITALITY' } }),
      ).toBe(0);
    } finally {
      await db.$transaction([
        db.dailyRate.deleteMany({ where: { ratePlan: { property: { organizationId: foodOrg } } } }),
        db.ratePlanAccommodationType.deleteMany({
          where: { ratePlan: { property: { organizationId: foodOrg } } },
        }),
        db.ratePlan.deleteMany({ where: { property: { organizationId: foodOrg } } }),
        db.inventoryUnit.deleteMany({ where: { property: { organizationId: foodOrg } } }),
        db.accommodationType.deleteMany({ where: { property: { organizationId: foodOrg } } }),
        db.floor.deleteMany({ where: { building: { property: { organizationId: foodOrg } } } }),
        db.building.deleteMany({ where: { property: { organizationId: foodOrg } } }),
        db.property.deleteMany({ where: { organizationId: foodOrg } }),
        db.location.deleteMany({ where: { business: { organizationId: foodOrg } } }),
        db.business.deleteMany({ where: { organizationId: foodOrg } }),
        db.organization.delete({ where: { id: foodOrg } }),
      ]);
    }
  });

  // ── U1-D: ранний Property — только живой ──

  it('организационный скоуп не берёт Property архивного филиала', async () => {
    const archOrg = randomUUID();
    await db.organization.create({
      data: { id: archOrg, name: 'ADR-183 archived-first', status: 'ACTIVE' },
    });
    try {
      const first = await createPropertyInChain(db, archOrg, {
        name: 'ADR183 Старый',
        ...NEW_PROPERTY_DEFAULTS,
      });
      await db.location.update({ where: { id: first.locationId }, data: { status: 'ARCHIVED' } });
      const second = await createPropertyInChain(db, archOrg, {
        name: 'ADR183 Живой',
        ...NEW_PROPERTY_DEFAULTS,
      });
      const picked = await withSignedInUser(
        { userId: user, organizationId: archOrg, role: 'OWNER' },
        () => propertyRef(db, 'ADR183 Старый'),
      );
      expect(picked.id).toBe(second.id);
    } finally {
      await db.property.deleteMany({ where: { organizationId: archOrg } });
      await db.location.deleteMany({ where: { business: { organizationId: archOrg } } });
      await db.business.deleteMany({ where: { organizationId: archOrg } });
      await db.organization.delete({ where: { id: archOrg } });
    }
  });
});
