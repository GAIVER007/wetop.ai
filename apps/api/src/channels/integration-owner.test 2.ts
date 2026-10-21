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
function setup(integrationOrg: string | null, mappingOrg: string | null = null) {
  const findFirst = vi.fn().mockResolvedValue({ organizationId: integrationOrg });
  // SEC-2: объект интеграции — по сопоставлениям Channex раньше названия (как у `ChannelOperatorInterceptor`)
  const mappingFirst = vi
    .fn()
    .mockResolvedValue(mappingOrg ? { property: { id: 'p-map', organizationId: mappingOrg } } : null);
  const prisma = {
    db: { property: { findFirst, findUnique: vi.fn() }, channelMapping: { findFirst: mappingFirst } },
  } as unknown as PrismaService;
  return { guard: new IntegrationOwnerGuard(prisma), prisma, findFirst, mappingFirst };
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

  it('SEC-2: есть сопоставления Channex — оператор по ним, а не по названию; одноимённая организация не проходит', async () => {
    const { guard, findFirst } = setup('org-namesake', 'org-luxx');
    await expect(guard.canActivate(ctx({ organizationId: 'org-luxx' }))).resolves.toBe(true);
    await expect(guard.canActivate(ctx({ organizationId: 'org-namesake' }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('SEC-2: задан INTEGRATION_PROPERTY_ID — оператор по нему; ни сопоставления, ни название не спрашиваются', async () => {
    const id = '67646baa-d066-4977-8afc-67f48398842f';
    vi.stubEnv('INTEGRATION_PROPERTY_ID', id);
    try {
      const { guard, prisma, findFirst, mappingFirst } = setup('org-namesake', 'org-mapped');
      (prisma.db.property.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id,
        organizationId: 'org-luxx',
      });
      await expect(guard.canActivate(ctx({ organizationId: 'org-luxx' }))).resolves.toBe(true);
      await expect(guard.canActivate(ctx({ organizationId: 'org-namesake' }))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(guard.canActivate(ctx({ organizationId: 'org-mapped' }))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(findFirst).not.toHaveBeenCalled();
      expect(mappingFirst).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
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
