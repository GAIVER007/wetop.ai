import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { withSignedInUser } from '../auth/request-context';
import { assertBeautyOperation } from './access';

const actor = { userId: 'user-a', organizationId: 'org-a', role: 'STAFF' as const, scope: 'LOCATION' as const, businessId: 'salon-a', locationId: 'branch-a', vertical: 'BEAUTY' as const };
const assignment = (permissions: Array<{ section: string; action: string; scope: string }>, change: Record<string, unknown> = {}) => ({ businessId: 'salon-a', locationId: 'branch-a', revokedAt: null, position: { archivedAt: null, permissions }, ...change });
function fixture(rows: ReturnType<typeof assignment>[]) {
  return { beautyPositionAssignment: { findMany: vi.fn().mockResolvedValue(rows) } };
}

describe('server Beauty position enforcement', () => {
  it('allows an explicitly granted administrator refund without changing the STAFF role', async () => {
    const db = fixture([assignment([{ section: 'finance', action: 'refund', scope: 'BUSINESS' }])]);
    expect(await withSignedInUser(actor, () => assertBeautyOperation(db as never, 'finance', 'refund', { legacy: 'refunds' }))).toBe('BUSINESS');
    expect(db.beautyPositionAssignment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-a', organizationId: 'org-a' } }));
  });
  it('denies a refund to the master even when legacy MANAGER could refund', async () => {
    const db = fixture([assignment([{ section: 'appointments', action: 'view', scope: 'OWN' }])]);
    await expect(withSignedInUser({ ...actor, role: 'MANAGER' }, () => assertBeautyOperation(db as never, 'finance', 'refund', { legacy: 'refunds' }))).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('does not treat OWN as authorization for the general appointment list', async () => {
    const db = fixture([assignment([{ section: 'appointments', action: 'view', scope: 'OWN' }])]);
    await expect(withSignedInUser(actor, () => assertBeautyOperation(db as never, 'appointments', 'view', { legacy: 'desk' }))).rejects.toBeInstanceOf(ForbiddenException);
    expect(await withSignedInUser(actor, () => assertBeautyOperation(db as never, 'appointments', 'view', { legacy: 'desk', own: true }))).toBe('OWN');
  });
  it('denies other salons, unassigned branches and the last revoked assignment', async () => {
    const grant = [{ section: 'appointments', action: 'view', scope: 'BUSINESS' }];
    for (const row of [assignment(grant, { businessId: 'salon-b' }), assignment(grant, { locationId: 'branch-b' }), assignment(grant, { revokedAt: new Date() })]) {
      await expect(withSignedInUser(actor, () => assertBeautyOperation(fixture([row]) as never, 'appointments', 'view', { legacy: 'desk' }))).rejects.toBeInstanceOf(ForbiddenException);
    }
  });
  it('intersects new positions with existing membership restrictions', async () => {
    const db = fixture([assignment([{ section: 'finance', action: 'refund', scope: 'BUSINESS' }])]);
    await expect(withSignedInUser({ ...actor, scopes: [{ businessId: 'salon-b', locationId: null, role: 'STAFF' }] }, () => assertBeautyOperation(db as never, 'finance', 'refund', { legacy: 'refunds' }))).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('preserves legacy permissions only when there were never any new assignments', async () => {
    expect(await withSignedInUser(actor, () => assertBeautyOperation(fixture([]) as never, 'appointments', 'view', { legacy: 'desk' }))).toBe('BUSINESS');
    await expect(withSignedInUser(actor, () => assertBeautyOperation(fixture([]) as never, 'finance', 'refund', { legacy: 'refunds' }))).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('does not limit the owner or access another tenant for an unsigned caller', async () => {
    const db = fixture([]);
    expect(await withSignedInUser({ ...actor, role: 'OWNER' }, () => assertBeautyOperation(db as never, 'finance', 'refund', { legacy: 'refunds' }))).toBe('BUSINESS');
    await expect(withSignedInUser(null, () => assertBeautyOperation(db as never, 'finance', 'refund', { legacy: 'refunds' }))).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.beautyPositionAssignment.findMany).not.toHaveBeenCalled();
  });
});
