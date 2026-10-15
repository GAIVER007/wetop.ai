import { randomUUID } from 'node:crypto';
import { insertLegacyProfile } from '../tools/seller-profile-sql';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, createPropertyInChain, type Db } from '@pms/database';
import { deleteOrganizationChain } from '../tools/property-owner';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * Business Agent: личность и перенос существующего продавца (DATA_MODEL §20, v2.8, SA1.6; миграция
 * 20260930000034). Проверяется сама база: агент привязан к филиалу и живёт в цепочке одной организации;
 * не более одного неархивного AI-продавца на филиал; хранимых состояний четыре; перенос создаёт агента с
 * `id = organization_id` (ключ виджета и адрес вебхука не меняются) и повторный запуск ничего не дублирует.
 * Всё вымышленное (ADR-010), тест убирает за собой.
 */
describe.skipIf(!url)('Business Agent: личность и перенос (integration, DATABASE_URL required)', () => {
  let db: Db;
  const mark = Date.now().toString(36);
  const orgIds: string[] = [];
  const userIds: string[] = [];

  async function organization(name: string, withProperty = true) {
    const org = await db.organization.create({ data: { name: `${name} ${mark}` }, select: { id: true } });
    orgIds.push(org.id);
    const user = await db.user.create({
      data: { email: `agent-${randomUUID()}@example.invalid`, name: `Тест ${name}` },
      select: { id: true },
    });
    userIds.push(user.id);
    await db.membership.create({ data: { userId: user.id, organizationId: org.id, role: 'OWNER' } });
    let locationId: string | null = null;
    if (withProperty) {
      const property = await createPropertyInChain(db, org.id, {
        name: `Хостел ${name} ${mark}`,
        address: 'Алматы, ул. Вымышленная, 1',
        timezone: 'Asia/Almaty',
        currency: 'KZT',
        checkInTime: '14:00',
        checkOutTime: '12:00',
      });
      locationId = (await db.property.findUniqueOrThrow({ where: { id: property.id }, select: { locationId: true } }))
        .locationId;
    }
    return { orgId: org.id, userId: user.id, locationId };
  }

  async function profile(organizationId: string, applied: boolean, botName: string | null = null) {
    await insertLegacyProfile(db, organizationId, { applied, botName });
  }

  const backfill = () => db.$executeRawUnsafe('SELECT seller_agents_backfill()');


  const agent = (id: string) =>
    db.$queryRawUnsafe<
      { id: string; name: string; scenario: string; lifecycle: string; location_id: string | null; created_by: string }[]
    >(`SELECT id::text, name, scenario, lifecycle, location_id::text, created_by::text FROM seller_agents WHERE id = $1::uuid`, id);

  const insertAgent = (organizationId: string, createdBy: string, opts: { location?: string | null; lifecycle?: string; scenario?: string } = {}) =>
    db.$executeRawUnsafe(
      `INSERT INTO seller_agents (id, organization_id, created_by, name, scenario, lifecycle, location_id, profile, created_at, updated_at)
       VALUES ($1::uuid, $2::uuid, $3::uuid, 'Тестовый агент', $4, $5, $6::uuid, '{}'::jsonb, now(), now())`,
      randomUUID(),
      organizationId,
      createdBy,
      opts.scenario ?? 'sales',
      opts.lifecycle ?? 'draft',
      opts.location ?? null,
    );

  beforeAll(() => {
    db = createPrismaClient(url);
  });

  afterAll(async () => {
    if (!db) return;
    await db.$executeRawUnsafe(`DELETE FROM seller_profiles WHERE organization_id = ANY($1::uuid[])`, orgIds);
    await db.$executeRawUnsafe(`DELETE FROM seller_agents WHERE organization_id = ANY($1::uuid[])`, orgIds);
    await db.organizationExtension.deleteMany({ where: { organizationId: { in: orgIds } } });
    await db.membership.deleteMany({ where: { organizationId: { in: orgIds } } });
    await db.property.deleteMany({ where: { organizationId: { in: orgIds } } });
    await deleteOrganizationChain(db, orgIds);
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.organization.deleteMany({ where: { id: { in: orgIds } } });
    await db.$disconnect();
  });

  describe('перенос существующего продавца (seller_agents_backfill)', () => {
    it('рабочий продавец с принятым профилем становится активным агентом с id = organization_id, филиалом объекта и владельцем как автором', async () => {
      const a = await organization('Перенос активный');
      // на схеме после сужения (039) профиль без агента невозможен: агента заводит триггер при вставке профиля
      await profile(a.orgId, true, 'Алия');
      await backfill();

      const row = (await agent(a.orgId))[0]!;
      expect(row).toBeDefined();
      expect(row.name).toBe('Алия');
      expect(row.scenario).toBe('sales');
      expect(row.lifecycle).toBe('active');
      expect(row.location_id).toBe(a.locationId);
      expect(row.created_by).toBe(a.userId);
      const link = (await db.$queryRawUnsafe<{ agent_id: string }[]>(
        `SELECT agent_id::text FROM seller_profiles WHERE organization_id = $1::uuid`,
        a.orgId,
      ))[0]!;
      expect(link.agent_id).toBe(a.orgId);
    });

    it('профиль без принятия продавцом остаётся черновиком, имя по умолчанию, «AI-продавец»', async () => {
      const a = await organization('Перенос черновик');
      await profile(a.orgId, false);
      await backfill();

      const row = (await agent(a.orgId))[0]!;
      expect(row.lifecycle).toBe('draft');
      expect(row.name).toBe('AI-продавец');
      expect(row.location_id).toBe(a.locationId);
    });

    it('профиль, вставленный прежним кодом уже после миграции, сам получает агента с id = organization_id', async () => {
      const a = await organization('Профиль после миграции');

      await profile(a.orgId, false, 'Мадина');

      const row = (await agent(a.orgId))[0]!;
      expect(row.name).toBe('Мадина');
      expect(row.lifecycle).toBe('draft');
      expect(row.location_id).toBe(a.locationId);
      const link = (await db.$queryRawUnsafe<{ agent_id: string }[]>(
        `SELECT agent_id::text FROM seller_profiles WHERE organization_id = $1::uuid`,
        a.orgId,
      ))[0]!;
      expect(link.agent_id).toBe(a.orgId);
    });

    it('организация без участников: агента база не заводит, а профиль без агента после сужения (039) не вставляется', async () => {
      const org = await db.organization.create({ data: { name: `Без участников ${mark}` }, select: { id: true } });
      orgIds.push(org.id);

      await expect(profile(org.id, false)).rejects.toThrow();

      expect(await agent(org.id)).toHaveLength(0);
      expect(await db.sellerProfile.count({ where: { organizationId: org.id } })).toBe(0);
    });

    it('организация с расширением, но без объекта и профиля, черновик без филиала', async () => {
      const a = await organization('Перенос без объекта', false);
      await db.organizationExtension.create({
        data: { organizationId: a.orgId, extension: 'AI_SELLER', status: 'ACTIVE', updatedAt: new Date() },
      });

      await backfill();

      const row = (await agent(a.orgId))[0]!;
      expect(row.lifecycle).toBe('draft');
      expect(row.location_id).toBeNull();
    });

    it('организация без продавца и без расширения агента не получает', async () => {
      const a = await organization('Перенос пустой');

      await backfill();

      expect(await agent(a.orgId)).toHaveLength(0);
    });

    it('повторный запуск ничего не дублирует и не меняет уже перенесённого агента', async () => {
      const a = await organization('Перенос повтор');
      await profile(a.orgId, true);
      await backfill();
      await db.$executeRawUnsafe(`UPDATE seller_agents SET name = 'Переименован' WHERE id = $1::uuid`, a.orgId);

      await backfill();
      await backfill();

      const rows = await db.$queryRawUnsafe<{ n: bigint }[]>(
        `SELECT count(*) AS n FROM seller_agents WHERE organization_id = $1::uuid`,
        a.orgId,
      );
      expect(Number(rows[0]!.n)).toBe(1);
      expect((await agent(a.orgId))[0]!.name).toBe('Переименован');
    });
  });

  describe('ограничения агента', () => {
    it('четыре хранимых состояния: `preparing` и `error` больше не допускаются', async () => {
      const a = await organization('Состояния', false);
      await expect(insertAgent(a.orgId, a.userId, { lifecycle: 'preparing' })).rejects.toThrow();
      await expect(insertAgent(a.orgId, a.userId, { lifecycle: 'error' })).rejects.toThrow();
      await insertAgent(a.orgId, a.userId, { lifecycle: 'draft' });
      await insertAgent(a.orgId, a.userId, { lifecycle: 'archived' });
    });

    it('активный и приостановленный агент без филиала невозможны, черновик без филиала можно', async () => {
      const a = await organization('Без филиала', false);
      await expect(insertAgent(a.orgId, a.userId, { lifecycle: 'active' })).rejects.toThrow();
      await expect(insertAgent(a.orgId, a.userId, { lifecycle: 'paused' })).rejects.toThrow();
      await insertAgent(a.orgId, a.userId, { lifecycle: 'draft', location: null });
    });

    it('на филиале не более одного неархивного AI-продавца; архивный не мешает', async () => {
      const a = await organization('Один на филиал');
      await insertAgent(a.orgId, a.userId, { location: a.locationId, lifecycle: 'active' });
      await expect(insertAgent(a.orgId, a.userId, { location: a.locationId, lifecycle: 'draft' })).rejects.toThrow(
        /seller_agents_one_seller_per_location|unique|duplicate/i,
      );
      await insertAgent(a.orgId, a.userId, { location: a.locationId, lifecycle: 'archived' });
      await insertAgent(a.orgId, a.userId, { location: a.locationId, lifecycle: 'archived' });
    });

    it('агент другого типа на занятом филиале допустим: ограничение относится только к AI-продавцу', async () => {
      const a = await organization('Другой тип');
      await insertAgent(a.orgId, a.userId, { location: a.locationId, lifecycle: 'active' });
      // тип `support` уже разрешён CHECK-ом scenario; будущие типы добавляются в него своим ADR
      await insertAgent(a.orgId, a.userId, { location: a.locationId, lifecycle: 'draft', scenario: 'support' });
    });

    it('филиал чужой организации: отказ при вставке и при смене филиала', async () => {
      const mine = await organization('Своя цепочка');
      const foreign = await organization('Чужая цепочка');
      await expect(insertAgent(mine.orgId, mine.userId, { location: foreign.locationId, lifecycle: 'draft' })).rejects.toThrow(
        /принадлеж|organization|филиал/i,
      );
      await insertAgent(mine.orgId, mine.userId, { location: mine.locationId, lifecycle: 'draft' });
      await expect(
        db.$executeRawUnsafe(
          `UPDATE seller_agents SET location_id = $1::uuid WHERE organization_id = $2::uuid`,
          foreign.locationId,
          mine.orgId,
        ),
      ).rejects.toThrow(/принадлеж|organization|филиал/i);
    });

    it('профиль связан с агентом своей организации: чужой агент, отказ', async () => {
      const a = await organization('Профиль своей', false);
      const b = await organization('Профиль чужой', false);
      const foreignAgent = randomUUID();
      await db.$executeRawUnsafe(
        `INSERT INTO seller_agents (id, organization_id, created_by, name, scenario, lifecycle, profile, created_at, updated_at)
         VALUES ($1::uuid, $2::uuid, $3::uuid, 'Чужой', 'sales', 'draft', '{}'::jsonb, now(), now())`,
        foreignAgent,
        b.orgId,
        b.userId,
      );
      await profile(a.orgId, false);
      await expect(
        db.$executeRawUnsafe(
          `UPDATE seller_profiles SET agent_id = $1::uuid WHERE organization_id = $2::uuid`,
          foreignAgent,
          a.orgId,
        ),
      ).rejects.toThrow(/принадлеж|organization|агент/i);
    });
  });
});
