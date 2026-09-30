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
  PrismaSellerOrgsRepository,
  PrismaSellerProfilesRepository,
  workingSellerScope,
} from '../../apps/api/src/ai-seller/seller.repository';
import { PrismaAnalyticsRepository } from '../../apps/api/src/analytics/analytics.repository';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * SA2.5: область агента на настоящей базе. Факты, домены виджета и котировка берутся ТОЛЬКО из строки агента — его филиал,
 * объект филиала, сайты объекта; «самый ранний объект организации» больше не читается (plans/…sa25 §3, §10).
 *   организация с двумя филиалами: агент А1 (филиал 1), агент А2 (филиал 2) — каждый видит свой объект;
 *   чужая организация с тем же идентификатором агента в запросе — пусто; архивный агент областью не является.
 */
describe.skipIf(!url)('SA2.5: область агента в базе (integration, DATABASE_URL required)', () => {
  let db: Db;
  let facts: PrismaSellerFactsRepository;
  let orgsRepo: PrismaSellerOrgsRepository;
  let profiles: PrismaSellerProfilesRepository;
  let analytics: PrismaAnalyticsRepository;
  const base = { timezone: 'Asia/Almaty', currency: 'KZT', checkInTime: '14:00', checkOutTime: '12:00' };
  const now = new Date('2026-10-01T06:00:00Z');
  const orgA = randomUUID();
  const orgB = randomUUID();
  const users = [randomUUID(), randomUUID()];
  let propA1 = '';
  let propA2 = '';
  let locA1 = '';
  let locA2 = '';
  let locB1 = '';
  const agentA1 = randomUUID();
  const agentA2 = randomUUID();
  const agentBLegacy = orgB;

  beforeAll(async () => {
    db = createPrismaClient(url);
    const service = { db } as PrismaService;
    facts = new PrismaSellerFactsRepository(service);
    orgsRepo = new PrismaSellerOrgsRepository(service);
    profiles = new PrismaSellerProfilesRepository(service);
    analytics = new PrismaAnalyticsRepository(service);
    await db.organization.createMany({
      data: [
        { id: orgA, name: `Область А ${orgA}` },
        { id: orgB, name: `Область Б ${orgB}` },
      ],
    });
    await db.user.createMany({ data: users.map((id) => ({ id, email: `${id}@example.invalid` })) });
    const p1 = await createPropertyInChain(db, orgA, { name: `Объект А1 ${orgA}`, ...base });
    const p2 = await createPropertyInChain(db, orgA, { name: `Объект А2 ${orgA}`, ...base });
    const p3 = await createPropertyInChain(db, orgB, { name: `Объект Б1 ${orgB}`, ...base });
    propA1 = p1.id;
    propA2 = p2.id;
    const loc = async (id: string) => (await db.property.findUniqueOrThrow({ where: { id }, select: { locationId: true } })).locationId!;
    [locA1, locA2, locB1] = [await loc(p1.id), await loc(p2.id), await loc(p3.id)];
    await db.sellerAgent.create({ data: { id: agentA1, organizationId: orgA, createdBy: users[0]!, name: 'А1', locationId: locA1 } });
    await db.sellerAgent.create({ data: { id: agentA2, organizationId: orgA, createdBy: users[0]!, name: 'А2', locationId: locA2 } });
    await db.sellerAgent.create({ data: { id: agentBLegacy, organizationId: orgB, createdBy: users[1]!, name: 'Продавец Б', locationId: locB1 } });
    // сайты: у каждого объекта свой домен; у А1 включено бронирование
    await db.trackedSite.create({ data: { propertyId: propA1, name: 'Сайт А1', hosts: ['a1.example.invalid'], publicKey: `pms_${randomUUID().slice(0, 12)}` } });
    await db.trackedSite.create({ data: { propertyId: propA2, name: 'Сайт А2', hosts: ['a2.example.invalid'], publicKey: `pms_${randomUUID().slice(0, 12)}` } });
    await db.trackedSite.create({ data: { propertyId: p3.id, name: 'Сайт Б1', hosts: ['b1.example.invalid'], publicKey: `pms_${randomUUID().slice(0, 12)}` } });
  });

  afterAll(async () => {
    if (!db) return;
    await db.trackedSite.deleteMany({ where: { property: { organizationId: { in: [orgA, orgB] } } } });
    await db.sellerProfile.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await db.sellerAgent.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await purgeAuditRows(db, { organizationId: { in: [orgA, orgB] } });
    await db.property.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await deleteOrganizationChain(db, [orgA, orgB]);
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await db.$disconnect();
  });

  const nameOf = async (agentId: string, organizationId: string) =>
    (await facts.load({ agentId, organizationId }, now))?.property.name ?? null;

  it('две инструкции одной организации сохраняются независимо и переживают повторное чтение', async () => {
    const scope1 = {agentId: agentA1, organizationId: orgA};
    const scope2 = {agentId: agentA2, organizationId: orgA};
    await profiles.savePrompt(scope1, 'Инструкция первого тестового агента', users[0]!, now);
    await profiles.savePrompt(scope2, 'Инструкция второго тестового агента', users[0]!, now);
    expect((await profiles.get(agentA1))?.promptText).toBe('Инструкция первого тестового агента');
    expect((await profiles.get(agentA2))?.promptText).toBe('Инструкция второго тестового агента');
    await profiles.savePrompt(scope2, 'Обновление второго агента', users[0]!, new Date(now.getTime() + 1000));
    expect((await profiles.get(agentA1))?.promptText).toBe('Инструкция первого тестового агента');
    expect((await profiles.get(agentA2))?.promptText).toBe('Обновление второго агента');
  });

  it('факты: каждый агент видит объект своего филиала, а не самый ранний объект организации', async () => {
    expect(await nameOf(agentA1, orgA)).toContain('Объект А1');
    expect(await nameOf(agentA2, orgA)).toContain('Объект А2');
    expect(await nameOf(agentBLegacy, orgB)).toContain('Объект Б1');
  });

  it('факты: агент чужой организации, несуществующий и архивный не дают ничего; идентификатор организации не подменяет агента', async () => {
    expect(await nameOf(agentA1, orgB)).toBeNull(); // агент А1 не принадлежит организации Б
    expect(await nameOf(agentBLegacy, orgA)).toBeNull();
    expect(await nameOf(randomUUID(), orgA)).toBeNull();
    // организация без агента с id = организации: «самый ранний объект» не подставляется
    expect(await nameOf(orgA, orgA)).toBeNull();
  });

  it('факты: агент без филиала не даёт объекта; перенесённый с единственным возможным филиалом получает его от базы', async () => {
    const noLocation = await db.sellerAgent.create({ data: { organizationId: orgA, createdBy: users[0]!, name: 'Без филиала' } });
    expect(await nameOf(noLocation.id, orgA)).toBeNull();
    await db.sellerAgent.delete({ where: { id: noLocation.id } });

    const solo = randomUUID();
    await db.organization.create({ data: { id: solo, name: `Один филиал ${solo}` } });
    const p = await createPropertyInChain(db, solo, { name: `Объект Один ${solo}`, ...base });
    await db.membership.create({ data: { userId: users[0]!, organizationId: solo, role: 'OWNER' } });
    try {
      await db.sellerAgent.create({ data: { id: solo, organizationId: solo, createdBy: users[0]!, name: 'Перенесённый' } });
      expect(await nameOf(solo, solo)).toContain('Объект Один');
      expect((await db.sellerAgent.findUniqueOrThrow({ where: { id: solo } })).locationId).toBe(
        (await db.property.findUniqueOrThrow({ where: { id: p.id }, select: { locationId: true } })).locationId,
      );
    } finally {
      await db.sellerAgent.deleteMany({ where: { organizationId: solo } });
      await db.membership.deleteMany({ where: { organizationId: solo } });
      await db.property.deleteMany({ where: { organizationId: solo } });
      await deleteOrganizationChain(db, [solo]);
      await db.organization.deleteMany({ where: { id: solo } });
    }
  });

  it('домены виджета: сайты филиала агента; чужой филиал той же организации и чужая организация не попадают', async () => {
    expect(await orgsRepo.hostsForAgent({ agentId: agentA1, organizationId: orgA })).toEqual(['a1.example.invalid']);
    expect(await orgsRepo.hostsForAgent({ agentId: agentA2, organizationId: orgA })).toEqual(['a2.example.invalid']);
    expect(await orgsRepo.hostsForAgent({ agentId: agentA1, organizationId: orgB })).toEqual([]);
    // тот же результат отдаёт дверь бота (`/bot/agent-origins`): она считает по строке агента, без организации в запросе
    expect(await analytics.hostsForAgent(agentA1)).toEqual(['a1.example.invalid']);
    expect(await analytics.hostsForAgent(agentA2)).toEqual(['a2.example.invalid']);
    expect(await analytics.hostsForAgent(randomUUID())).toBeNull();
  });

  it('область агента для котировки: организация, филиал и объект — из строки; архивный — null; счёт агентов организации', async () => {
    expect(await analytics.agentScope(agentA1)).toMatchObject({ organizationId: orgA, locationId: locA1, propertyId: propA1 });
    expect(await analytics.agentScope(agentA2)).toMatchObject({ organizationId: orgA, locationId: locA2, propertyId: propA2 });
    expect(await analytics.salesAgentCount(orgA)).toBe(2);
    expect(await analytics.salesAgentCount(orgB)).toBe(1);
    await db.sellerAgent.update({ where: { id: agentA2 }, data: { lifecycle: 'archived' } });
    try {
      expect(await analytics.agentScope(agentA2)).toBeNull();
      expect(await analytics.hostsForAgent(agentA2)).toBeNull();
      expect(await analytics.salesAgentCount(orgA)).toBe(1);
    } finally {
      await db.sellerAgent.update({ where: { id: agentA2 }, data: { lifecycle: 'draft' } });
    }
  });

  it('профиль: ключ — агент; перенесённый продавец (agentId = организация) сохраняется и читается как прежде', async () => {
    const scope = workingSellerScope(orgB);
    expect(await profiles.get(scope.agentId)).toBeNull();
    await profiles.save(scope, { ...DEFAULT_SELLER_PROFILE, botName: 'Айгерим' }, null, now);
    const row = await profiles.get(scope.agentId);
    expect(row).toMatchObject({ organizationId: orgB, botName: 'Айгерим' });
    // строка привязана к агенту, а журнал пишет идентификатор агента (у перенесённого он равен прежнему идентификатору)
    expect((await db.sellerProfile.findUniqueOrThrow({ where: { agentId: orgB } })).organizationId).toBe(orgB);
    const audit = await db.auditLog.findFirstOrThrow({ where: { entityType: 'SellerProfile', entityId: orgB, action: 'seller.profile.updated' } });
    expect(audit.entityId).toBe(orgB);
    // профиль организации А не появился
    expect(await profiles.get(orgA)).toBeNull();
  });
});
