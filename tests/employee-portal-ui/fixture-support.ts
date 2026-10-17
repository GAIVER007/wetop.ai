import { randomUUID } from 'node:crypto';
import type { Db } from '@pms/database';
import type { SignedInUser } from '../../apps/api/src/auth/auth.service';

export type PortalVertical = 'BEAUTY' | 'FOOD_SERVICE';
// Includes both the real HTTP identity and the request-context identity consumed by integration tests.
export type PortalActor = SignedInUser & { userId: string; scope: 'BUSINESS'; businessId: string; vertical: PortalVertical };

/** Explicit owned loopback clusters, or the dedicated GitHub job DB. Never production/shared targets. */
export function assertPortalDatabase() {
  const raw = process.env.DATABASE_URL;
  if (!raw || process.env.NODE_ENV === 'production') throw new Error('An explicit isolated portal fixture database is required');
  let u: URL;
  try { u = new URL(raw); } catch { throw new Error('Invalid portal fixture database target'); }
  const ownLocal = (['55603', '55613'].includes(u.port) && u.pathname === '/pmslocal') || (u.port === '55743' && u.pathname === '/wetop_tz21');
  const githubJob = process.env.CI === 'true' && process.env.GITHUB_ACTIONS === 'true'
    && u.port === '5432' && u.pathname === '/pms_dev';
  if (u.protocol !== 'postgresql:' || u.hostname !== '127.0.0.1' || u.search || u.hash || (!ownLocal && !githubJob))
    throw new Error('Portal fixtures require an owned loopback cluster or the dedicated GitHub job database');
  return raw;
}

/** Each reset creates a fresh isolated synthetic pair; never deletes another run's data. */
export async function seedPortalFixture(db: Db, vertical: PortalVertical = 'BEAUTY') {
  assertPortalDatabase();
  if (vertical !== 'BEAUTY' && vertical !== 'FOOD_SERVICE') throw new Error('Unsupported fixture vertical');
  return db.$transaction(async tx => {
    const tag = randomUUID();
    const a = await tx.organization.create({ data: { name: `portal-fixture-A-${tag}`, status: 'ACTIVE' } });
    const b = await tx.organization.create({ data: { name: `portal-fixture-B-${tag}`, status: 'ACTIVE' } });
    const ba = await tx.business.create({ data: { organizationId: a.id, name: 'Synthetic business A', vertical } });
    const bb = await tx.business.create({ data: { organizationId: b.id, name: 'Synthetic business B', vertical } });
    const locations = [];
    for (const [businessId, name] of [[ba.id, 'Centre'], [ba.id, 'Park'], [bb.id, 'Other tenant']]) {
      locations.push(await tx.location.create({ data: { businessId: businessId!, name: name!, timezone: 'Asia/Almaty', currency: 'KZT' } }));
    }
    const actor = async (name: string, organizationId: string, businessId: string, role: 'OWNER' | 'STAFF'): Promise<PortalActor> => {
      const user = await tx.user.create({ data: { name, email: `${name.toLowerCase()}-${tag}@example.invalid`, emailVerifiedAt: new Date(), status: 'ACTIVE' } });
      await tx.membership.create({ data: { userId: user.id, organizationId, role } });
      return { id: user.id, userId: user.id, name, email: user.email, organizationId, role, platformAdmin: false, scope: 'BUSINESS', businessId, vertical };
    };
    const actors = {
      ownerA: await actor('ownerA', a.id, ba.id, 'OWNER'),
      staffA: await actor('staffA', a.id, ba.id, 'STAFF'),
      staffB: await actor('staffB', a.id, ba.id, 'STAFF'),
      ownerB: await actor('ownerB', b.id, bb.id, 'OWNER'),
    };
    const ea = await tx.employee.create({ data: { businessId: ba.id, name: vertical === 'BEAUTY' ? 'Synthetic specialist A' : 'Synthetic waiter A', userId: actors.staffA.id, email: 'private@example.invalid' } });
    const eb = await tx.employee.create({ data: { businessId: ba.id, name: 'Synthetic employee B', userId: actors.staffB.id } });
    await tx.employee.create({ data: { businessId: bb.id, name: 'Other tenant employee', userId: actors.ownerB.id } });
    for (const employeeId of [ea.id, eb.id]) for (const location of locations.slice(0, 2))
      await tx.employeeLocation.create({ data: { employeeId, locationId: location.id } });
    let serviceId: string | null = null;
    if (vertical === 'BEAUTY') {
      const service = await tx.beautyService.create({ data: { businessId: ba.id, name: 'Synthetic haircut', durationMinutes: 45, price: 5000n, currency: 'KZT' } });
      serviceId = service.id;
      for (const [index, location] of locations.slice(0, 2).entries())
        await tx.locationService.create({ data: { locationId: location.id, serviceId, priceOverride: index === 0 ? 6500n : 7000n } });
      await tx.employeeService.create({ data: { employeeId: ea.id, serviceId } });
    }
    const now = new Date();
    const period = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    if (vertical === 'FOOD_SERVICE') {
      await tx.employeePaySetting.create({ data: { employeeId: ea.id, model: 'FIXED_PLUS_PERCENT', fixedMinor: 150000n, percent: 15, currency: 'KZT', updatedById: actors.ownerA.id } });
      await tx.employeePayAdjustment.create({ data: { employeeId: ea.id, period, amountMinor: 5000n, reason: 'Synthetic bonus', createdById: actors.ownerA.id } });
      await tx.employeePayAdjustment.create({ data: { employeeId: ea.id, period, amountMinor: -1000n, reason: 'Synthetic adjustment', createdById: actors.ownerA.id } });
      await tx.restaurantCashOperation.create({ data: { locationId: locations[0]!.id, kind: 'EXPENSE', method: 'CASH', amount: 20000n, currency: 'KZT', employeeId: ea.id, period, createdById: actors.ownerA.id } });
      for (const [index, location] of locations.slice(0, 2).entries()) {
        const order = await tx.restaurantOrder.create({ data: { locationId: location.id, number: 1, waiterId: ea.id, status: 'CLOSED', total: index === 0 ? 10000n : 20000n, currency: 'KZT', openedAt: now, closedAt: now, createdById: actors.ownerA.id } });
        await tx.restaurantPayment.create({ data: { locationId: location.id, orderId: order.id, method: 'CASH', amount: order.total, currency: 'KZT', idempotencyKey: randomUUID(), paidAt: now, createdById: actors.ownerA.id } });
      }
    }
    return { actors, employeeA: ea.id, employeeB: eb.id, locationA: locations[0]!.id, locationB: locations[1]!.id, businessA: ba.id, businessB: bb.id, organizationA: a.id, organizationB: b.id, serviceId, vertical, month: period.toISOString().slice(0, 7) };
  }, { timeout: 20000 });
}
