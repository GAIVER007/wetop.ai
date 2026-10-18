import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { withSignedInUser } from '../auth/request-context';
import { BeautyPositionsService } from './positions';
import type { PrismaService } from '../database/prisma.provider';
const B = '11111111-1111-4111-8111-111111111111';
const actor = { userId: 'user', organizationId: 'org', role: 'OWNER' as const, scope: 'BUSINESS' as const, businessId: B, vertical: 'BEAUTY' as const };
function fixture() {
  const transaction = vi.fn();
  return { transaction, service: new BeautyPositionsService({ db: { $transaction: transaction, organization: { findUnique: async () => ({ status: 'ACTIVE', trialEndsAt: null }) }, business: { findFirst: async () => ({ id: B }) } } } as unknown as PrismaService) };
}
describe('Beauty position management boundary', () => {
  it('rejects ordinary STAFF regardless of the requested position name', async () => {
    const f = fixture();
    await expect(withSignedInUser({ ...actor, role: 'STAFF' }, () => f.service.create({ name: 'Администратор', permissions: [] }))).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.transaction).not.toHaveBeenCalled();
  });
  it('does not let a manager of one branch change business-wide position definitions', async () => {
    const f = fixture();
    await expect(withSignedInUser({ ...actor, role: 'MANAGER', scope: 'LOCATION', locationId: 'branch', scopes: [{ businessId: B, locationId: 'branch', role: 'MANAGER' }] }, () => f.service.create({ name: 'Тест', permissions: [] }))).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.transaction).not.toHaveBeenCalled();
  });
  it('validates the name and explicit permission matrix before a write', async () => {
    for (const body of [{ name: '', permissions: [] }, { name: 'Тест', permissions: [{ section: 'finance', action: 'refund', scope: 'OWN' }] }, { name: 'Тест', permissions: [], role: 'OWNER' }]) {
      const f = fixture();
      await expect(withSignedInUser(actor, () => f.service.create(body))).rejects.toBeInstanceOf(BadRequestException);
      expect(f.transaction).not.toHaveBeenCalled();
    }
  });
});
