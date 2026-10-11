import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { withSignedInUser } from '../auth/request-context';
import type { PrismaService } from '../database/prisma.provider';
import { HotelService } from './hotel.module';
import { OnboardingService } from './onboarding';

const inBranch = <T>(locationId: string, fn: () => Promise<T>) =>
  withSignedInUser(
    {
      userId: 'synthetic-owner',
      organizationId: 'synthetic-org',
      role: 'OWNER',
      scope: 'LOCATION',
      businessId: 'synthetic-business',
      vertical: 'HOSPITALITY',
      locationId,
    },
    fn,
  );

function fixture() {
  const findFirst = vi.fn(
    async ({ where }: { where: { organizationId: string; locationId?: string } }) => {
      if (where.locationId === 'missing') return null;
      return {
        id: where.locationId ?? 'first',
        name: where.locationId ?? 'first',
        currency: 'KZT',
        timezone: 'Asia/Almaty',
      };
    },
  );
  const db = {
    property: { findFirst },
    ratePlan: { findMany: vi.fn(async () => []) },
    accommodationType: { count: vi.fn(async () => 0) },
    inventoryUnit: { count: vi.fn(async () => 0) },
    organization: { findUnique: vi.fn(async () => ({ name: 'Synthetic' })) },
  };
  const prisma = { db } as unknown as PrismaService;
  const hotel = new HotelService(prisma);
  return { findFirst, hotel, onboarding: new OnboardingService(prisma, hotel) };
}

describe('контекст филиала', () => {
  it('настройки двух филиалов и их кэш не смешиваются', async () => {
    const { hotel, findFirst } = fixture();
    const a = await inBranch('branch-a', () => hotel.settings());
    const b = await inBranch('branch-b', () => hotel.settings());
    const again = await inBranch('branch-a', () => hotel.settings());
    expect(a.property.id).toBe('branch-a');
    expect(b.property.id).toBe('branch-b');
    expect(again.property.id).toBe('branch-a');
    expect(findFirst).toHaveBeenCalledTimes(2);
    for (const [arg] of findFirst.mock.calls)
      expect(arg.where.organizationId).toBe('synthetic-org');
  });
  it('онбординг читает выбранный филиал', async () => {
    const { onboarding } = fixture();
    expect((await inBranch('branch-b', () => onboarding.status())).name).toBe('branch-b');
  });
  it('без указателя scope онбординг берёт самый ранний объект, как property-ref, а не случайный', async () => {
    const { onboarding, findFirst } = fixture();
    await withSignedInUser(
      { userId: 'synthetic-owner', organizationId: 'synthetic-org', role: 'OWNER' },
      () => onboarding.status(),
    );
    const [arg] = findFirst.mock.calls[0] as [{ orderBy?: unknown }];
    expect(arg.orderBy).toEqual({ createdAt: 'asc' });
  });
  it('исчезнувший выбранный филиал не превращается в создание другого объекта', async () => {
    const { onboarding } = fixture();
    await expect(inBranch('missing', () => onboarding.status())).rejects.toThrow();
  });
});
