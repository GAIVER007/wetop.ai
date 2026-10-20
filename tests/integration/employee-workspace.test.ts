import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { BeautyCatalogService } from '../../apps/api/src/beauty/beauty.module';
import { databaseTenant, withSignedInUser } from '../../apps/api/src/auth/request-context';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { isLocalDatabase } from '../tools/seed-local';

const url = process.env.DATABASE_URL;
if (url && !isLocalDatabase(url)) throw new Error('Own local DB required');
const appUrl = process.env.DATABASE_APP_URL;
const profileToken = (row: unknown) => {
  expect(row).toHaveProperty('profileRevision');
  const token = (row as { profileRevision: string }).profileRevision;
  expect(token).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
  return token;
};

describe.skipIf(!url || !appUrl)('PEOPLE profile CAS on real PostgreSQL with RLS', () => {
  let admin: Db, app: Db, service: BeautyCatalogService;
  const own = {
    org: randomUUID(),
    business: randomUUID(),
    location: randomUUID(),
    user: randomUUID(),
  };
  const other = { org: randomUUID(), business: randomUUID(), location: randomUUID() };
  const as = <T>(fn: () => Promise<T>, role: 'OWNER' | 'STAFF' = 'OWNER') =>
    withSignedInUser(
      {
        userId: own.user,
        organizationId: own.org,
        role,
        scope: 'LOCATION',
        vertical: 'BEAUTY',
        businessId: own.business,
        locationId: own.location,
      },
      fn,
    );
  const create = () => as(() => service.createEmployee({ name: 'Тестовый мастер' }));
  beforeAll(async () => {
    admin = createPrismaClient(url, 'pms_test');
    app = createPrismaClient(url, 'pms_test', { of: databaseTenant, appConnectionString: appUrl });
    service = new BeautyCatalogService({ db: app } as unknown as PrismaService);
    for (const o of [own, other]) {
      await admin.organization.create({
        data: { id: o.org, name: `PEOPLE-${o.org}`, status: 'ACTIVE' },
      });
      await admin.business.create({
        data: { id: o.business, organizationId: o.org, name: 'Тестовый салон', vertical: 'BEAUTY' },
      });
      await admin.location.create({
        data: {
          id: o.location,
          businessId: o.business,
          name: 'Тестовый филиал',
          timezone: 'UTC',
          currency: 'KZT',
        },
      });
    }
    await admin.user.create({
      data: { id: own.user, name: 'Тестовый владелец', email: `${own.user}@example.invalid` },
    });
  });
  afterAll(async () => {
    if (!admin) return;
    for (const o of [own, other]) {
      const employees = { businessId: o.business };
      await admin.employeeService.deleteMany({ where: { employee: employees } });
      await admin.employeeLocation.deleteMany({ where: { employee: employees } });
      await admin.employee.deleteMany({ where: employees });
      await admin.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('wetop.audit_purge', 'on', true)`;
        await tx.auditLog.deleteMany({ where: { organizationId: o.org } });
      });
      await admin.location.deleteMany({ where: { businessId: o.business } });
      await admin.business.delete({ where: { id: o.business } });
      await admin.organization.delete({ where: { id: o.org } });
    }
    await admin.user.delete({ where: { id: own.user } });
    await app.$disconnect();
    await admin.$disconnect();
  });

  it('application role is neither superuser nor BYPASSRLS nor Employee table owner', async () => {
    const rows = await as(
      () => app.$queryRaw<
        Array<{ role: string; superuser: boolean; bypass: boolean; owns: boolean }>
      >`
      SELECT current_user::text AS role, r.rolsuper AS superuser, r.rolbypassrls AS bypass,
      c.relowner = r.oid AS owns FROM pg_roles r, pg_class c, pg_namespace n
      WHERE r.rolname = current_user AND c.relnamespace = n.oid AND n.nspname = 'pms_test' AND c.relname = 'employees'`,
    );
    expect(rows).toEqual([{ role: 'wetop_app', superuser: false, bypass: false, owns: false }]);
  });
  it('stale profile does not overwrite a newer phone', async () => {
    const e = await create();
    const [stored] = await admin.$queryRaw<
      Array<{ token: string }>
    >`SELECT to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS token FROM employees WHERE id = ${e.id}::uuid`;
    const revision = stored!.token;
    const saved = await as(() =>
      service.updateEmployee(e.id, { phone: '+0000000001', expectedProfileRevision: revision }),
    );
    expect(saved.phone).toBe('+0000000001');
    await expect(
      as(() =>
        service.updateEmployee(e.id, { phone: '+0000000002', expectedProfileRevision: revision }),
      ),
    ).rejects.toThrow(/измен|конфликт/i);
    const row = await admin.employee.findUniqueOrThrow({ where: { id: e.id } });
    expect(row.phone).toBe('+0000000001');
  });
  it('legacy profile write without a token fails closed without changing data', async () => {
    const e = await create();
    const before = await admin.employee.findUniqueOrThrow({ where: { id: e.id } });
    await expect(as(() => service.updateEmployee(e.id, { phone: '+0000000003' }))).rejects.toThrow(/expectedProfileRevision required/);
    expect(await admin.employee.findUniqueOrThrow({ where: { id: e.id } })).toEqual(before);
  });
  it('two concurrent profile writes admit one winner', async () => {
    const e = await create();
    const token = profileToken(e);
    const results = await Promise.allSettled(
      ['Первое имя', 'Второе имя'].map((name) =>
        as(() => service.updateEmployee(e.id, { name, expectedProfileRevision: token })),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });
  it('successive writes advance the full timestamp token', async () => {
    let e = await create();
    let token = profileToken(e);
    for (let i = 0; i < 4; i++) {
      e = await as(() =>
        service.updateEmployee(e.id, { name: `Тестовое имя ${i}`, expectedProfileRevision: token }),
      );
      const next = profileToken(e);
      expect(next > token).toBe(true);
      token = next;
    }
  });
  it('an existing microsecond timestamp survives DB to API to request', async () => {
    const e = await create();
    await admin.$executeRaw`UPDATE employees SET updated_at = '2026-01-01T00:00:00.123456Z'::timestamptz WHERE id = ${e.id}::uuid`;
    const { items } = await as(() => service.employees());
    const token = profileToken(items.find((row) => row.id === e.id));
    expect(token).toBe('2026-01-01T00:00:00.123456Z');
    const updated = await as(() =>
      service.updateEmployee(e.id, { name: 'После точной версии', expectedProfileRevision: token }),
    );
    expect(profileToken(updated)).not.toBe(token);
  });
  it('profile status stays separate from membership and skills', async () => {
    const e = await create();
    const saved = await as(() =>
      service.updateEmployee(e.id, { active: false, expectedProfileRevision: profileToken(e) }),
    );
    expect(saved.active).toBe(false);
    expect(await admin.user.findUnique({ where: { id: own.user } })).not.toBeNull();
    expect(saved.serviceIds).toEqual([]);
  });
  it('a child services write does not advance the profile token', async () => {
    const e = await create();
    const before = profileToken(e);
    await as(() =>
      service.setEmployeeServices(e.id, {
        serviceIds: [],
        expectedRevision: e.servicesRevision,
      }),
    );
    const { items } = await as(() => service.employees());
    expect(profileToken(items.find((row) => row.id === e.id))).toBe(before);
  });
  it('foreign Employee and STAFF writes are rejected', async () => {
    const foreign = await admin.employee.create({
      data: { businessId: other.business, name: 'Чужой тестовый мастер' },
    });
    const sourceToken = profileToken(await create());
    await expect(as(() => service.updateEmployee(foreign.id, { name: 'Подмена', expectedProfileRevision: sourceToken }))).rejects.toThrow(
      /не найден/i,
    );
    const e = await create();
    await expect(
      as(() => service.updateEmployee(e.id, { name: 'Подмена' }), 'STAFF'),
    ).rejects.toThrow(/доступ|владелец|управляющ/i);
  });
});
