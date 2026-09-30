import 'reflect-metadata';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { databaseTenant, withSignedInUser } from '../auth/request-context';
import type { PrismaService } from '../database/prisma.provider';
import { runIntegrationCommand, FOREIGN_CHANNEX_PROPERTY } from './integration-command';
import { CHANNEL_OPERATOR_FOREIGN_MESSAGE } from './operator-access';

/**
 * Q-225 (а*): служебная роль получает не запрос человека, а интеграционную команду. Проверки — организация и объект
 * интеграции — идут на роли организации до перехода, идентификатор объекта Channex сверяется с сопоставлениями объекта,
 * который выбрал сервер (`INTEGRATION_PROPERTY_ID`), а не с тем, что прислал клиент.
 */
const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const PROPERTY = '33333333-3333-4333-8333-333333333333';
const ENV_KEY = 'INTEGRATION_PROPERTY_ID';

function prismaOf(organizationId: string | null, providerIds: string[] = ['chx-1']) {
  const tenantsSeen: Array<string | null> = [];
  const db = {
    property: {
      findUnique: vi.fn(async () => {
        tenantsSeen.push(databaseTenant());
        return organizationId === null ? null : { id: PROPERTY, organizationId };
      }),
    },
    channelMapping: {
      findMany: vi.fn(async () => {
        tenantsSeen.push(databaseTenant());
        return providerIds.map((providerPropertyId) => ({ providerPropertyId }));
      }),
    },
  };
  return { prisma: { db } as unknown as PrismaService, db, tenantsSeen };
}

async function withServerProperty<T>(fn: () => Promise<T>): Promise<T> {
  const before = process.env[ENV_KEY];
  process.env[ENV_KEY] = PROPERTY;
  try {
    return await fn();
  } finally {
    if (before === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = before;
  }
}

const asOrg = <T>(organizationId: string, fn: () => Promise<T>) =>
  withSignedInUser({ userId: 'user-1', organizationId }, fn);

describe('интеграционная команда (Q-225 а*)', () => {
  it('запрос организации-оператора: сама операция идёт служебной ролью, проверки — до перехода', async () => {
    const { prisma, tenantsSeen } = prismaOf(ORG_A);
    const inside: Array<string | null> = [];
    const answer = await withServerProperty(() =>
      asOrg(ORG_A, () =>
        runIntegrationCommand(prisma, undefined, async () => {
          inside.push(databaseTenant());
          return 'ok';
        }),
      ),
    );
    expect(answer).toBe('ok');
    expect(inside).toEqual([null]);
    // объект интеграции и сопоставления читаются служебной ролью: под ролью организации чужие объекты не видны (RLS)
    expect(tenantsSeen.every((t) => t === null)).toBe(true);
  });

  it('организация не оператор интеграции: отказ, операция не выполняется', async () => {
    const { prisma } = prismaOf(ORG_B);
    const run = vi.fn(async () => 'нельзя');
    await expect(
      withServerProperty(() => asOrg(ORG_A, () => runIntegrationCommand(prisma, undefined, run))),
    ).rejects.toThrow(new ForbiddenException(CHANNEL_OPERATOR_FOREIGN_MESSAGE));
    expect(run).not.toHaveBeenCalled();
  });

  it('объекта интеграции нет: отказ', async () => {
    const { prisma } = prismaOf(null);
    const run = vi.fn(async () => 'нельзя');
    await expect(
      withServerProperty(() => asOrg(ORG_A, () => runIntegrationCommand(prisma, undefined, run))),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(run).not.toHaveBeenCalled();
  });

  it('идентификатор объекта Channex от клиента: чужой отклоняется, свой проходит', async () => {
    const { prisma } = prismaOf(ORG_A, ['chx-1', 'chx-2']);
    const run = vi.fn(async (id: string | undefined) => id);
    await expect(
      withServerProperty(() => asOrg(ORG_A, () => runIntegrationCommand(prisma, 'chx-чужой', run))),
    ).rejects.toThrow(new BadRequestException(FOREIGN_CHANNEX_PROPERTY));
    expect(run).not.toHaveBeenCalled();
    const ok = await withServerProperty(() =>
      asOrg(ORG_A, () => runIntegrationCommand(prisma, 'chx-2', run)),
    );
    expect(ok).toBe('chx-2');
  });

  it('фоновый путь без организации (опрос, вебхук, сторож): ничего не проверяется и не читается, идентификатор как есть', async () => {
    const { prisma, db } = prismaOf(ORG_B);
    const run = vi.fn(async (id: string | undefined) => id);
    const answer = await runIntegrationCommand(prisma, 'что-угодно-из-вебхука', run);
    expect(answer).toBe('что-угодно-из-вебхука');
    expect(db.property.findUnique).not.toHaveBeenCalled();
    expect(db.channelMapping.findMany).not.toHaveBeenCalled();
  });

  it('вложенный вызов внутри команды повторно не проверяется', async () => {
    const { prisma, db } = prismaOf(ORG_A);
    await withServerProperty(() =>
      asOrg(ORG_A, () =>
        runIntegrationCommand(prisma, undefined, () =>
          runIntegrationCommand(prisma, undefined, async () => 'вложенный'),
        ),
      ),
    );
    expect(db.property.findUnique).toHaveBeenCalledTimes(1);
  });
});
