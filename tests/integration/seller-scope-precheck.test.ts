import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, createPropertyInChain, type Db } from '@pms/database';
import { purgeAuditRows } from '../tools/audit-purge';
import { deleteOrganizationChain } from '../tools/property-owner';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * SA2.5, миграция 035 (expand): предпроверка однозначности перед переводом рантайма на agent_id (plans/…sa25 §10 п. 3).
 * Цепочка `seller_profile → Organization → legacy Seller Agent → Business → Location`: для каждого профиля ровно один
 * однозначный целевой агент и один филиал. Любая неоднозначность останавливает миграцию — Location по `created_at`, названию
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

  const profile = (organizationId: string, extra: Record<string, unknown> = {}) =>
    db.sellerProfile.create({
      data: { organizationId, addressForm: 'FORMAL', replyLength: 'SHORT', languages: ['ru'], updatedAt: new Date(), ...extra },
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
    const row = await db.sellerProfile.findUniqueOrThrow({ where: { organizationId: org.id }, select: { agentId: true } });
    expect(row.agentId).toBe(org.id);
  });

  it('принятый профиль, вставленный прежним кодом, сразу даёт активного агента с единственным филиалом и именем из профиля', async () => {
    const org = await newOrg('принятый профиль');
    await db.sellerProfile.create({
      data: {
        organizationId: org.id, botName: 'Айгерим', addressForm: 'FORMAL', replyLength: 'SHORT', languages: ['ru'],
        updatedAt: new Date(), profileAppliedAt: new Date(),
      },
    });
    const agent = await db.sellerAgent.findUniqueOrThrow({ where: { id: org.id }, select: { name: true, lifecycle: true, locationId: true } });
    expect(agent).toEqual({ name: 'Айгерим', lifecycle: 'active', locationId: org.locations[0] });
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

  it('профиль организации без участников: некому быть автором — агента нет, проверка красная', async () => {
    const org = await newOrg('без участников', { member: false });
    await profile(org.id);
    const found = await report(org.id);
    expect(found.orgs_without_actor).toBe(1);
    expect(found.profiles_without_agent).toBe(1);
    await expect(assertScope(org.id)).rejects.toThrow(/orgs_without_actor/);
  });

  it('профиль привязан к чужому по смыслу агенту (не legacy) — profiles_wrong_agent', async () => {
    const org = await newOrg('не тот агент');
    const other = await db.sellerAgent.create({
      data: { organizationId: org.id, createdBy: org.user!, name: 'Второй', locationId: org.locations[0]! },
    });
    await profile(org.id, { agentId: other.id });
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

  it('backfill профилей: agent_id заполнен у каждого профиля с агентом id = организация, повтор ничего не меняет', async () => {
    const org = await newOrg('backfill профиля');
    await db.sellerAgent.create({ data: { id: org.id, organizationId: org.id, createdBy: org.user!, name: 'Продавец', locationId: org.locations[0]! } });
    await db.$executeRawUnsafe('ALTER TABLE seller_profiles DISABLE TRIGGER seller_profiles_link');
    try {
      await profile(org.id);
    } finally {
      await db.$executeRawUnsafe('ALTER TABLE seller_profiles ENABLE TRIGGER seller_profiles_link');
    }
    expect((await db.sellerProfile.findUniqueOrThrow({ where: { organizationId: org.id }, select: { agentId: true } })).agentId).toBeNull();
    await db.$queryRawUnsafe('SELECT seller_agents_backfill()');
    expect((await db.sellerProfile.findUniqueOrThrow({ where: { organizationId: org.id }, select: { agentId: true } })).agentId).toBe(org.id);
    await db.$queryRawUnsafe('SELECT seller_agents_backfill()');
    expect((await report(org.id)).profiles_without_agent).toBe(0);
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
