import { describe, expect, it, vi } from 'vitest';
import { withSignedInUser } from '../auth/request-context';
import type { PrismaService } from '../database/prisma.provider';
import { SharedOnboardingService } from './onboarding.module';
const actor: Exclude<Parameters<typeof withSignedInUser>[0], string | null> = {
  userId: 'user',
  organizationId: 'org',
  role: 'OWNER',
  scope: 'LOCATION',
  businessId: 'business',
  locationId: 'location',
  vertical: 'BEAUTY',
};
function fixture() {
  const db = {
    location: {
      findFirst: vi
        .fn()
        .mockResolvedValue({
          id: 'location',
          businessId: 'business',
          name: 'Филиал',
          timezone: 'Asia/Almaty',
          currency: 'KZT',
          business: {
            name: 'Бизнес',
            vertical: 'BEAUTY',
            organization: { status: 'ACTIVE', trialEndsAt: null },
          },
        }),
    },
    onboardingProgress: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn() },
    $transaction: vi.fn(),
  };
  return { db, service: new SharedOnboardingService({ db } as unknown as PrismaService) };
}
describe('MV3 trusted onboarding context', () => {
  it('requires explicit verified Business and Location', async () => {
    const { service, db } = fixture();
    await expect(
      withSignedInUser({ ...actor, businessId: '' }, () => service.status()),
    ).rejects.toThrow();
    expect(db.location.findFirst).not.toHaveBeenCalled();
  });
  it('filters the chain by organization, Business, Location and active status', async () => {
    const { service, db } = fixture();
    const state = await withSignedInUser(actor, () => service.status());
    expect(db.location.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'location',
          businessId: 'business',
          status: 'ACTIVE',
          business: { organizationId: 'org', status: 'ACTIVE' },
        },
      }),
    );
    expect(state.vertical).toBe('BEAUTY');
    expect(state.currentStep).toBe('business');
  });
  it('denies another Business without writing anything', async () => {
    const { service, db } = fixture();
    db.location.findFirst.mockResolvedValue(null);
    await expect(withSignedInUser(actor, () => service.status())).rejects.toThrow();
    expect(db.onboardingProgress.upsert).not.toHaveBeenCalled();
  });
  it('STAFF cannot mutate even by calling service directly', async () => {
    const { service, db } = fixture();
    await expect(
      withSignedInUser({ ...actor, role: 'STAFF' }, () => service.save({ action: 'next' })),
    ).rejects.toThrow();
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('rejects client supplied vertical and tenant selectors', async () => {
    const { service, db } = fixture();
    await expect(
      withSignedInUser(actor, () => service.save({ vertical: 'HOSPITALITY', action: 'next' })),
    ).rejects.toThrow();
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

it('READ_ONLY organization denies owner mutation before any write', async () => {
  const { service, db } = fixture();
  const location = await db.location.findFirst();
  db.location.findFirst.mockResolvedValue({
    ...location,
    business: { ...location.business, organization: { status: 'READ_ONLY', trialEndsAt: null } },
  });
  await expect(
    withSignedInUser(actor, () => service.save({ action: 'next', draft: {} })),
  ).rejects.toThrow();
  expect(db.$transaction).not.toHaveBeenCalled();
});
