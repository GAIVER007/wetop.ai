import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { currentIntegrationPropertyId, databaseTenant, withSignedInUser } from '../auth/request-context';
import { forgetPropertyRef } from '../database/property-ref';
import type { PrismaService } from '../database/prisma.provider';
import { runIntegrationCommand, FOREIGN_CHANNEX_PROPERTY } from './integration-command';

const ORG = '11111111-1111-4111-8111-111111111111';
const A = '33333333-3333-4333-8333-333333333333';
const B = '44444444-4444-4444-8444-444444444444';
const rows = [
  { propertyId: A, providerPropertyId: 'chx-a' },
  { propertyId: B, providerPropertyId: 'chx-b' },
];

function setup(mappingRows = rows) {
  const db = {
    property: {
      findFirst: vi.fn(async ({ where }: { where: { locationId?: string } }) => ({
        id: where.locationId === 'location-b' ? B : A,
        name: 'Same hotel', organizationId: ORG, timezone: 'Asia/Almaty',
      })),
    },
    channelMapping: { findMany: vi.fn(async () => mappingRows) },
  };
  return { prisma: { db } as unknown as PrismaService, db };
}

const asBranch = <T>(locationId: string, fn: () => Promise<T>) =>
  withSignedInUser({ userId: 'user', organizationId: ORG, scope: 'LOCATION', locationId }, fn);

beforeEach(() => forgetPropertyRef());

describe('Channex command property isolation', () => {
  it('uses the selected branch and service DB only after branch validation', async () => {
    const { prisma } = setup();
    const run = vi.fn(async (providerId: string | undefined) => ({
      providerId, localId: currentIntegrationPropertyId(), tenant: databaseTenant(),
    }));
    expect(await asBranch('location-a', () => runIntegrationCommand(prisma, undefined, run)))
      .toEqual({ providerId: 'chx-a', localId: A, tenant: null });
    expect(await asBranch('location-b', () => runIntegrationCommand(prisma, undefined, run)))
      .toEqual({ providerId: 'chx-b', localId: B, tenant: null });
  });

  it('rejects a foreign provider ID and never executes the command', async () => {
    const { prisma } = setup();
    const run = vi.fn(async () => 'wrong');
    await expect(asBranch('location-a', () => runIntegrationCommand(prisma, 'chx-b', run)))
      .rejects.toThrow(new BadRequestException(FOREIGN_CHANNEX_PROPERTY));
    expect(run).not.toHaveBeenCalled();
  });

  it('refuses an unmapped branch and ambiguous unscoped service command', async () => {
    const { prisma } = setup([rows[0]!]);
    await expect(asBranch('location-b', () => runIntegrationCommand(prisma, undefined, async () => 'wrong')))
      .rejects.toBeInstanceOf(BadRequestException);
    const two = setup();
    await expect(runIntegrationCommand(two.prisma, undefined, async () => 'wrong'))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps the same property through nested commands', async () => {
    const { prisma } = setup();
    const result = await asBranch('location-b', () => runIntegrationCommand(prisma, undefined, () =>
      runIntegrationCommand(prisma, 'chx-b', async (id) => ({ id, property: currentIntegrationPropertyId() })),
    ));
    expect(result).toEqual({ id: 'chx-b', property: B });
  });
});
