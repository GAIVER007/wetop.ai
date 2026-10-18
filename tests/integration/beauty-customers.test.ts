import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { BeautyCustomerImportService } from '../../apps/api/src/beauty/customer-import';
import { BeautyCustomerDetailService } from '../../apps/api/src/beauty/customer-detail';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

describe.skipIf(!url)('Beauty: canonical customer across businesses', () => {
  let db: Db;
  let service: BeautyCustomerImportService;
  let detail: BeautyCustomerDetailService;
  const org = randomUUID();
  const user = randomUUID();
  const businessA = randomUUID();
  const businessB = randomUUID();
  const foreignOrg = randomUUID();
  const foreignBusiness = randomUUID();

  const asBusiness = <T>(businessId: string, run: () => Promise<T>) =>
    withSignedInUser(
      {
        userId: user,
        organizationId: org,
        role: 'OWNER',
        scope: 'BUSINESS',
        vertical: 'BEAUTY',
        businessId,
      },
      run,
    );

  beforeAll(async () => {
    const database = new URL(url!);
    if (!['127.0.0.1', 'localhost', '::1'].includes(database.hostname)) {
      throw new Error('Beauty customer integration test requires a loopback database');
    }
    db = createPrismaClient(url);
    service = new BeautyCustomerImportService({ db } as unknown as PrismaService);
    detail = new BeautyCustomerDetailService({ db } as unknown as PrismaService);
    await cleanup();
    await db.$executeRawUnsafe(
      `INSERT INTO "organizations" ("id", "name", "status") VALUES ('${org}', 'Synthetic customer network', 'ACTIVE')`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO "users" ("id", "email", "name") VALUES ('${user}', 'customer-${user}@example.invalid', 'Synthetic owner')`,
    );
    for (const [id, name] of [
      [businessA, 'Synthetic salon A'],
      [businessB, 'Synthetic salon B'],
    ]) {
      await db.$executeRawUnsafe(
        `INSERT INTO "businesses" ("id", "organization_id", "name", "vertical", "updated_at")
         VALUES ('${id}', '${org}', '${name}', 'BEAUTY', now())`,
      );
    }
    await db.$executeRawUnsafe(
      `INSERT INTO "organizations" ("id", "name", "status") VALUES ('${foreignOrg}', 'Synthetic foreign network', 'ACTIVE')`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO "businesses" ("id", "organization_id", "name", "vertical", "updated_at")
       VALUES ('${foreignBusiness}', '${foreignOrg}', 'Synthetic foreign salon', 'BEAUTY', now())`,
    );
  });

  afterAll(async () => {
    if (!db) return;
    await cleanup();
    await db.$disconnect();
  });

  async function cleanup() {
    if (!db) return;
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('wetop.audit_purge','on',true)`;
      await tx.auditLog.deleteMany({ where: { organizationId: org } });
      await tx.appointmentLine.deleteMany({
        where: {
          appointment: { location: { business: { organizationId: { in: [org, foreignOrg] } } } },
        },
      });
      await tx.appointment.deleteMany({
        where: { location: { business: { organizationId: { in: [org, foreignOrg] } } } },
      });
      await tx.employeeService.deleteMany({
        where: { employee: { business: { organizationId: { in: [org, foreignOrg] } } } },
      });
      await tx.locationService.deleteMany({
        where: { location: { business: { organizationId: { in: [org, foreignOrg] } } } },
      });
      await tx.employeeLocation.deleteMany({
        where: { location: { business: { organizationId: { in: [org, foreignOrg] } } } },
      });
      await tx.beautyService.deleteMany({
        where: { business: { organizationId: { in: [org, foreignOrg] } } },
      });
      await tx.employee.deleteMany({
        where: { business: { organizationId: { in: [org, foreignOrg] } } },
      });
      await tx.location.deleteMany({
        where: { business: { organizationId: { in: [org, foreignOrg] } } },
      });
      await tx.customerBusiness.deleteMany({
        where: { business: { organizationId: { in: [org, foreignOrg] } } },
      });
      await tx.customer.deleteMany({ where: { organizationId: { in: [org, foreignOrg] } } });
      await tx.business.deleteMany({ where: { organizationId: { in: [org, foreignOrg] } } });
      await tx.membership.deleteMany({ where: { organizationId: org } });
      await tx.organization.deleteMany({ where: { id: { in: [org, foreignOrg] } } });
      await tx.user.deleteMany({ where: { id: user } });
    });
  }

  it('serializes two businesses and reuses one exact name plus normalized phone', async () => {
    const [first, second] = await Promise.all([
      asBusiness(businessA, () =>
        service.create({ firstName: 'Тестовый', lastName: 'Клиент', phone: '8 701 234 56 78' }),
      ),
      asBusiness(businessB, () =>
        service.create({ firstName: 'Тестовый', lastName: 'Клиент', phone: '+7 (701) 234-56-78' }),
      ),
    ]);

    expect(first.id).toBe(second.id);
    expect(await db.customer.count({ where: { organizationId: org } })).toBe(1);
    expect(await db.customerBusiness.count({ where: { customerId: String(first.id) } })).toBe(2);
  });

  it('rejects a conflicting name atomically without creating the other CSV row', async () => {
    const before = await db.customer.count({ where: { organizationId: org } });
    const csv = 'Имя;Телефон\nНовый Клиент;+77010000000\nДругое Имя;+77012345678';

    await expect(asBusiness(businessB, () => service.apply({ csv }))).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(await db.customer.count({ where: { organizationId: org } })).toBe(before);
    expect(await db.customer.count({ where: { organizationId: org, phone: '+77010000000' } })).toBe(
      0,
    );
  });

  it('opens a shared customer but returns history only from the selected business', async () => {
    const customer = await asBusiness(businessA, () =>
      service.create({
        firstName: 'История',
        lastName: 'Клиента',
        phone: '+77020000001',
      }),
    );
    await asBusiness(businessB, () =>
      service.create({
        firstName: 'История',
        lastName: 'Клиента',
        phone: '+77020000001',
      }),
    );
    const locationA = randomUUID();
    const locationB = randomUUID();
    const employeeA = randomUUID();
    const employeeB = randomUUID();
    const serviceA = randomUUID();
    const serviceB = randomUUID();
    for (const [locationId, businessId, suffix] of [
      [locationA, businessA, 'A'],
      [locationB, businessB, 'B'],
    ]) {
      await db.$executeRawUnsafe(
        `INSERT INTO "locations" ("id", "business_id", "name", "timezone", "currency", "updated_at")
         VALUES ('${locationId}', '${businessId}', 'Synthetic branch ${suffix}', 'Asia/Almaty', 'KZT', now())`,
      );
    }
    for (const [employeeId, businessId, name] of [
      [employeeA, businessA, 'Synthetic master A'],
      [employeeB, businessB, 'Synthetic master B'],
    ]) {
      await db.$executeRawUnsafe(
        `INSERT INTO "employees" ("id", "business_id", "name", "updated_at")
         VALUES ('${employeeId}', '${businessId}', '${name}', now())`,
      );
    }
    for (const [serviceId, businessId, name] of [
      [serviceA, businessA, 'Synthetic service A'],
      [serviceB, businessB, 'Synthetic service B'],
    ]) {
      await db.$executeRawUnsafe(
        `INSERT INTO "beauty_services"
          ("id", "business_id", "name", "duration_minutes", "price", "currency", "updated_at")
         VALUES ('${serviceId}', '${businessId}', '${name}', 60, 10000, 'KZT', now())`,
      );
    }
    const assignments: Array<[string, string, string]> = [
      [locationA, employeeA, serviceA],
      [locationB, employeeB, serviceB],
    ];
    for (const [locationId, employeeId, serviceId] of assignments) {
      await db.employeeLocation.create({ data: { locationId, employeeId } });
      await db.employeeService.create({ data: { employeeId, serviceId } });
      await db.locationService.create({ data: { locationId, serviceId } });
    }
    for (const [appointmentId, locationId, employeeId, serviceId, date] of [
      [randomUUID(), locationA, employeeA, serviceA, '2036-10-06'],
      [randomUUID(), locationB, employeeB, serviceB, '2036-10-07'],
    ]) {
      await db.$executeRawUnsafe(
        `INSERT INTO "appointments"
          ("id", "location_id", "customer_id", "employee_id", "service_id", "starts_at", "ends_at", "price", "currency", "updated_at")
         VALUES ('${appointmentId}', '${locationId}', '${customer.id}', '${employeeId}', '${serviceId}',
           '${date}T05:00:00Z', '${date}T06:00:00Z', 10000, 'KZT', now())`,
      );
    }

    const card = await asBusiness(businessA, () => detail.detail(String(customer.id)));
    expect(card.customer).toMatchObject({ id: customer.id, firstName: 'История' });
    expect(card.visits).toEqual([
      expect.objectContaining({
        location: expect.objectContaining({ id: locationA }),
        service: expect.objectContaining({ name: 'Synthetic service A' }),
      }),
    ]);
  });

  it('returns not found for a customer outside the selected business or organization', async () => {
    const onlyBusinessB = await asBusiness(businessB, () =>
      service.create({
        firstName: 'Только',
        lastName: 'Другой салон',
        phone: '+77020000002',
      }),
    );
    const foreign = await db.customer.create({
      data: { organizationId: foreignOrg, firstName: 'Чужая организация', phone: '+77020000003' },
    });
    await db.customerBusiness.create({
      data: { customerId: foreign.id, businessId: foreignBusiness },
    });

    await expect(
      asBusiness(businessA, () => detail.detail(String(onlyBusinessB.id))),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(asBusiness(businessA, () => detail.detail(foreign.id))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
