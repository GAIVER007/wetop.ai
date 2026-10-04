import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { AuthorInterceptor } from '../../apps/api/src/auth/author.interceptor';
import { RoleGuard } from '../../apps/api/src/auth/role.guard';
import { ConflictException } from '@nestjs/common';
import { createPrismaClient, type Db } from '@pms/database';
import { BeautyCatalogService, BeautyModule } from '../../apps/api/src/beauty/beauty.module';
import { BeautyAppointmentsService } from '../../apps/api/src/beauty/appointments';
import { BeautyScheduleService } from '../../apps/api/src/beauty/schedule';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';

const url = process.env.DATABASE_URL;
describe.skipIf(!url)('MV4 Beauty acceptance on PostgreSQL', () => {
  let db: Db;
  let app: INestApplication;
  let base: string;
  let catalog: BeautyCatalogService;
  let appointments: BeautyAppointmentsService;
  let schedule: BeautyScheduleService;
  const org = randomUUID(),
    foreignOrg = randomUUID(),
    user = randomUUID();
  const business = randomUUID(),
    secondBusiness = randomUUID(),
    foreignBusiness = randomUUID();
  const location = randomUUID(),
    secondLocation = randomUUID(),
    otherLocation = randomUUID();
  const employee = randomUUID(),
    service = randomUUID(),
    customer = randomUUID();
  const actor = {
    userId: user,
    organizationId: org,
    role: 'OWNER' as const,
    scope: 'LOCATION' as const,
    businessId: business,
    locationId: location,
    vertical: 'BEAUTY' as const,
  };
  type Actor = Exclude<Parameters<typeof withSignedInUser>[0], string | null>;
  type Patch = Partial<Omit<Actor, 'locationId'>> & { locationId?: string | null };
  const run = <T>(fn: () => Promise<T>, patch: Patch = {}) => {
    const { locationId, ...context } = { ...actor, ...patch };
    return withSignedInUser({ ...context, ...(locationId ? { locationId } : {}) }, fn);
  };
  const input = (hour = '10:00') => ({
    employeeId: employee,
    serviceId: service,
    startsAt: `2026-10-12T${hour}:00+05:00`,
    customerId: customer,
  });
  const svc = {
    name: 'Synthetic service',
    durationMinutes: 60,
    priceMinor: '12345',
    currency: 'KZT',
  };
  beforeAll(async () => {
    db = createPrismaClient(url);
    const prisma = { db } as unknown as PrismaService;
    catalog = new BeautyCatalogService(prisma);
    appointments = new BeautyAppointmentsService(prisma);
    schedule = new BeautyScheduleService(prisma);
    const module = await Test.createTestingModule({ imports: [BeautyModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = module.createNestApplication();
    // Only identity is synthetic; real RoleGuard, AuthorInterceptor, controllers, services and PostgreSQL.
    app.use(
      (
        req: { user?: object; headers: Record<string, string> },
        _res: unknown,
        next: () => void,
      ) => {
        req.user = {
          id: user,
          organizationId: org,
          role: req.headers['x-test-role'] === 'STAFF' ? 'STAFF' : 'OWNER',
        };
        next();
      },
    );
    app.useGlobalGuards(new RoleGuard(new Reflector()));
    app.useGlobalInterceptors(new AuthorInterceptor(prisma));
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();

    await db.organization.createMany({
      data: [org, foreignOrg].map((id) => ({ id, name: 'MV4 synthetic', status: 'ACTIVE' })),
    });
    await db.user.create({
      data: { id: user, name: 'Synthetic owner', email: `mv4-${user}@example.invalid` },
    });
    for (const [id, organizationId] of [
      [business, org],
      [secondBusiness, org],
      [foreignBusiness, foreignOrg],
    ])
      await db.business.create({
        data: { id: id!, organizationId: organizationId!, name: 'MV4 salon', vertical: 'BEAUTY' },
      });
    for (const [id, businessId] of [
      [location, business],
      [secondLocation, business],
      [otherLocation, secondBusiness],
    ])
      await db.location.create({
        data: {
          id: id!,
          businessId: businessId!,
          name: 'MV4 branch',
          timezone: 'Asia/Almaty',
          currency: 'KZT',
        },
      });
    await db.customer.create({
      data: { id: customer, organizationId: org, firstName: 'Synthetic client' },
    });
    await db.beautyService.create({
      data: {
        id: service,
        businessId: business,
        name: svc.name,
        durationMinutes: 60,
        price: 12345n,
        currency: 'KZT',
      },
    });
    await db.employee.create({
      data: { id: employee, businessId: business, name: 'Synthetic employee' },
    });
    for (const locationId of [location, secondLocation]) {
      await db.employeeLocation.create({ data: { employeeId: employee, locationId } });
      await db.locationService.create({ data: { serviceId: service, locationId, enabled: true } });
      await db.workingHours.create({
        data: {
          employeeId: employee,
          locationId,
          weekday: 1,
          timeFrom: new Date('1970-01-01T00:00:00Z'),
          timeTo: new Date('1970-01-01T23:59:00Z'),
        },
      });
    }
  });
  beforeEach(async () => {
    await db.appointment.deleteMany({
      where: { locationId: { in: [location, secondLocation, otherLocation] } },
    });
    await db.customerBusiness.deleteMany({ where: { customerId: customer } });
    await db.employeeService.upsert({
      where: { employeeId_serviceId: { employeeId: employee, serviceId: service } },
      create: { employeeId: employee, serviceId: service },
      update: {},
    });
  });
  afterAll(async () => {
    if (app) await app.close();
    if (!db) return;
    await db.$transaction(async (tx) => {
      const businesses = { in: [business, secondBusiness, foreignBusiness] };
      const locations = { in: [location, secondLocation, otherLocation] };
      await tx.appointment.deleteMany({ where: { locationId: locations } });
      await tx.timeOff.deleteMany({ where: { employee: { businessId: businesses } } });
      await tx.workingHours.deleteMany({ where: { locationId: locations } });
      await tx.employeeService.deleteMany({ where: { employee: { businessId: businesses } } });
      await tx.employeeLocation.deleteMany({ where: { locationId: locations } });
      await tx.locationService.deleteMany({ where: { locationId: locations } });
      await tx.customerBusiness.deleteMany({ where: { businessId: businesses } });
      await tx.customer.deleteMany({ where: { organizationId: { in: [org, foreignOrg] } } });
      await tx.employee.deleteMany({ where: { businessId: businesses } });
      await tx.beautyService.deleteMany({ where: { businessId: businesses } });
      await tx.$executeRaw`SELECT set_config('wetop.audit_purge', 'on', true)`;
      await tx.auditLog.deleteMany({ where: { organizationId: { in: [org, foreignOrg] } } });
      await tx.location.deleteMany({ where: { id: locations } });
      await tx.business.deleteMany({ where: { id: businesses } });
      await tx.organization.deleteMany({ where: { id: { in: [org, foreignOrg] } } });
      await tx.user.delete({ where: { id: user } });
    });
    await db.$disconnect();
  });
  it('empty employee skills do not authorize every service', async () => {
    await db.employeeService.deleteMany({ where: { employeeId: employee } });
    await expect(run(() => appointments.create(input()))).rejects.toThrow(/услугу не оказывает/);
    expect(await db.appointment.count({ where: { employeeId: employee } })).toBe(0);
  });
  it('READ_ONLY blocks all mutation families even on direct service calls', async () => {
    await db.organization.update({ where: { id: org }, data: { status: 'READ_ONLY' } });
    try {
      for (const fn of [
        () => catalog.createService(svc),
        () => catalog.createEmployee({ name: 'No write' }),
        () => schedule.setWorkingHours(employee, { intervals: [] }),
        () => appointments.create(input()),
      ])
        await expect(run<unknown>(fn)).rejects.toThrow();
      expect((await run(() => catalog.services())).items).toHaveLength(1);
    } finally {
      await db.organization.update({ where: { id: org }, data: { status: 'ACTIVE' } });
    }
  });
  for (const target of ['same', 'different'] as const) {
    it(`concurrent overlap in ${target} location gives one success and one domain conflict`, async () => {
      const results = await Promise.allSettled([
        run(() => appointments.create(input())),
        run(() => appointments.create(input('10:30')), {
          locationId: target === 'same' ? location : secondLocation,
        }),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const denied = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      expect(denied.reason).toBeInstanceOf(ConflictException);
      expect(await db.appointment.count({ where: { employeeId: employee } })).toBe(1);
      expect(await db.customerBusiness.count({ where: { customerId: customer } })).toBe(1);
    });
  }
  it('concurrent terminal transitions cannot overwrite one another', async () => {
    const day = await run(() => appointments.create(input()));
    const id = day.appointments[0]!.id;
    const results = await Promise.allSettled(
      ['DONE', 'CANCELLED'].map((status) => run(() => appointments.setStatus(id, { status }))),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });
  it('customer visibility is restricted to CustomerBusiness and appears after atomic appointment', async () => {
    expect((await run(() => catalog.customers())).items).toEqual([]);
    await run(() => appointments.create(input()));
    expect((await run(() => catalog.customers())).items.map((c) => c.id)).toEqual([customer]);
    expect(
      (
        await run(() => catalog.customers(), {
          businessId: secondBusiness,
          locationId: otherLocation,
        })
      ).items,
    ).toEqual([]);
    await db.customerBusiness.create({
      data: { customerId: customer, businessId: secondBusiness },
    });
    expect(
      (
        await run(() => catalog.customers(), {
          businessId: secondBusiness,
          locationId: otherLocation,
        })
      ).items.map((c) => c.id),
    ).toEqual([customer]);
  });
  it('archived customer cannot receive a new appointment or visibility link', async () => {
    await db.customer.update({ where: { id: customer }, data: { status: 'ARCHIVED' } });
    try {
      await expect(run(() => appointments.create(input()))).rejects.toThrow();
      expect(await db.customerBusiness.count({ where: { customerId: customer } })).toBe(0);
    } finally {
      await db.customer.update({ where: { id: customer }, data: { status: 'ACTIVE' } });
    }
  });
  it('explicit Business reads only its own catalog; body scope cannot redirect a mutation', async () => {
    const created = await run(() =>
      catalog.createService({ ...svc, businessId: secondBusiness, locationId: otherLocation }),
    );
    expect(
      await db.beautyService.findUnique({
        where: { id: created.id },
        select: { businessId: true },
      }),
    ).toEqual({ businessId: business });
    expect(
      (
        await run(() => catalog.services(), {
          businessId: secondBusiness,
          locationId: otherLocation,
        })
      ).items,
    ).toEqual([]);
    await expect(
      run(() => catalog.updateService(created.id, { name: 'Attempt' }), {
        businessId: secondBusiness,
        locationId: otherLocation,
      }),
    ).rejects.toThrow();
    await expect(
      run(() => catalog.setLocationService(created.id, { enabled: true }), {
        businessId: secondBusiness,
        locationId: otherLocation,
      }),
    ).rejects.toThrow();
    await expect(
      run(() => catalog.updateEmployee(employee, { name: 'Attempt' }), {
        businessId: secondBusiness,
        locationId: otherLocation,
      }),
    ).rejects.toThrow();
    await expect(
      run(() => schedule.setLocations(employee, { locationIds: [otherLocation] })),
    ).rejects.toThrow();
    await expect(
      run(() => catalog.services(), {
        businessId: foreignBusiness,
        locationId: null,
        scope: 'BUSINESS',
      }),
    ).rejects.toThrow();
    await expect(run(() => catalog.services(), { locationId: otherLocation })).rejects.toThrow();
    await db.beautyService.delete({ where: { id: created.id } });
  });
  it('Business-only catalog is allowed but location operations cannot guess a branch', async () => {
    const patch = { locationId: null, scope: 'BUSINESS' as const };
    expect((await run(() => catalog.services(), patch)).locationId).toBeNull();
    for (const fn of [
      () => appointments.day('2026-10-12'),
      () => appointments.create(input()),
      () => catalog.setLocationService(service, { enabled: true }),
      () => schedule.overview(employee),
      () => schedule.addTimeOff(employee, { dateFrom: '2026-10-12', dateTo: '2026-10-12' }),
    ])
      await expect(run<unknown>(fn, patch)).rejects.toThrow();
    expect(await db.appointment.count({ where: { employeeId: employee } })).toBe(0);
  });
  for (const target of ['business', 'location'] as const) {
    it(`archived ${target} fails on read and mutation`, async () => {
      if (target === 'business')
        await db.business.update({ where: { id: business }, data: { status: 'ARCHIVED' } });
      else await db.location.update({ where: { id: location }, data: { status: 'ARCHIVED' } });
      try {
        await expect(run(() => catalog.services())).rejects.toThrow();
        await expect(run(() => catalog.createService(svc))).rejects.toThrow();
      } finally {
        if (target === 'business')
          await db.business.update({ where: { id: business }, data: { status: 'ACTIVE' } });
        else await db.location.update({ where: { id: location }, data: { status: 'ACTIVE' } });
      }
    });
  }
  for (const vertical of ['HOSPITALITY', 'FOOD_SERVICE'] as const) {
    it(`${vertical} cannot call Beauty services even with a forged stale actor vertical`, async () => {
      await db.business.update({ where: { id: business }, data: { vertical } });
      try {
        await expect(run(() => catalog.services())).rejects.toThrow();
        await expect(run(() => appointments.create(input()))).rejects.toThrow();
      } finally {
        await db.business.update({ where: { id: business }, data: { vertical: 'BEAUTY' } });
      }
    });
  }
  it('READ_ONLY blocks every mutation and leaves audit and rows unchanged', async () => {
    const day = await run(() => appointments.create(input()));
    const id = day.appointments[0]!.id;
    const off = await run(() =>
      schedule.addTimeOff(employee, { dateFrom: '2026-10-13', dateTo: '2026-10-13' }),
    );
    const count = await db.auditLog.count({ where: { organizationId: org } });
    await db.organization.update({ where: { id: org }, data: { status: 'READ_ONLY' } });
    try {
      const calls = [
        () => catalog.createService(svc),
        () => catalog.updateService(service, { active: false }),
        () => catalog.setLocationService(service, { enabled: false }),
        () => catalog.createEmployee({ name: 'No write' }),
        () => catalog.updateEmployee(employee, { active: false }),
        () => catalog.setEmployeeServices(employee, { serviceIds: [] }),
        () => schedule.setWorkingHours(employee, { intervals: [] }),
        () => schedule.addTimeOff(employee, { dateFrom: '2026-10-13', dateTo: '2026-10-13' }),
        () => schedule.removeTimeOff(employee, off.timeOffs[0]!.id),
        () => schedule.setLocations(employee, { locationIds: [] }),
        () => appointments.create(input('12:00')),
        () => appointments.move(id, { startsAt: input('12:00').startsAt }),
        () => appointments.setStatus(id, { status: 'CANCELLED' }),
      ];
      for (const fn of calls) await expect(run<unknown>(fn)).rejects.toThrow(/чтения/);
      expect(await db.auditLog.count({ where: { organizationId: org } })).toBe(count);
      expect((await run(() => appointments.day('2026-10-12'))).appointments).toHaveLength(1);
    } finally {
      await db.organization.update({ where: { id: org }, data: { status: 'ACTIVE' } });
      await db.timeOff.deleteMany({ where: { employeeId: employee } });
    }
  });
  it('eligibility rejects disabled or archived service, archived employee and foreign customer', async () => {
    const locationService = { locationId_serviceId: { locationId: location, serviceId: service } };
    await run(() => catalog.setLocationService(service, { enabled: false }));
    await expect(run(() => appointments.create(input()))).rejects.toThrow(/не оказывает/);
    await db.locationService.update({ where: locationService, data: { enabled: true } });
    await run(() => catalog.updateService(service, { active: false }));
    await expect(run(() => appointments.create(input()))).rejects.toThrow(/архиве/);
    await run(() => catalog.updateService(service, { active: true }));
    await run(() => catalog.updateEmployee(employee, { active: false }));
    await expect(run(() => appointments.create(input()))).rejects.toThrow(/архиве/);
    await run(() => catalog.updateEmployee(employee, { active: true }));
    const foreign = await db.customer.create({
      data: { organizationId: foreignOrg, firstName: 'Synthetic foreign' },
    });
    await expect(
      run(() => appointments.create({ ...input(), customerId: foreign.id })),
    ).rejects.toThrow(/Клиент не найден/);
    expect(await db.appointment.count({ where: { employeeId: employee } })).toBe(0);
    expect(await db.customerBusiness.count({ where: { customerId: customer } })).toBe(0);
  });
  for (const status of ['CANCELLED', 'NO_SHOW'] as const) {
    it(`${status} releases the employee slot across branches`, async () => {
      const day = await run(() => appointments.create(input()));
      await run(() => appointments.setStatus(day.appointments[0]!.id, { status }));
      await run(() => appointments.create(input()), { locationId: secondLocation });
      expect(await db.appointment.count({ where: { employeeId: employee } })).toBe(2);
    });
  }
  it('minor-unit override and duration are snapshots; catalog edits do not rewrite appointments', async () => {
    await run(() =>
      catalog.setLocationService(service, {
        enabled: true,
        priceOverrideMinor: '9876543210123',
        durationOverrideMinutes: 30,
      }),
    );
    const day = await run(() => appointments.create(input()));
    const id = day.appointments[0]!.id;
    expect(day.appointments[0]).toMatchObject({
      priceMinor: '9876543210123',
      currency: 'KZT',
      startMinutes: 600,
      endMinutes: 630,
    });
    await run(() => catalog.updateService(service, { priceMinor: '999' }));
    expect(
      await db.appointment.findUnique({ where: { id }, select: { price: true, currency: true } }),
    ).toEqual({ price: 9876543210123n, currency: 'KZT' });
    await expect(run(() => catalog.updateService(service, { priceMinor: 1.5 }))).rejects.toThrow();
    await run(() => catalog.setLocationService(service, { enabled: true }));
    await run(() => catalog.updateService(service, { priceMinor: '12345' }));
  });
  it('local Monday early morning is Sunday UTC and appears on the Location day only', async () => {
    const day = await run(() => appointments.create(input('00:30')));
    expect(day.appointments[0]).toMatchObject({
      startsAt: '2026-10-11T19:30:00.000Z',
      startMinutes: 30,
      endMinutes: 90,
    });
    expect((await run(() => appointments.day('2026-10-11'))).appointments).toEqual([]);
    expect((await run(() => appointments.day('2026-10-12'))).appointments).toHaveLength(1);
    await expect(run(() => appointments.create(input('23:30')))).rejects.toThrow(/не работает/);
  });
  it('RLS wetop_app hides every Beauty table across organizations, preserving own access', async () => {
    await run(() => appointments.create(input()));
    await db.timeOff.create({
      data: {
        employeeId: employee,
        dateFrom: new Date('2026-10-13'),
        dateTo: new Date('2026-10-13'),
      },
    });
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE wetop_app');
      for (const [organizationId, visible] of [
        [foreignOrg, false],
        [org, true],
      ] as const) {
        await tx.$executeRaw`SELECT set_config('app.org_id', ${organizationId}, true)`;
        const counts = [
          await tx.customer.count({ where: { id: customer } }),
          await tx.customerBusiness.count({ where: { customerId: customer } }),
          await tx.employee.count({ where: { id: employee } }),
          await tx.employeeLocation.count({ where: { employeeId: employee } }),
          await tx.beautyService.count({ where: { id: service } }),
          await tx.locationService.count({ where: { serviceId: service } }),
          await tx.employeeService.count({ where: { employeeId: employee } }),
          await tx.workingHours.count({ where: { employeeId: employee } }),
          await tx.timeOff.count({ where: { employeeId: employee } }),
          await tx.appointment.count({ where: { employeeId: employee } }),
        ];
        for (const count of counts) expect(count > 0).toBe(visible);
      }
    });
    await db.timeOff.deleteMany({ where: { employeeId: employee } });
  });
  it('existing migration constraints and search_path match the accepted model', async () => {
    const constraints = await db.$queryRaw<Array<{ name: string; definition: string }>>`
      SELECT conname AS name, pg_get_constraintdef(oid) AS definition FROM pg_constraint
      WHERE conrelid = 'appointments'::regclass AND conname = 'appointments_no_overlap_per_employee'`;
    expect(constraints).toHaveLength(1);
    expect(constraints[0]!.definition).toContain('employee_id WITH =');
    expect(constraints[0]!.definition).not.toContain('location_id WITH =');
    const functions = await db.$queryRaw<Array<{ config: string[] }>>`
      SELECT proconfig AS config FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = current_schema() AND p.proname LIKE 'beauty_%'`;
    expect(functions).toHaveLength(6);
    for (const f of functions)
      expect(f.config.some((c) => c.startsWith('search_path=pms_test,'))).toBe(true);
  });
  it('successful catalog, employee, schedule and appointment changes are audited', async () => {
    const day = await run(() => appointments.create(input()));
    await run(() =>
      appointments.move(day.appointments[0]!.id, { startsAt: input('12:00').startsAt }),
    );
    await run(() => appointments.setStatus(day.appointments[0]!.id, { status: 'DONE' }));
    const rows = await db.auditLog.findMany({
      where: { organizationId: org },
      select: { action: true, userId: true },
    });
    const actions = rows.map((r) => r.action);
    for (const action of [
      'beauty.service.updated',
      'beauty.location_service.set',
      'beauty.employee.updated',
      'beauty.employee.time_off.added',
      'beauty.appointment.created',
      'beauty.appointment.moved',
      'beauty.appointment.status',
    ])
      expect(actions).toContain(action);
    expect(rows.every((r) => r.userId === user)).toBe(true);
  });
  it('real HTTP applies verified scope, vertical capabilities and permissions before Beauty handlers', async () => {
    const get = (path: string, pointer: string) =>
      fetch(`${base}${path}`, { headers: { 'x-wetop-scope': pointer } });
    const pointer = `business=${business};location=${location}`;
    for (const path of [
      '/beauty/services',
      '/beauty/employees',
      '/beauty/customers',
      '/beauty/schedule',
      '/beauty/appointments?date=2026-10-12',
    ]) {
      expect((await get(path, pointer)).status).toBe(200);
      expect((await get(path, '')).status).toBe(403);
      expect((await get(path, `business=${business};location=${otherLocation}`)).status).toBe(403);
      expect((await get(path, `business=${foreignBusiness}`)).status).toBe(403);
      for (const vertical of ['HOSPITALITY', 'FOOD_SERVICE'] as const) {
        await db.business.update({ where: { id: business }, data: { vertical } });
        try {
          expect((await get(path, pointer)).status).toBe(403);
        } finally {
          await db.business.update({ where: { id: business }, data: { vertical: 'BEAUTY' } });
        }
      }
    }
    const response = await fetch(`${base}/beauty/services?businessId=${secondBusiness}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-wetop-scope': pointer,
        'x-test-role': 'STAFF',
      },
      body: JSON.stringify(svc),
    });
    expect(response.status).toBe(403);
  });
});
