import 'reflect-metadata';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../database/prisma.provider';
import { GuardController } from '../guard/guard.controller';
import { ChannelsController } from './channels.controller';
import { ChannelConnectionController } from './connection';
import { ChannelContentController } from './content';
import { IntegrationOwnerGuard, isIntegrationActor } from './integration-owner';

/**
 * План `plans/tenant-isolation-2026-09-26.md` п. 5, решение владельца 26.09.2026: интеграция Channex (сопоставления,
 * выгрузка, очередь, журнал событий) и сторож системы — общие на платформу. Их видит и меняет организация, к объекту
 * которой подключён Channex (Luxx), главный администратор и служебный ключ; вошедший из другой гостиницы — нет.
 */
function setup(integrationOrg: string | null) {
  const findFirst = vi.fn().mockResolvedValue({ organizationId: integrationOrg });
  const prisma = { db: { property: { findFirst } } } as unknown as PrismaService;
  return { guard: new IntegrationOwnerGuard(prisma), prisma, findFirst };
}
const ctx = (user?: { organizationId: string; platformAdmin?: boolean }) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as unknown as ExecutionContext;

describe('разделы интеграции и сторожа — только своей организации', () => {
  it('организация Luxx, главный администратор и служебный ключ проходят', async () => {
    const { guard } = setup('org-luxx');
    await expect(guard.canActivate(ctx({ organizationId: 'org-luxx' }))).resolves.toBe(true);
    await expect(guard.canActivate(ctx({ organizationId: 'org-b', platformAdmin: true }))).resolves.toBe(true);
    await expect(guard.canActivate(ctx(undefined))).resolves.toBe(true);
  });

  it('вошедший из другой гостиницы получает отказ словами', async () => {
    const { guard } = setup('org-luxx');
    await expect(guard.canActivate(ctx({ organizationId: 'org-b' }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(guard.canActivate(ctx({ organizationId: 'org-b' }))).rejects.toThrow(/поддержка WETOP/);
  });

  it('объект интеграции ничей — пускает только главного администратора', async () => {
    const { guard } = setup(null);
    await expect(guard.canActivate(ctx({ organizationId: 'org-luxx' }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('объект интеграции ищется как у служебных путей: самый старый с этим именем', async () => {
    const { prisma, findFirst } = setup('org-luxx');
    await isIntegrationActor(prisma, { organizationId: 'org-luxx' });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'asc' } }),
    );
  });

  it('гард стоит на всех контроллерах Channex и сторожа', () => {
    for (const controller of [
      ChannelsController,
      ChannelConnectionController,
      ChannelContentController,
      GuardController,
    ]) {
      const guards = Reflect.getMetadata(GUARDS_METADATA, controller) ?? [];
      expect(guards, controller.name).toContain(IntegrationOwnerGuard);
    }
  });
});
