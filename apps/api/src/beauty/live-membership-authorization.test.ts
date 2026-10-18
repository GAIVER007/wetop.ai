import { ForbiddenException } from '@nestjs/common';
import type { ScopeAssignment } from '@pms/domain';
import { describe, expect, it, vi } from 'vitest';
import {
  withSignedInUser,
  withVerifiedBeautyOperation,
  type VerifiedBeautyOperation,
} from '../auth/request-context';
import * as beautyAccess from './access';
import { beautyTransaction, type BeautyScope } from './scope';

const organizationId = '72000000-0000-4000-8000-000000000001';
const businessA = '72000000-0000-4000-8000-000000000002';
const businessB = '72000000-0000-4000-8000-000000000004';
const locationB = '72000000-0000-4000-8000-000000000005';
const userId = '72000000-0000-4000-8000-000000000006';

const snapshotScopes: ScopeAssignment[] = [
  { role: 'STAFF', businessId: businessB, locationId: locationB },
  { role: 'MANAGER', businessId: businessA, locationId: null },
];
const actor = {
  userId,
  organizationId,
  role: 'STAFF' as const,
  scope: 'LOCATION' as const,
  businessId: businessB,
  locationId: locationB,
  vertical: 'BEAUTY' as const,
  scopes: snapshotScopes,
};
const operation: VerifiedBeautyOperation = {
  section: 'journal',
  action: 'update',
  legacy: 'staff',
};
const selectedScope: BeautyScope = {
  organizationId,
  businessId: businessB,
  locationId: locationB,
  locationName: 'Synthetic branch B',
  locationCurrency: 'USD',
  locationTimezone: 'UTC',
};

type LiveMembership = { role: 'OWNER' | 'MANAGER' | 'STAFF'; status: 'ACTIVE' | 'SUSPENDED' };
type MembershipAssertion = (tx: unknown) => Promise<void>;
const assertCurrentBeautyMembership = (
  beautyAccess as unknown as { assertCurrentBeautyMembership: MembershipAssertion }
).assertCurrentBeautyMembership;

function fixture(liveMembership: LiveMembership, liveScopes: ScopeAssignment[]) {
  const membershipRows = liveScopes.map((row) => ({ ...row }));
  const tx = {
    $queryRaw: vi.fn(async (parts: TemplateStringsArray) =>
      parts.join(' ').includes('memberships') ? [liveMembership] : [{ id: businessB }],
    ),
    membershipScope: {
      findMany: vi.fn(async () => membershipRows),
    },
    organization: {
      findUnique: vi.fn(async () => ({ status: 'ACTIVE', trialEndsAt: null })),
    },
    business: {
      findFirst: vi.fn(async () => ({ id: businessB, organizationId, vertical: 'BEAUTY', status: 'ACTIVE' })),
    },
    location: {
      findFirst: vi.fn(async () => ({
        id: locationB,
        businessId: businessB,
        status: 'ACTIVE',
        name: 'Synthetic branch B',
        currency: 'USD',
        timezone: 'UTC',
      })),
      findMany: vi.fn(async () => []),
    },
    beautyPositionAssignment: {
      findMany: vi.fn(async () => [{
        userId,
        organizationId,
        businessId: businessB,
        locationId: locationB,
        revokedAt: null,
        position: {
          archivedAt: null,
          permissions: [{ section: 'journal', action: 'update', scope: 'BUSINESS' }],
        },
      }]),
    },
  };
  const prisma = {
    db: {
      $transaction: vi.fn(async (fn: (inner: typeof tx) => Promise<unknown>) => fn(tx)),
    },
  };
  return { tx, prisma };
}

async function inBeautyRequest<T>(run: () => Promise<T>): Promise<T> {
  return withSignedInUser(actor, () => withVerifiedBeautyOperation(operation, run));
}

describe('live Beauty membership authorization', () => {
  it('rejects a membership suspended after route authorization', async () => {
    const f = fixture({ role: 'MANAGER', status: 'SUSPENDED' }, snapshotScopes);

    await expect(inBeautyRequest(() => assertCurrentBeautyMembership(f.tx)))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a branch scope changed after route authorization', async () => {
    const f = fixture(
      { role: 'MANAGER', status: 'ACTIVE' },
      [{ role: 'MANAGER', businessId: businessA, locationId: null }],
    );

    await expect(inBeautyRequest(() => assertCurrentBeautyMembership(f.tx)))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a selected-place role changed after route authorization', async () => {
    const f = fixture(
      { role: 'MANAGER', status: 'ACTIVE' },
      [
        { role: 'MANAGER', businessId: businessB, locationId: locationB },
        { role: 'MANAGER', businessId: businessA, locationId: null },
      ],
    );

    await expect(inBeautyRequest(() => assertCurrentBeautyMembership(f.tx)))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('accepts the same scopes in canonical order and the current branch-specific role', async () => {
    const f = fixture(
      { role: 'MANAGER', status: 'ACTIVE' },
      [...snapshotScopes].reverse(),
    );

    await expect(inBeautyRequest(() => assertCurrentBeautyMembership(f.tx))).resolves.toBeUndefined();
    expect(f.tx.membershipScope.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId, organizationId },
    }));
    const queries = f.tx.$queryRaw.mock.calls.map((call: unknown[]) => (call[0] as TemplateStringsArray).join(' '));
    expect(queries.some((query: string) => query.includes('memberships') && query.includes('FOR SHARE'))).toBe(true);
  });

  it('blocks a shared repository write when its request scope is stale', async () => {
    const f = fixture(
      { role: 'MANAGER', status: 'ACTIVE' },
      [{ role: 'MANAGER', businessId: businessA, locationId: null }],
    );
    const write = vi.fn(async () => 'written');

    await expect(inBeautyRequest(() => beautyAccess.runWithBeautyWriteAuthorization(f.tx as unknown as Parameters<typeof beautyAccess.runWithBeautyWriteAuthorization>[0], write)))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(write).not.toHaveBeenCalled();
  });

  it('blocks a Beauty domain transaction when membership was suspended', async () => {
    const f = fixture({ role: 'MANAGER', status: 'SUSPENDED' }, snapshotScopes);
    const write = vi.fn(async () => 'written');

    await expect(inBeautyRequest(() => beautyTransaction(f.prisma as never, selectedScope, write)))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(write).not.toHaveBeenCalled();
  });
});
