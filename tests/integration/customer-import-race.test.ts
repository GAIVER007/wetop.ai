import { randomUUID } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '@pms/database';
import { CustomerImportService } from '../../apps/api/src/beauty/customer-import';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { makeClients, seedUser, url } from './core-security/harness';

type DependencyKind = 'customer-business' | 'beauty' | 'food';
type RaceFixture = { customerId: string; importId: string };

const scope = {
  organizationId: randomUUID(),
  beautyBusinessId: randomUUID(),
  siblingBusinessId: randomUUID(),
  foodBusinessId: randomUUID(),
  beautyLocationId: randomUUID(),
  foodLocationId: randomUUID(),
};

describe.skipIf(!url)('M4-B2: customer import undo FK races', () => {
  let admin: Db;
  let tenant: Db;
  let ownerId: string;
  let employeeId: string;
  let serviceId: string;
  let periodId: string;
  let observer: pg.Client;
  let service: CustomerImportService;
  let pauseKey = 1_000;

  beforeAll(async () => {
    ({ admin, tenant } = makeClients());
    await admin.organization.create({
      data: { id: scope.organizationId, name: 'Synthetic import race network', status: 'ACTIVE' },
    });
    await admin.business.createMany({
      data: [
        { id: scope.beautyBusinessId, organizationId: scope.organizationId, name: 'Synthetic race salon', vertical: 'BEAUTY' },
        { id: scope.siblingBusinessId, organizationId: scope.organizationId, name: 'Synthetic sibling salon', vertical: 'BEAUTY' },
        { id: scope.foodBusinessId, organizationId: scope.organizationId, name: 'Synthetic race restaurant', vertical: 'FOOD_SERVICE' },
      ],
    });
    ownerId = await seedUser(admin, scope.organizationId, 'OWNER', 'ImportRace');
    await admin.location.createMany({
      data: [
        { id: scope.beautyLocationId, businessId: scope.beautyBusinessId, name: 'Synthetic beauty location', currency: 'KZT', timezone: 'UTC' },
        { id: scope.foodLocationId, businessId: scope.foodBusinessId, name: 'Synthetic food location', currency: 'KZT', timezone: 'UTC' },
      ],
    });
    employeeId = (await admin.employee.create({
      data: { businessId: scope.beautyBusinessId, name: 'Synthetic race employee' },
    })).id;
    serviceId = (await admin.beautyService.create({
      data: { businessId: scope.beautyBusinessId, name: 'Synthetic race service', durationMinutes: 30, price: 100n, currency: 'KZT' },
    })).id;
    await admin.employeeLocation.create({ data: { employeeId, locationId: scope.beautyLocationId } });
    await admin.employeeService.create({ data: { employeeId, serviceId } });
    await admin.locationService.create({ data: { locationId: scope.beautyLocationId, serviceId } });
    periodId = (await admin.servicePeriod.create({
      data: {
        locationId: scope.foodLocationId,
        name: 'Synthetic race period',
        weekday: 1,
        timeFrom: new Date('1970-01-01T00:00:00Z'),
        timeTo: new Date('1970-01-01T23:59:00Z'),
        defaultDurationMinutes: 60,
      },
    })).id;
    observer = await connect('customer-import-race-observer');
    service = new CustomerImportService({ db: tenant } as unknown as PrismaService);
    await observer.query(`
      CREATE OR REPLACE FUNCTION customer_import_race_pause() RETURNS trigger LANGUAGE plpgsql
      SET search_path = pms_test, pg_catalog AS $fn$
      BEGIN
        IF OLD.id=TG_ARGV[0]::uuid THEN PERFORM pg_advisory_xact_lock(99132,TG_ARGV[1]::integer); END IF;
        RETURN OLD;
      END $fn$`);
  });

  afterAll(async () => {
    try {
      if (!admin) return;
      await admin.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT set_config('wetop.audit_purge','on',true)`;
        await tx.appointmentLine.deleteMany({
          where: { appointment: { locationId: scope.beautyLocationId } },
        });
        await tx.appointment.deleteMany({ where: { locationId: scope.beautyLocationId } });
        await tx.restaurantReservation.deleteMany({ where: { locationId: scope.foodLocationId } });
        await tx.customerImportRow.deleteMany({ where: { organizationId: scope.organizationId } });
        await tx.customerImport.deleteMany({ where: { organizationId: scope.organizationId } });
        await tx.customerBusiness.deleteMany({ where: { customer: { organizationId: scope.organizationId } } });
        await tx.customer.deleteMany({ where: { organizationId: scope.organizationId } });
        await tx.employeeService.deleteMany({ where: { employeeId } });
        await tx.employeeLocation.deleteMany({ where: { employeeId } });
        await tx.locationService.deleteMany({ where: { serviceId } });
        await tx.employee.deleteMany({ where: { id: employeeId } });
        await tx.beautyService.deleteMany({ where: { id: serviceId } });
        await tx.servicePeriod.deleteMany({ where: { id: periodId } });
        await tx.location.deleteMany({ where: { id: { in: [scope.beautyLocationId, scope.foodLocationId] } } });
        await tx.auditLog.deleteMany({ where: { organizationId: scope.organizationId } });
        await tx.membership.deleteMany({ where: { organizationId: scope.organizationId } });
        await tx.business.deleteMany({ where: { organizationId: scope.organizationId } });
        await tx.organization.delete({ where: { id: scope.organizationId } });
        await tx.user.delete({ where: { id: ownerId } });
      }, { timeout: 60_000 });
    } finally {
      await observer?.query('DROP FUNCTION IF EXISTS customer_import_race_pause()').catch(() => undefined);
      await observer?.end().catch(() => undefined);
      await tenant?.$disconnect().catch(() => undefined);
      await admin?.$disconnect().catch(() => undefined);
    }
  });

  async function connect(applicationName: string): Promise<pg.Client> {
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    await client.query('SET search_path TO pms_test,public');
    await client.query(`SELECT set_config('application_name',$1,false)`, [applicationName]);
    return client;
  }

  async function waitForLock(applicationName: string): Promise<void> {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const result = await observer.query<{ wait_event_type: string | null }>(
        `SELECT wait_event_type FROM pg_stat_activity WHERE application_name=$1`,
        [applicationName],
      );
      if (result.rows[0]?.wait_event_type === 'Lock') return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`Synthetic transaction did not wait on a lock: ${applicationName}`);
  }

  async function waitForBlockedBy(blockerPid: number): Promise<void> {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const result = await observer.query<{ waiting: boolean }>(
        `SELECT EXISTS(
           SELECT 1 FROM pg_stat_activity a
            WHERE a.pid<>$1 AND cardinality(pg_blocking_pids(a.pid))>0
              AND $1=ANY(pg_blocking_pids(a.pid))
         ) AS waiting`,
        [blockerPid],
      );
      if (result.rows[0]?.waiting) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('Synthetic undo did not wait for the FK transaction');
  }

  async function waitForPause(key: number): Promise<void> {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const result = await observer.query<{ waiting: boolean }>(
        `SELECT EXISTS(
           SELECT 1 FROM pg_locks
            WHERE locktype='advisory' AND classid=99132 AND objid=$1 AND NOT granted
         ) AS waiting`,
        [key],
      );
      if (result.rows[0]?.waiting) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('Synthetic undo did not reach the before-delete pause');
  }

  async function seedRace(): Promise<RaceFixture> {
    const customer = await admin.customer.create({
      data: { organizationId: scope.organizationId, firstName: 'Synthetic race customer' },
    });
    const link = await admin.customerBusiness.create({
      data: { customerId: customer.id, businessId: scope.beautyBusinessId },
    });
    const run = await admin.customerImport.create({
      data: {
        organizationId: scope.organizationId,
        businessId: scope.beautyBusinessId,
        createdBy: ownerId,
        clientRequestId: randomUUID(),
        requestDigest: 'a'.repeat(64),
        state: 'COMPLETED',
        totalRows: 1,
        uploadedRows: 1,
        processedRows: 1,
        createdCount: 1,
        completedAt: new Date(),
        undoDeadline: new Date(Date.now() + 60_000),
        contentsExpireAt: new Date(Date.now() + 120_000),
      },
    });
    await admin.customerImportRow.create({
      data: {
        organizationId: scope.organizationId,
        importId: run.id,
        ordinal: 0,
        sourceLine: 2,
        outcome: 'CREATED',
        customerId: customer.id,
        customerBaseline: JSON.parse(JSON.stringify(customer)),
        linkBaseline: link.createdAt,
      },
    });
    return { customerId: customer.id, importId: run.id };
  }

  async function cleanupRace(fixture: RaceFixture): Promise<void> {
    await admin.appointmentLine.deleteMany({
      where: { appointment: { customerId: fixture.customerId } },
    });
    await admin.appointment.deleteMany({ where: { customerId: fixture.customerId } });
    await admin.restaurantReservation.deleteMany({ where: { customerId: fixture.customerId } });
    await admin.customerImportRow.deleteMany({ where: { importId: fixture.importId } });
    await admin.customerImport.deleteMany({ where: { id: fixture.importId } });
    await admin.customerBusiness.deleteMany({ where: { customerId: fixture.customerId } });
    await admin.customer.deleteMany({ where: { id: fixture.customerId } });
  }

  async function insertDependency(client: pg.Client, kind: DependencyKind, customerId: string): Promise<void> {
    if (kind === 'customer-business') {
      await client.query(
        `INSERT INTO customer_businesses(customer_id,business_id,created_at) VALUES($1,$2,now())`,
        [customerId, scope.siblingBusinessId],
      );
      return;
    }
    if (kind === 'beauty') {
      await client.query(
        `INSERT INTO appointments(id,location_id,customer_id,employee_id,service_id,starts_at,ends_at,status,price,currency,updated_at)
         VALUES($1,$2,$3,$4,$5,'2026-10-20T10:00:00Z','2026-10-20T10:30:00Z','BOOKED',100,'KZT',now())`,
        [randomUUID(), scope.beautyLocationId, customerId, employeeId, serviceId],
      );
      return;
    }
    await client.query(
      `INSERT INTO restaurant_reservations(id,location_id,customer_id,service_period_id,starts_at,ends_at,party_size,status,source,creation_key,creation_fingerprint,updated_at)
       VALUES($1,$2,$3,$4,'2026-10-20T10:00:00Z','2026-10-20T11:00:00Z',1,'BOOKED','DESK',$5,$6,now())`,
      [randomUUID(), scope.foodLocationId, customerId, periodId, randomUUID(), 'b'.repeat(64)],
    );
  }

  const undo = (importId: string) => withSignedInUser({
    userId: ownerId,
    organizationId: scope.organizationId,
    role: 'OWNER',
    scope: 'BUSINESS',
    businessId: scope.beautyBusinessId,
    vertical: 'BEAUTY',
  }, () => service.undo(importId));

  it.each(['customer-business', 'beauty', 'food'] as const)(
    'undo wins against a concurrent %s insert, so the FK insert fails',
    async (kind) => {
      const fixture = await seedRace();
      const childName = `import-race-child-${randomUUID()}`;
      const child = await connect(childName);
      const coordinator = await connect(`import-race-coordinator-${randomUUID()}`);
      const key = pauseKey++;
      const triggerName = `import_race_pause_${randomUUID().replace(/-/g, '')}`;
      let undoing: ReturnType<typeof undo> | null = null;
      let inserting: Promise<void> | null = null;
      try {
        await coordinator.query('SELECT pg_advisory_lock(99132,$1)', [key]);
        await observer.query(
          `CREATE TRIGGER "${triggerName}" BEFORE DELETE ON customers FOR EACH ROW
           EXECUTE FUNCTION customer_import_race_pause('${fixture.customerId}','${key}')`,
        );
        undoing = undo(fixture.importId);
        void undoing.catch(() => undefined);
        await waitForPause(key);
        await child.query('BEGIN');
        inserting = insertDependency(child, kind, fixture.customerId);
        void inserting.catch(() => undefined);
        await waitForLock(childName);
        await coordinator.query('SELECT pg_advisory_unlock(99132,$1)', [key]);
        await expect(undoing).resolves.toMatchObject({ state: 'UNDONE' });
        await expect(inserting).rejects.toMatchObject({ code: '23503' });
        await child.query('ROLLBACK');
        expect(await admin.customer.findUnique({ where: { id: fixture.customerId } })).toBeNull();
      } finally {
        await coordinator.query('SELECT pg_advisory_unlock(99132,$1)', [key]).catch(() => undefined);
        await child.query('ROLLBACK').catch(() => undefined);
        await undoing?.catch(() => undefined);
        await inserting?.catch(() => undefined);
        await observer.query(`DROP TRIGGER IF EXISTS "${triggerName}" ON customers`).catch(() => undefined);
        await child.end();
        await coordinator.end();
        await cleanupRace(fixture);
      }
    }, 30_000,
  );

  it.each(['customer-business', 'beauty', 'food'] as const)(
    '%s insert wins before undo, so undo sees the dependency and deletes nothing',
    async (kind) => {
      const fixture = await seedRace();
      const childName = `import-race-child-${randomUUID()}`;
      const child = await connect(childName);
      let undoing: ReturnType<typeof undo> | null = null;
      try {
        await child.query('BEGIN');
        await insertDependency(child, kind, fixture.customerId);
        const blockerPid = Number((await child.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid);
        undoing = undo(fixture.importId);
        void undoing.catch(() => undefined);
        await waitForBlockedBy(blockerPid);
        await child.query('COMMIT');
        await expect(undoing).rejects.toBeInstanceOf(ConflictException);
        expect(await admin.customer.findUnique({ where: { id: fixture.customerId } })).not.toBeNull();
        expect(await admin.customerBusiness.findUnique({
          where: { customerId_businessId: { customerId: fixture.customerId, businessId: scope.beautyBusinessId } },
        })).not.toBeNull();
      } finally {
        await child.query('ROLLBACK').catch(() => undefined);
        await undoing?.catch(() => undefined);
        await child.end();
        await cleanupRace(fixture);
      }
    }, 30_000,
  );
});
