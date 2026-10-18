import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPrismaClient } from '@pms/database';
import { ForbiddenException } from '@nestjs/common';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { OwnerSummaryService } from '../../apps/api/src/finance/owner-summary';

// This executable is deliberately not a general-purpose database smoke command.
const fixtureUrl = 'postgresql://owner_home_test@127.0.0.1:55516/wetop_owner_home';
const heldTables = [
  'expense_categories', 'expense_documents', 'expense_settlements', 'payment_write_intents',
  'table_occupancy_sessions', 'table_occupancy_commands',
  'workload_tracking_coverage', 'resource_capacity_revisions', 'resource_capacity_intervals', 'workload_coverage_segments',
  'restaurant_opening_schedules', 'restaurant_opening_intervals', 'restaurant_opening_closures',
  'beauty_schedule_versions', 'beauty_capacity_intervals', 'appointment_workload_revisions',
  'hospitality_workload_versions', 'hospitality_workload_sources',
];
const rollback = new Error('owner-home baseline fixture rollback');
let phase = 'guards';

async function main() {
  assert.equal(process.env.CI, 'true', 'CI-only baseline');
  assert.equal(process.env.PMS_PORTAL_FIXTURE, 'owner-home-ci', 'Owned fixture required');
  assert.equal(process.env.DATABASE_URL, fixtureUrl, 'Only the dedicated CI database is allowed');
  assert.equal(process.env.DIRECT_URL, fixtureUrl, 'Direct URL must match the owned fixture');
  assert.ok(process.env.PGPASSWORD, 'CI fixture password required');
  for (const flag of ['BEAUTY_WORKLOAD_CAPTURE', 'HOSPITALITY_WORKLOAD_CAPTURE', 'RESTAURANT_CAPACITY_CAPTURE', 'RESTAURANT_OCCUPANCY_CAPTURE']) {
    assert.equal(process.env[flag], 'false', `${flag} must be OFF`);
  }
  assert.equal(process.env.EXPENSE_LINKS_ENABLED, '0', 'Expense links must be OFF');
  process.env.DATABASE_POOL_MAX = '1';
  const db = createPrismaClient(fixtureUrl, 'pms_test');
  const syntheticBusinessIds: string[] = [];
  let cases = 0;
  try {
    phase = 'catalog';
    // Before ANY fixture writes or held SQL: validate the real catalog, not feature mocks.
    const tables = await db.$queryRaw<Array<{ name: string }>>`
      SELECT tablename AS name FROM pg_tables WHERE schemaname IN ('pms_test','public')
    `;
    assert.deepEqual(tables.filter(row => heldTables.includes(row.name)), [], 'Held tables must be absent');
    const columns = await db.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema IN ('pms_test','public') AND table_name='cash_operations' AND column_name='currency_snapshot'
    `;
    assert.equal(columns.length, 0, 'Held hotel cash snapshot must be absent');
    const role = await db.$queryRaw<Array<{ rolsuper: boolean; rolbypassrls: boolean }>>`
      SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname='wetop_app'
    `;
    assert.deepEqual(role, [{ rolsuper: false, rolbypassrls: false }], 'Real non-bypass application role required');
    const now = new Date('2026-10-17T09:00:00Z');
    await assert.rejects(db.$transaction(async tx => {
      phase = 'fixture';
      const organization = await tx.organization.findFirst({ select: { id: true } });
      assert.ok(organization, 'Canonical seed organization required');
      const organizationId = organization.id;
      const fixtures = [];
      for (const vertical of ['BEAUTY', 'FOOD_SERVICE', 'HOSPITALITY'] as const) {
        const business = await tx.business.create({ data: { organizationId, name: 'Synthetic baseline business', vertical } });
        syntheticBusinessIds.push(business.id);
        const location = await tx.location.create({ data: { businessId: business.id, name: 'Synthetic baseline location', timezone: 'Asia/Almaty', currency: 'KZT' } });
        if (vertical === 'FOOD_SERVICE') {
          await tx.restaurantOrder.create({ data: { locationId: location.id, number: 1, status: 'CLOSED', currency: 'KZT', total: 12345n, openedAt: now, closedAt: now } });
        }
        if (vertical === 'HOSPITALITY') {
          const property = await tx.property.create({ data: { organizationId, locationId: location.id, name: 'Synthetic baseline hotel', timezone: 'Asia/Almaty', currency: 'KZT', checkInTime: '14:00', checkOutTime: '12:00' } });
          for (const kind of ['INCOME', 'EXPENSE'] as const) {
            await tx.cashOperation.create({ data: { propertyId: property.id, kind, method: 'CASH', status: 'COMPLETED', amount: 700n, occurredAt: now } });
          }
        }
        fixtures.push({ vertical, businessId: business.id, locationId: location.id });
      }
      phase = 'role';
      // All service reads use the actual application role and tenant GUC on this transaction.
      await tx.$executeRawUnsafe('SET LOCAL ROLE wetop_app');
      await tx.$queryRaw`SELECT set_config('app.org_id', ${organizationId}, true)`;
      const active = await tx.$queryRaw<Array<{ role: string; tenant: string }>>`
        SELECT current_user AS role, current_setting('app.org_id') AS tenant
      `;
      assert.deepEqual(active, [{ role: 'wetop_app', tenant: organizationId }]);
      const service = new OwnerSummaryService({ db: tx } as never);
      for (const fixture of fixtures) {
        const actor = { userId: randomUUID(), organizationId, role: 'OWNER' as const, scope: 'LOCATION' as const, ...fixture };
        for (const period of ['today', 'week', 'month']) {
          phase = `${fixture.vertical}:${period}`;
          const result = await withSignedInUser(actor, () => service.report(period, now));
          assert.deepEqual(result.scope, { locationId: fixture.locationId, organizationId, vertical: fixture.vertical });
          assert.equal(result.period.key, period);
          assert.equal(result.state, 'PARTIAL');
          assert.equal(result.workload.state, 'UNAVAILABLE');
          assert.match(result.workload.reason ?? '', /^CAPTURE_DISABLED/);
          assert.equal(result.classificationState, 'UNAVAILABLE');
          assert.equal(result.classificationReason, 'EXPENSE_DOCUMENT_LINKS_NOT_CONNECTED');
          if (fixture.vertical === 'FOOD_SERVICE') {
            assert.deepEqual(result.current.revenue.currencies, [{ currency: 'KZT', amountMinor: '12345' }]);
          }
          if (fixture.vertical === 'HOSPITALITY') {
            for (const money of [result.current.receipts, result.current.paidExpenses]) {
              assert.equal(money.state, 'PARTIAL');
              assert.equal(money.reason, 'UNKNOWN_SOURCE_CURRENCY');
              assert.deepEqual(money.currencies, []);
              assert.equal('unresolvedSources' in money && money.unresolvedSources, 1);
            }
          }
          cases++;
        }
        phase = `scope-check-${fixture.vertical}`;
        // Existing semantics are 403, not a successful empty report or a first-hotel fallback.
        await assert.rejects(withSignedInUser({ ...actor, locationId: randomUUID() }, () => service.report('today', now)), ForbiddenException);
        await assert.rejects(withSignedInUser({ ...actor, scope: 'ORGANIZATION', locationId: undefined }, () => service.report('today', now)), ForbiddenException);
        await assert.rejects(withSignedInUser({ ...actor, role: 'STAFF', scopes: [{ role: 'STAFF', businessId: randomUUID(), locationId: null }] }, () => service.report('today', now)), ForbiddenException);
        phase = `RLS:${fixture.vertical}`;
        // Actor alone cannot bypass SQL tenant isolation, including the hospitality joins.
        await tx.$queryRaw`SELECT set_config('app.org_id', ${randomUUID()}, true)`;
        assert.equal(await tx.location.findFirst({ where: { id: fixture.locationId } }), null);
        await assert.rejects(withSignedInUser(actor, () => service.report('today', now)), ForbiddenException);
        await tx.$queryRaw`SELECT set_config('app.org_id', ${organizationId}, true)`;
      }
      phase = 'rollback';
      assert.equal(cases, 9);
      throw rollback;
    }, { maxWait: 5000, timeout: 60000 }), error => error === rollback);
    assert.equal(await db.business.count({ where: { id: { in: syntheticBusinessIds } } }), 0, 'Synthetic fixture must roll back');
    console.log(`Owner home canonical no-held baseline: ${cases}/9 real service cases passed; authorization/RLS checked; fixture rolled back.`);
  } finally {
    const previousPhase = phase;
    phase = 'disconnect';
    await db.$disconnect();
    phase = previousPhase;
  }
}

main().catch((error: unknown) => {
  // Emit only bounded class/code metadata, never message, stack, arguments or URLs.
  const metadata = error as { name?: unknown; code?: unknown } | null;
  const classes = ['AssertionError', 'Error', 'ForbiddenException', 'PrismaClientKnownRequestError', 'PrismaClientUnknownRequestError', 'PrismaClientValidationError', 'PrismaClientInitializationError'];
  const errorClass = typeof metadata?.name === 'string' && classes.includes(metadata.name) ? metadata.name : 'Error';
  const code = typeof metadata?.code === 'string' && /^(?:P[0-9]{4}|ERR_ASSERTION|[0-9A-Z]{5})$/.test(metadata.code) ? metadata.code : 'NONE';
  console.error(`Owner home canonical no-held baseline FAILED phase=${phase} class=${errorClass} code=${code}`);
  process.exitCode = 1;
});
