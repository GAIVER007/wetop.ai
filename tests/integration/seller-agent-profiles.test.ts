import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, createPropertyInChain, type Db } from '@pms/database';
import { DEFAULT_SELLER_PROFILE } from '@pms/domain';
import { purgeAuditRows } from '../tools/audit-purge';
import { deleteOrganizationChain } from '../tools/property-owner';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import {
  PrismaSellerFactsRepository,
  PrismaSellerProfilesRepository,
  SellerAgentMissingError,
  workingSellerScope,
} from '../../apps/api/src/ai-seller/seller.repository';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * SA2.5, сужение (миграция 039): профиль принадлежит АГЕНТУ, первичный ключ `agent_id`. У организации по профилю на каждого агента;
 * настройки, инструкция, метки доставки и журнал одного агента не задевают другого; ключ базы не даёт второй профиль агенту;
 * перенесённый продавец (`agentId = organizationId`) сохраняется так же, а организация без участников профиль не получает.
 */
describe.skipIf(!url)('SA2.5: профиль по агенту после сужения (integration, DATABASE_URL required)', () => {
  let db: Db;
  let profiles: PrismaSellerProfilesRepository;
  let facts: PrismaSellerFactsRepository;
  const base = { timezone: 'Asia/Almaty', currency: 'KZT', checkInTime: '14:00', checkOutTime: '12:00' };
  const now = new Date('2026-10-01T06:00:00Z');
  const org = randomUUID();
  const lonely = randomUUID();
  const user = randomUUID();
  const second = randomUUID();
  let locA = '';
  let locB = '';

  beforeAll(async () => {
    db = createPrismaClient(url);
    const service = { db } as PrismaService;
    profiles = new PrismaSellerProfilesRepository(service);
    facts = new PrismaSellerFactsRepository(service);
    await db.organization.createMany({
      data: [
        { id: org, name: `Два профиля ${org}` },
        { id: lonely, name: `Без участников ${lonely}` },
      ],
    });
    await db.user.create({ data: { id: user, email: `${user}@example.invalid` } });
    await db.membership.create({ data: { userId: user, organizationId: org, role: 'OWNER' } });
    const p1 = await createPropertyInChain(db, org, { name: `Объект 1 ${org}`, ...base });
    const p2 = await createPropertyInChain(db, org, { name: `Объект 2 ${org}`, ...base });
    const loc = async (id: string) => (await db.property.findUniqueOrThrow({ where: { id }, select: { locationId: true } })).locationId!;
    [locA, locB] = [await loc(p1.id), await loc(p2.id)];
    // рабочий агент (id = организация) без филиала, филиалов два, выбор не угадывается; второй агент, на втором филиале
    await db.sellerAgent.create({ data: { id: org, organizationId: org, createdBy: user, name: 'Перенесённый', locationId: locA } });
    await db.sellerAgent.create({ data: { id: second, organizationId: org, createdBy: user, name: 'Второй', locationId: locB } });
  });

  afterAll(async () => {
    if (!db) return;
    await db.sellerProfile.deleteMany({ where: { organizationId: { in: [org, lonely] } } });
    await db.sellerAgent.deleteMany({ where: { organizationId: { in: [org, lonely] } } });
    await purgeAuditRows(db, { organizationId: { in: [org, lonely] } });
    await db.property.deleteMany({ where: { organizationId: { in: [org, lonely] } } });
    await deleteOrganizationChain(db, [org]);
    await db.membership.deleteMany({ where: { organizationId: org } });
    await db.user.deleteMany({ where: { id: user } });
    await db.organization.deleteMany({ where: { id: { in: [org, lonely] } } });
    await db.$disconnect();
  });

  const scopeOf = (agentId: string) => ({ agentId, organizationId: org });

  it('у организации два профиля, по агенту; настройки и инструкция одного не задевают другого', async () => {
    await profiles.save(workingSellerScope(org), { ...DEFAULT_SELLER_PROFILE, botName: 'Первая' }, user, now);
    await profiles.save(scopeOf(second), { ...DEFAULT_SELLER_PROFILE, botName: 'Вторая' }, user, now);
    expect((await profiles.get(org))?.botName).toBe('Первая');
    expect((await profiles.get(second))?.botName).toBe('Вторая');

    await profiles.savePrompt(scopeOf(second), 'Инструкция второго агента', user, now);
    expect((await profiles.get(second))?.promptText).toBe('Инструкция второго агента');
    expect((await profiles.get(org))?.promptText).toBeNull();
    expect(await db.sellerProfile.count({ where: { organizationId: org } })).toBe(2);
  });

  it('метки доставки и ошибка, на профиле агента: доставка первому не гасит отказ второго', async () => {
    await profiles.markError(second, 'Продавец отказал', now);
    await profiles.markProfileApplied(org, now);
    await profiles.markFactsApplied(org, 'a'.repeat(64), now);
    expect((await profiles.get(second))?.lastError).toBe('Продавец отказал');
    expect((await profiles.get(org))?.lastError).toBeNull();
    expect((await profiles.get(org))?.factsHash).toBe('a'.repeat(64));
    expect((await profiles.get(second))?.factsHash).toBeNull();
    await profiles.clearError(second);
    expect((await profiles.get(second))?.lastError).toBeNull();
  });

  it('журнал пишет идентификатор агента; ключ базы не пускает второй профиль агента', async () => {
    const events = await db.auditLog.findMany({ where: { entityType: 'SellerProfile', action: 'seller.profile.updated', entityId: { in: [org, second] } } });
    expect(new Set(events.map((e) => e.entityId))).toEqual(new Set([org, second]));
    await expect(
      db.sellerProfile.create({
        data: { agentId: second, organizationId: org, addressForm: 'FORMAL', replyLength: 'SHORT', languages: ['ru'], updatedAt: now },
      }),
    ).rejects.toThrow();
  });

  it('факты каждого агента, объект его филиала', async () => {
    expect((await facts.load(scopeOf(org), now))?.property.name).toContain('Объект 1');
    expect((await facts.load(scopeOf(second), now))?.property.name).toContain('Объект 2');
  });

  it('база не пускает профиль агента чужой организации', async () => {
    await expect(
      db.sellerProfile.create({
        data: { agentId: second, organizationId: lonely, addressForm: 'FORMAL', replyLength: 'SHORT', languages: ['ru'], updatedAt: now },
      }),
    ).rejects.toThrow();
  });

  it('организация без участников: агента база не заводит, профиль не сохраняется с понятной причиной', async () => {
    await expect(profiles.save(workingSellerScope(lonely), DEFAULT_SELLER_PROFILE, null, now)).rejects.toBeInstanceOf(
      SellerAgentMissingError,
    );
    expect(await db.sellerProfile.count({ where: { organizationId: lonely } })).toBe(0);
  });

  it('прежний код (вставка без agent_id) на схеме после сужения: триггер заводит агента, профиль сохраняется', async () => {
    const fresh = randomUUID();
    const author = randomUUID();
    await db.organization.create({ data: { id: fresh, name: `Прежний код ${fresh}` } });
    await db.user.create({ data: { id: author, email: `${author}@example.invalid` } });
    await db.membership.create({ data: { userId: author, organizationId: fresh, role: 'OWNER' } });
    try {
      await db.$executeRaw`INSERT INTO seller_profiles (organization_id, address_form, reply_length, languages, updated_at)
        VALUES (${fresh}::uuid, 'FORMAL'::"SellerAddressForm", 'SHORT'::"SellerReplyLength", ARRAY['ru']::text[], now())`;
      expect((await db.sellerProfile.findUniqueOrThrow({ where: { agentId: fresh } })).organizationId).toBe(fresh);
    } finally {
      await db.sellerProfile.deleteMany({ where: { organizationId: fresh } });
      await db.sellerAgent.deleteMany({ where: { organizationId: fresh } });
      await db.membership.deleteMany({ where: { organizationId: fresh } });
      await db.user.deleteMany({ where: { id: author } });
      await db.organization.deleteMany({ where: { id: fresh } });
    }
  });
});
