import 'reflect-metadata';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../database/prisma.provider';
import { GuardController } from '../guard/guard.controller';
import { ChannelsController } from './channels.controller';
import { ChannelConnectionController } from './connection';
import { ChannelContentController } from './content';
import {
  ChannelOrganizationGuard,
  IntegrationOwnerGuard,
  isIntegrationActor,
} from './integration-owner';

const ORG_A = 'org-a';
const ORG_B = 'org-b';
function setup() {
  const propertyFirst = vi.fn(async ({ where }: { where: { organizationId: string } }) =>
    [ORG_A, ORG_B].includes(where.organizationId) ? { id: where.organizationId } : null,
  );
  const mappingFirst = vi.fn(
    async ({ where }: { where: { property: { organizationId: string } } }) =>
      where.property.organizationId === ORG_A ? { id: 'mapping-a' } : null,
  );
  const prisma = {
    db: {
      property: { findFirst: propertyFirst, findUnique: async () => ({ organizationId: ORG_A }) },
      channelMapping: {
        findFirst: mappingFirst,
        findMany: async () => [{ propertyId: 'property-a', providerPropertyId: 'provider-a' }],
      },
    },
  } as unknown as PrismaService;
  return { guard: new ChannelOrganizationGuard(prisma), prisma, propertyFirst, mappingFirst };
}
const ctx = (user?: { organizationId: string; platformAdmin?: boolean }) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as unknown as ExecutionContext;

describe('Channex access for organizations', () => {
  it('does not expose global system incidents to another organization', async () => {
    const { prisma } = setup();
    const guard = new IntegrationOwnerGuard(prisma);
    await expect(guard.canActivate(ctx({ organizationId: ORG_B }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('lets each organization open setup, including one without mappings', async () => {
    const { guard } = setup();
    await expect(guard.canActivate(ctx({ organizationId: ORG_A }))).resolves.toBe(true);
    await expect(guard.canActivate(ctx({ organizationId: ORG_B }))).resolves.toBe(true);
  });

  it('refuses an actor with no property', async () => {
    const { guard } = setup();
    await expect(guard.canActivate(ctx({ organizationId: 'unknown' }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('reports connection only for the organization with a mapped property', async () => {
    const { prisma, mappingFirst } = setup();
    expect(await isIntegrationActor(prisma, { organizationId: ORG_A })).toBe(true);
    expect(await isIntegrationActor(prisma, { organizationId: ORG_B })).toBe(false);
    expect(mappingFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { provider: 'channex', property: { organizationId: ORG_B } },
      }),
    );
  });

  it('keeps integration guards on all controller routes', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, GuardController)).toContain(IntegrationOwnerGuard);
    for (const controller of [
      ChannelsController,
      ChannelConnectionController,
      ChannelContentController,
    ]) {
      expect(Reflect.getMetadata(GUARDS_METADATA, controller) ?? [], controller.name).toContain(
        ChannelOrganizationGuard,
      );
    }
  });
});
