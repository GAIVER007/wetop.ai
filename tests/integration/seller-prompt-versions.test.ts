import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, createPropertyInChain, type Db } from '@pms/database';
import { PrismaSellerProfilesRepository, workingSellerScope } from '../../apps/api/src/ai-seller/seller.repository';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { deleteOrganizationChain } from '../tools/property-owner';
import { purgeAuditRows } from '../tools/audit-purge';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * Версии инструкции продавца (DATA_MODEL §33, миграция 20261010000078) на настоящей схеме: версия пишется только при
 * изменившемся тексте, первая правка (когда профиля ещё нет) тоже создаёт версию, чужой агент версий не видит.
 */
describe.skipIf(!url)('версии инструкции продавца (integration)', () => {
  let db: Db;
  let repo: PrismaSellerProfilesRepository;
  const orgA = randomUUID();
  const orgB = randomUUID();
  const author = randomUUID();
  const mark = Date.now().toString(36);
  const at = (n: number) => new Date(Date.UTC(2026, 9, 10, 9, n));

  beforeAll(async () => {
    db = createPrismaClient(url);
    repo = new PrismaSellerProfilesRepository({ db } as PrismaService);
    await db.organization.createMany({
      data: [
        { id: orgA, name: `Версии А ${mark}` },
        { id: orgB, name: `Версии Б ${mark}` },
      ],
    });
    await db.user.create({ data: { id: author, email: `${author}@example.invalid`, name: 'Алия Тестова' } });
    await db.membership.createMany({
      data: [orgA, orgB].map((organizationId) => ({ userId: author, organizationId, role: 'OWNER' as const })),
    });
    for (const [id, tag] of [[orgA, 'a'], [orgB, 'b']] as const)
      await createPropertyInChain(db, id, {
        name: `Версии ${tag} ${mark}`,
        address: 'Алматы',
        timezone: 'Asia/Almaty',
        currency: 'KZT',
        checkInTime: '14:00',
        checkOutTime: '12:00',
      });
  });

  afterAll(async () => {
    await purgeAuditRows(db, { entityType: 'SellerProfile', entityId: { in: [orgA, orgB] } });
    await db.sellerPromptVersion.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await db.sellerProfile.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await db.sellerAgent.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await db.property.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await deleteOrganizationChain(db, [orgA, orgB]);
    await db.membership.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await db.user.deleteMany({ where: { id: author } });
    await db.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await db.$disconnect();
  });

  it('первая правка без профиля создаёт версию; повтор того же текста не множит; новый текст добавляет', async () => {
    const scope = workingSellerScope(orgA);
    await repo.savePrompt(scope, 'Отвечай кратко.', author, at(1));
    await repo.savePrompt(scope, 'Отвечай кратко.', author, at(2));
    await repo.savePrompt(scope, 'Отвечай подробно.', author, at(3));
    const list = await repo.promptVersions(scope.agentId, 20);
    expect(list.map((v) => v.preview)).toEqual(['Отвечай подробно.', 'Отвечай кратко.']);
    expect(list[0]).toMatchObject({ length: 17, author: 'Алия Тестова' });
  });

  it('текст версии отдаётся только своему агенту; предел списка работает', async () => {
    const a = workingSellerScope(orgA);
    const b = workingSellerScope(orgB);
    const [latest] = await repo.promptVersions(a.agentId, 1);
    expect(latest?.preview).toBe('Отвечай подробно.');
    expect(await repo.promptVersionText(a.agentId, latest!.id)).toBe('Отвечай подробно.');
    expect(await repo.promptVersionText(b.agentId, latest!.id)).toBeNull();
    await repo.savePrompt(b, 'Чужая инструкция', author, at(4));
    expect((await repo.promptVersions(b.agentId, 20)).map((v) => v.preview)).toEqual(['Чужая инструкция']);
    expect((await repo.promptVersions(a.agentId, 20)).length).toBe(2);
  });

  it('база отвергает пустой текст версии и версию к несуществующему агенту', async () => {
    const a = workingSellerScope(orgA);
    await expect(
      db.sellerPromptVersion.create({ data: { agentId: a.agentId, organizationId: orgA, text: '   ' } }),
    ).rejects.toThrow();
    await expect(
      db.sellerPromptVersion.create({ data: { agentId: randomUUID(), organizationId: orgA, text: 'x' } }),
    ).rejects.toThrow();
  });
});
