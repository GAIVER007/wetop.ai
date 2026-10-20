import { describe, expect, it } from 'vitest';
import { beautyPermissionScope, parseBeautyPermissions, resolveBeautyPositionAccess, type BeautyPermission, type BeautyAssignment } from './access';

const own = { section: 'appointments', action: 'view', scope: 'OWN' } as const;
const refund = { section: 'finance', action: 'refund', scope: 'BUSINESS' } as const;
const binding = (change: Partial<BeautyAssignment> = {}): BeautyAssignment => ({
  businessId: 'salon-a', locationId: 'branch-a', revokedAt: null,
  position: { archivedAt: null, permissions: [own] }, ...change,
});

describe('Beauty custom position matrix', () => {
  it('accepts an explicit refund grant but never infers it from a name or finance editing', () => {
    const parsed = parseBeautyPermissions([refund, { section: 'finance', action: 'update', scope: 'BUSINESS' }]);
    expect(parsed.ok).toBe(true);
    expect(beautyPermissionScope([{ section: 'finance', action: 'update', scope: 'BUSINESS' }], 'finance', 'refund')).toBeNull();
    expect(beautyPermissionScope([refund], 'finance', 'refund')).toBe('BUSINESS');
  });
  it('allows only own views of schedule, visits, salary and reviews', () => {
    for (const section of ['journal', 'appointments', 'payroll', 'reviews'])
      expect(parseBeautyPermissions([{ section, action: 'view', scope: 'OWN' }]).ok).toBe(true);
    for (const section of ['customers', 'employees', 'services', 'finance', 'stock', 'settings'])
      expect(parseBeautyPermissions([{ section, action: 'view', scope: 'OWN' }]).ok).toBe(false);
    for (const action of ['create', 'update', 'delete', 'refund'])
      expect(parseBeautyPermissions([{ ...own, action }]).ok).toBe(false);
  });
  it('rejects unknown fields, sections, actions, scopes and duplicate section/action', () => {
    for (const value of [null, {}, [null], [{ ...own, section: 'owner' }], [{ ...own, action: 'export' }], [{ ...own, scope: 'ALL' }], [{ ...own, extra: true }], [own, own], [{ ...own, action: 'refund', scope: 'BUSINESS' }]])
      expect(parseBeautyPermissions(value).ok).toBe(false);
    expect(parseBeautyPermissions([])).toEqual({ ok: true, value: [] });
  });
  it('keeps legacy mode only before the first new assignment', () => {
    expect(resolveBeautyPositionAccess([], { businessId: 'salon-a', locationId: 'branch-a' })).toEqual({ mode: 'LEGACY', assigned: false, permissions: [] });
    expect(resolveBeautyPositionAccess([binding()], { businessId: 'salon-b', locationId: 'branch-a' })).toEqual({ mode: 'ASSIGNED', assigned: false, permissions: [] });
  });
  it('does not restore legacy access after the last assignment is revoked or archived', () => {
    const target = { businessId: 'salon-a', locationId: 'branch-a' };
    for (const row of [binding({ revokedAt: new Date() }), binding({ position: { archivedAt: new Date(), permissions: [refund] } })])
      expect(resolveBeautyPositionAccess([row], target)).toEqual({ mode: 'ASSIGNED', assigned: false, permissions: [] });
  });
  it('requires a business assignment for business-wide data and does not expand a branch', () => {
    expect(resolveBeautyPositionAccess([binding()], { businessId: 'salon-a', locationId: null }).assigned).toBe(false);
    expect(resolveBeautyPositionAccess([binding()], { businessId: 'salon-a', locationId: 'branch-b' }).assigned).toBe(false);
    const all = binding({ locationId: null });
    expect(resolveBeautyPositionAccess([all], { businessId: 'salon-a', locationId: 'branch-b' })).toMatchObject({ assigned: true, permissions: [own] });
  });
  it('combines only applicable grants and prefers BUSINESS over OWN without mutating input', () => {
    const business: BeautyPermission = { ...own, scope: 'BUSINESS' };
    const input = [binding({ locationId: null }), binding({ position: { archivedAt: null, permissions: [business, refund] } })];
    const selected = resolveBeautyPositionAccess(input, { businessId: 'salon-a', locationId: 'branch-a' });
    expect(beautyPermissionScope(selected.permissions, 'appointments', 'view')).toBe('BUSINESS');
    expect(beautyPermissionScope(selected.permissions, 'finance', 'refund')).toBe('BUSINESS');
    expect(input[0]!.position.permissions).toEqual([own]);
  });
});
