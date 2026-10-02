import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { SellerAgentsService } from '../../apps/api/src/wizard/seller-agents.service';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * Агенты гостевого мастера и перенесённый продавец (DATA_MODEL §20.4, SA1.6). Рабочий продавец организации
 * становится агентом с `id = organization_id`; редактор мастера (`/seller-agents`) работает с черновиками мастера,
 * и рабочего продавца в нём быть не должно: правка через мастер переписала бы его тип и профиль мимо публикации.
 */
describe.skipIf(!url)('редактор мастера и перенесённый продавец (integration, DATABASE_URL required)', () => {
  let db: Db;
  let service: SellerAgentsService;
  const org = randomUUID();
  const user = randomUUID();
  let draftId = '';

  beforeAll(async () => {
    process.env.WIZARD_ENABLED = '1';
    db = createPrismaClient(url);
    service = new SellerAgentsService({ db } as PrismaService);
    await db.organization.create({ data: { id: org, name: `Мастер и перенос ${org}`, status: 'ACTIVE' } });
    await db.user.create({ data: { id: user, email: `${user}@example.invalid`, emailVerifiedAt: new Date() } });
    await db.membership.create({ data: { userId: user, organizationId: org, role: 'OWNER' } });
    await db.sellerAgent.create({ data: { id: org, organizationId: org, createdBy: user, name: 'Рабочий продавец' } });
    draftId = (await db.sellerAgent.create({ data: { organizationId: org, createdBy: user, name: 'Черновик мастера' }, select: { id: true } })).id;
  });

  afterAll(async () => {
    if (!db) return;
    await db.sellerAgent.deleteMany({ where: { organizationId: org } });
    await db.membership.deleteMany({ where: { organizationId: org } });
    await db.user.deleteMany({ where: { id: user } });
    await db.organization.deleteMany({ where: { id: org } });
    await db.$disconnect();
  });

  const asOwner = <T>(fn: () => Promise<T>) => withSignedInUser({ userId: user, organizationId: org, role: 'OWNER' }, fn);

  it('список редактора: только черновики мастера, рабочего продавца нет', async () => {
    const { items } = await asOwner(() => service.list());
    expect(items.map((a) => a.id)).toEqual([draftId]);
  });

  it('карточка и правка рабочего продавца через редактор мастера, «не найден»', async () => {
    await expect(asOwner(() => service.get(org))).rejects.toThrow(/не найден/i);
    await expect(
      asOwner(() =>
        service.update(org, {
          profile: { businessName: 'X', niche: 'Y' },
          updatedAt: new Date().toISOString(),
        }),
      ),
    ).rejects.toThrow(/не найден/i);
  });

  it('черновик мастера по-прежнему открывается', async () => {
    const card = await asOwner(() => service.get(draftId));
    expect(card.id).toBe(draftId);
  });
});
