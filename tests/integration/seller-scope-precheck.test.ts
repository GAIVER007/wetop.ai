import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, createPropertyInChain, type Db } from '@pms/database';
import { purgeAuditRows } from '../tools/audit-purge';
import { insertLegacyProfile } from '../tools/seller-profile-sql';
import { deleteOrganizationChain } from '../tools/property-owner';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * SA2.5, миграция 035 (expand): предпроверка однозначности перед переводом рантайма на agent_id (plans/…sa25 §10 п. 3).
 * Цепочка `seller_profile → Organization → legacy Seller Agent → Business → Location`: для каждого профиля ровно один
 * однозначный целевой агент и один филиал. Любая неоднозначность останавливает миграцию — Location по `created_at`, названию

 * Схема здесь — ПОСЛЕ сужения (036): у профиля обязателен агент, поэтому «профиль без агента» и «профиль организации без участников»
 * невозможны как данные; их проверки остаются в функции (она идёт и по схеме шага «расширить») и доказаны в ветке до сужения.
 * или догадке не выбирается. Здесь проверяются функции `seller_scope_precheck(org)` и `seller_scope_assert(org)`, которые
 * миграция вызывает по всей базе; тесты сужают их одной организацией, чтобы соседние данные не мешали.
 */
describe.skipIf(!url)('SA2.5: предпроверка миграции 035 (integration, DATABASE_URL required)', () => {
  let db: Db;
  const base = { timezone: 'Asia/Almaty', currency: 'KZT', checkInTime: '14:00', checkOutTime: '12:00' };
  const orgs: string[] = [];
  const users: string[] = [];

  async function newOrg(label: string, opts: { member?: boolean; locations?: number } = {}) {
    const id = randomUUID();
    orgs.push(id);
    await db.organization.create({ data: { id, name: `Предпроверка ${label} ${id}` } });
    let user: string | null = null;
    if (opts.member !== false) {
      user = randomUUID();
      users.push(user);
      await db.user.create({ data: { id: user, email: `${user}@example.invalid` } });
      await db.membership.create({ data: { userId: user, organizationId: id, role: 'OWNER' } });
    }
    const locations: string[] = [];
    for (let i = 0; i < (opts.locations ?? 1); i += 1) {
      const property = await createPropertyInChain(db, id, { name: `Объект ${label} ${i} ${id}`, ...base });
      const row = await db.property.findUniqueOrThrow({ where: { id: property.id }, select: { locationId: true } });
      locations.push(row.locationId!);
    }
    return { id, user, locations };
  }

  // профиль «как вставлял прежний код»: триггер заводит агента (`id = organization_id`) с единственным возможным филиалом
  const profile = (organizationId: string) => insertLegacyProfile(db, organizationId);
  const profileOf = (agentId: string, organizationId: string) =>
    db.sellerProfile.create({
      data: { agentId, organizationId, addressForm: 'FORMAL', replyLength: 'SHORT', languages: ['ru'], updatedAt: new Date() },
    });

  type Row = { check_name: string; total: bigint | number; bad: bigint | number };
  async function report(org: string): Promise<Record<string, number>> {
    const rows = await db.$queryRawUnsafe<Row[]>('SELECT check_name, total, bad FROM seller_scope_precheck($1::uuid)', org);
    return Object.fromEntries(rows.map((r) => [r.check_name, Number(r.bad)]));
  }
  const assertScope = (org: string) => db.$queryRawUnsafe('SELECT seller_scope_assert($1::uuid)', org);
  const agentOf = (org: string) => db.sellerAgent.findUnique({ where: { id: org }, select: { locationId: true, lifecycle: true } });

  beforeAll(async () => {
    db = createPrismaClient(url);
  });

  // `seller_agents_backfill()` работает по всей базе: данные предыдущего сценария (профиль без агента и т.п.) ему мешать не должны
  afterEach(async () => {
    await db.sellerProfile.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.sellerAgent.deleteMany({ where: { organizationId: { in: orgs } } });
  });

  afterAll(async () => {
    if (!db) return;
    await db.sellerProfile.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.sellerAgent.deleteMany({ where: { organizationId: { in: orgs } } });
    await purgeAuditRows(db, { organizationId: { in: orgs } });
    await db.property.deleteMany({ where: { organizationId: { in: orgs } } });
    await deleteOrganizationChain(db, orgs);
    await db.membership.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.organization.deleteMany({ where: { id: { in: orgs } } });
    await db.$disconnect();
  });

  it('чистая организация (профиль, агент id = организация, один филиал): все проверки нулевые, assert молчит', async () => {
    const org = await newOrg('чистая');
    await profile(org.id);
    const found = await report(org.id);
    expect(found).toMatchObject({
      profiles_without_organization: 0,
      profiles_without_agent: 0,
      profiles_wrong_agent: 0,
      legacy_agents_without_location: 0,
      orgs_with_many_locations: 0,
      legacy_agents_wrong_location: 0,
      duplicate_sales_agents_per_location: 0,
      orgs_without_actor: 0,
    });
    await expect(assertScope(org.id)).resolves.toBeDefined();
    expect((await agentOf(org.id))?.locationId).toBe(org.locations[0]);
    const row = await db.sellerProfile.findUniqueOrThrow({ where: { agentId: org.id }, select: { organizationId: true } });
    expect(row.organizationId).toBe(org.id);
  });

  it('два филиала у организации с профилем: неоднозначно, агент без филиала, assert останавливает', async () => {
    const org = await newOrg('два филиала', { locations: 2 });
    await profile(org.id);
    // Филиал по `created_at` не выбирается: агент заведён без филиала
    expect((await agentOf(org.id))?.locationId).toBeNull();
    const found = await report(org.id);
    expect(found.orgs_with_many_locations).toBe(1);
    await expect(assertScope(org.id)).rejects.toThrow(/orgs_with_many_locations/);
  });

  it('организация с рабочим агентом, но без участников: некому быть автором — проверка красная; профиль без автора не вставляется', async () => {
    const org = await newOrg('без участников', { member: false });
    await expect(profile(org.id)).rejects.toThrow(); // агента триггер не заведёт, а agent_id теперь NOT NULL
    const author = await db.user.create({ data: { id: randomUUID(), email: `${randomUUID()}@example.invalid` } });
    users.push(author.id);
    await db.sellerAgent.create({ data: { id: org.id, organizationId: org.id, createdBy: author.id, name: 'Продавец', locationId: org.locations[0]! } });
    expect((await report(org.id)).orgs_without_actor).toBe(1);
    await expect(assertScope(org.id)).rejects.toThrow(/orgs_without_actor/);
  });

  it('профиль привязан к чужому по смыслу агенту (не legacy) — profiles_wrong_agent', async () => {
    const org = await newOrg('не тот агент');
    const other = await db.sellerAgent.create({
      data: { organizationId: org.id, createdBy: org.user!, name: 'Второй', locationId: org.locations[0]! },
    });
    await profileOf(other.id, org.id);
    const found = await report(org.id);
    expect(found.profiles_wrong_agent).toBe(1);
    await expect(assertScope(org.id)).rejects.toThrow(/profiles_wrong_agent/);
  });

  it('рабочий агент без филиала у организации без объектов — legacy_agents_without_location', async () => {
    const org = await newOrg('без объектов', { locations: 0 });
    await db.sellerAgent.create({ data: { id: org.id, organizationId: org.id, createdBy: org.user!, name: 'Продавец' } });
    const found = await report(org.id);
    expect(found.legacy_agents_without_location).toBe(1);
    await expect(assertScope(org.id)).rejects.toThrow(/legacy_agents_without_location/);
  });

  it('backfill: агент без филиала получает единственный возможный; при двух филиалах — не получает', async () => {
    const one = await newOrg('backfill один');
    await db.sellerAgent.create({ data: { id: one.id, organizationId: one.id, createdBy: one.user!, name: 'Продавец' } });
    const two = await newOrg('backfill два', { locations: 2 });
    await db.sellerAgent.create({ data: { id: two.id, organizationId: two.id, createdBy: two.user!, name: 'Продавец' } });

    await db.$queryRawUnsafe('SELECT seller_agents_backfill()');
    expect((await agentOf(one.id))?.locationId).toBe(one.locations[0]);
    expect((await agentOf(two.id))?.locationId).toBeNull();
  });

  it('seller_agent_bind_location: перенесённому агенту — единственный филиал; при двух, у агента SA2 и уже занятого — нет', async () => {
    const bind = async (agent: string) => (await db.$queryRawUnsafe<Array<{ r: string | null }>>('SELECT seller_agent_bind_location($1::uuid)::text AS r', agent))[0]!.r;
    const one = await newOrg('bind один');
    await db.sellerAgent.create({ data: { id: one.id, organizationId: one.id, createdBy: one.user!, name: 'Продавец' } });
    expect(await bind(one.id)).toBe(one.locations[0]);
    expect((await agentOf(one.id))?.locationId).toBe(one.locations[0]);
    expect(await bind(one.id)).toBe(one.locations[0]); // повтор — то же

    const two = await newOrg('bind два', { locations: 2 });
    await db.sellerAgent.create({ data: { id: two.id, organizationId: two.id, createdBy: two.user!, name: 'Продавец' } });
    expect(await bind(two.id)).toBeNull();
    expect((await agentOf(two.id))?.locationId).toBeNull();

    // агент SA2 (id ≠ организация): филиал выбирает человек, функция его не трогает
    const drafted = await db.sellerAgent.create({ data: { organizationId: one.id, createdBy: one.user!, name: 'Черновик', scenario: 'support' } });
    expect(await bind(drafted.id)).toBeNull();
    expect(await bind(randomUUID())).toBeNull();

    // филиал занят другим неархивным AI-продавцом
    const busy = await newOrg('bind занят');
    await db.sellerAgent.create({ data: { organizationId: busy.id, createdBy: busy.user!, name: 'Занял', locationId: busy.locations[0]! } });
    await db.sellerAgent.create({ data: { id: busy.id, organizationId: busy.id, createdBy: busy.user!, name: 'Продавец', lifecycle: 'archived' } });
    await db.sellerAgent.update({ where: { id: busy.id }, data: { lifecycle: 'draft' } }).catch(() => undefined);
    expect(await bind(busy.id)).toBeNull();
  });
});
