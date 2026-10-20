import { expect, it, vi } from 'vitest';
import { withSignedInUser } from '../auth/request-context';
import { captureInventoryBeforeWrite, verifiedLocationProperty } from './inventory-history';
const actor = { userId: 'synthetic', organizationId: 'org', businessId: 'business', locationId: 'location', role: 'OWNER' as const };
it('service refuses read-only organizations even without the HTTP guard', async () => {
 const tx = { property: { findFirst: vi.fn().mockResolvedValue({ id: 'property' }) }, organization: { findUnique: vi.fn().mockResolvedValue({ status: 'SUSPENDED', trialEndsAt: null }) }, $queryRaw: vi.fn().mockResolvedValue([]) };
 await expect(withSignedInUser(actor, () => captureInventoryBeforeWrite(tx as never, 'property'))).rejects.toThrow('только для чтения');
});
it('no selected location never falls back to first property', async () => {
 const db = { property: { findFirst: vi.fn() } };
 const { userId, organizationId, businessId, role } = actor;
 const withoutLocation = { userId, organizationId, businessId, role };
 await expect(withSignedInUser(withoutLocation, () => verifiedLocationProperty(db as never))).rejects.toThrow();
 expect(db.property.findFirst).not.toHaveBeenCalled();
});
it('capture stays off before held 118 unless explicitly enabled', async () => {
 const previous = process.env.HOSPITALITY_WORKLOAD_CAPTURE;
 delete process.env.HOSPITALITY_WORKLOAD_CAPTURE;
 const tx = { property: { findFirst: vi.fn().mockResolvedValue({ id: 'property' }) }, organization: { findUnique: vi.fn().mockResolvedValue({ status: 'ACTIVE', trialEndsAt: null }) }, $queryRaw: vi.fn().mockResolvedValue([]) };
 try {
 await withSignedInUser(actor, () => captureInventoryBeforeWrite(tx as never, 'property'));
 expect(tx.$queryRaw.mock.calls.every(([sql]) => !String(sql).includes('capture_hospitality'))).toBe(true);
 } finally { if (previous !== undefined) process.env.HOSPITALITY_WORKLOAD_CAPTURE = previous; }
});
