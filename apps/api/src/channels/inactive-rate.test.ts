import { expect, it, vi } from 'vitest';
import { PrismaChannelsRepository } from './channels.repository';
import { forgetPropertyRef } from '../database/property-ref';
import type { PrismaService } from '../database/prisma.provider';

it('отключённый тариф нельзя использовать при создании сопоставлений Channex', async () => {
  forgetPropertyRef();
  const property = {
    id: 'property',
    name: 'ТЕСТ',
    organizationId: null,
    timezone: 'Asia/Almaty',
    countryCode: 'KZ',
    city: 'Алматы',
    channexPropertyType: 'hostel',
  };
  const db = {
    property: {
      findFirst: vi.fn().mockResolvedValue(property),
      findUniqueOrThrow: vi.fn().mockResolvedValue(property),
    },
    accommodationType: { findMany: vi.fn().mockResolvedValue([]) },
    ratePlan: {
      findUnique: vi.fn().mockResolvedValue({ id: 'plan', code: 'TEST', active: false }),
    },
  };
  const repo = new PrismaChannelsRepository({ db } as unknown as PrismaService);
  expect((await repo.localSetup('TEST')).ratePlan).toBeNull();
});

it('тариф, отключённый во время настройки, не получает новое сопоставление', async () => {
  const tx = {
    ratePlan: { findFirst: vi.fn().mockResolvedValue(null) },
    channelMapping: { create: vi.fn().mockResolvedValue({}) },
    $executeRaw: vi.fn().mockResolvedValue(1),
  };
  const repo = new PrismaChannelsRepository({
    db: { ...tx, $transaction: (fn: (db: typeof tx) => Promise<unknown>) => fn(tx) },
  } as unknown as PrismaService);
  await expect(
    repo.saveRatePlanMapping({
      propertyId: 'property',
      provider: 'channex',
      localAccommodationTypeId: 'type',
      localRatePlanId: 'plan',
      providerPropertyId: 'external-property',
      providerRoomTypeId: 'room',
      providerRatePlanId: 'rate',
    }),
  ).rejects.toThrow('отключён');
  expect(tx.channelMapping.create).not.toHaveBeenCalled();
});
