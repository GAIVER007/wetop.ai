import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Prisma } from '@pms/database';
import { assertPortalDatabase, seedPortalFixture } from '../employee-portal-ui/fixture-support';

const db = createPrismaClient(assertPortalDatabase(), 'pms_test');
let f: Awaited<ReturnType<typeof seedPortalFixture>>;
const mediaId = randomUUID(), workId = randomUUID(), slug = `portal-rls-${randomUUID()}`;
const tables = [
  ['employee_public_profiles', 'employee_id'],
  ['employee_media', 'id'],
  ['employee_portfolio_items', 'id'],
  ['beauty_payroll_policies', 'business_id'],
] as const;

async function asOrg<T>(organizationId: string, run: (tx: Prisma.TransactionClient) => Promise<T>) {
  return db.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET LOCAL ROLE wetop_app');
    await tx.$queryRaw`SELECT set_config('app.org_id', ${organizationId}, true)`;
    return run(tx);
  });
}
function rowId(table: string) {
  return table === 'employee_public_profiles' ? f.employeeA
    : table === 'employee_media' ? mediaId : table === 'employee_portfolio_items' ? workId : f.businessA;
}

beforeAll(async () => {
  f = await seedPortalFixture(db);
  await db.employeePublicProfile.upsert({ where: { employeeId: f.employeeA }, update: { slug }, create: { employeeId: f.employeeA, slug } });
  await db.employeeMedia.create({ data: { id: mediaId, employeeId: f.employeeA, kind: 'PORTFOLIO', storageRef: `rls-fixture/${mediaId}`, mimeType: 'image/png', width: 1, height: 1, byteSize: 1, sha256: '0'.repeat(64) } });
  await db.employeePortfolioItem.create({ data: { id: workId, employeeId: f.employeeA, mediaId, serviceId: f.serviceId, title: 'RLS fixture, not a real client work' } });
  await db.beautyPayrollPolicy.create({ data: { businessId: f.businessA, percentBasis: 'COMPLETED_SERVICES' } });
});
afterAll(async () => { await db.$disconnect(); });

describe('portal tables enforce tenant isolation in PostgreSQL, not only HTTP', () => {
  it.each(tables)('%s is visible only to the owning tenant', async (table, key) => {
    // Identifiers below come only from the constant table list, IDs stay bound parameters.
    const sql = `SELECT "${key}" FROM pms_test."${table}" WHERE "${key}"=$1::uuid`;
    expect(await asOrg(f.organizationA, tx => tx.$queryRawUnsafe(sql, rowId(table)))).toHaveLength(1);
    expect(await asOrg(f.organizationB, tx => tx.$queryRawUnsafe(sql, rowId(table)))).toHaveLength(0);
    expect(await asOrg('', tx => tx.$queryRawUnsafe(sql, rowId(table)))).toHaveLength(0);
  });
  it.each(tables)('%s denies foreign updates/deletes and retains the row', async (table, key) => {
    expect(await asOrg(f.organizationB, tx => tx.$executeRawUnsafe(`UPDATE pms_test."${table}" SET "${key}"="${key}" WHERE "${key}"=$1::uuid`, rowId(table)))).toBe(0);
    expect(await asOrg(f.organizationB, tx => tx.$executeRawUnsafe(`DELETE FROM pms_test."${table}" WHERE "${key}"=$1::uuid`, rowId(table)))).toBe(0);
    expect(await asOrg(f.organizationA, tx => tx.$queryRawUnsafe(`SELECT "${key}" FROM pms_test."${table}" WHERE "${key}"=$1::uuid`, rowId(table)))).toHaveLength(1);
  });
  it('has no PUBLIC table grants or PUBLIC resolver execution grant', async () => {
    const grants = await db.$queryRaw<Array<{ relname: string }>>`
      SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
      WHERE n.nspname='pms_test' AND c.relname IN ('employee_public_profiles','employee_media','employee_portfolio_items','beauty_payroll_policies')
      AND a.grantee=0 AND a.privilege_type IN ('SELECT','INSERT','UPDATE','DELETE')`;
    expect(grants).toEqual([]);
    const executions = await db.$queryRaw<Array<{ proname: string }>>`
      SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      WHERE n.nspname='pms_test' AND p.proname='resolve_public_employee' AND a.grantee=0 AND a.privilege_type='EXECUTE'`;
    expect(executions).toEqual([]);
  });
  it('public resolver denies drafts and returns identifiers only after explicit consent', async () => {
    const resolve = () => asOrg('', tx => tx.$queryRaw<Array<{ employee_id: string; organization_id: string }>>`SELECT * FROM pms_test.resolve_public_employee(${slug})`);
    expect(await resolve()).toEqual([]);
    await db.employeePublicProfile.update({ where: { employeeId: f.employeeA }, data: { publicationConsent: true, published: true } });
    expect(await resolve()).toEqual([{ employee_id: f.employeeA, organization_id: f.organizationA }]);
    await db.employeePublicProfile.update({ where: { employeeId: f.employeeA }, data: { published: false } });
    expect(await resolve()).toEqual([]);
  });
});
