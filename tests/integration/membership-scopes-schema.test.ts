import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * STAFF2.3b (ADR-155, DATA_MODEL §30): область доступа держится ограничениями и триггером самой базы, а не аккуратностью
 * вызывающего. Красный до миграции 20261009000070_membership_scopes, зелёный после. Все люди и организации вымышленные
 * (ADR-010), за собой тест убирает.
 */
describe.skipIf(!url)('membership_scopes (integration, DATABASE_URL required)', () => {
  let db: Db;
  let migrated = false;
  const ids = {
    orgA: randomUUID(),
    orgB: randomUUID(),
    user: randomUUID(),
    bizA: randomUUID(),
    bizB: randomUUID(),
    locA1: randomUUID(),
    locA2: randomUUID(),
    locB1: randomUUID(),
  };

  beforeAll(async () => {
    db = createPrismaClient(url);
    const rows = await db.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'membership_scopes'`;
    migrated = rows.length > 0;
    if (!migrated) return;
    const mail = `scope-${ids.user.slice(0, 8)}@example.test`;
    await db.$executeRaw`INSERT INTO organizations (id, name, status, created_at) VALUES
      (${ids.orgA}::uuid, 'Тест-область А', 'ACTIVE', now()), (${ids.orgB}::uuid, 'Тест-область Б', 'ACTIVE', now())`;
    await db.$executeRaw`INSERT INTO users (id, email, status, created_at) VALUES (${ids.user}::uuid, ${mail}, 'ACTIVE', now())`;
    await db.$executeRaw`INSERT INTO memberships (user_id, organization_id, role, created_at)
      VALUES (${ids.user}::uuid, ${ids.orgA}::uuid, 'STAFF', now())`;
    await db.$executeRaw`INSERT INTO businesses (id, organization_id, name, vertical, status, updated_at) VALUES
      (${ids.bizA}::uuid, ${ids.orgA}::uuid, 'Бизнес А', 'HOSPITALITY', 'ACTIVE', now()),
      (${ids.bizB}::uuid, ${ids.orgB}::uuid, 'Бизнес Б', 'HOSPITALITY', 'ACTIVE', now())`;
    await db.$executeRaw`INSERT INTO locations (id, business_id, name, timezone, currency, status, updated_at) VALUES
      (${ids.locA1}::uuid, ${ids.bizA}::uuid, 'Филиал А1', 'Asia/Almaty', 'KZT', 'ACTIVE', now()),
      (${ids.locA2}::uuid, ${ids.bizA}::uuid, 'Филиал А2', 'Asia/Almaty', 'KZT', 'ACTIVE', now()),
      (${ids.locB1}::uuid, ${ids.bizB}::uuid, 'Филиал Б1', 'Asia/Almaty', 'KZT', 'ACTIVE', now())`;
  });

  afterAll(async () => {
    if (migrated) {
      await db.$executeRaw`DELETE FROM membership_scopes WHERE user_id = ${ids.user}::uuid`;
      await db.$executeRaw`DELETE FROM memberships WHERE user_id = ${ids.user}::uuid`;
      await db.$executeRaw`DELETE FROM locations WHERE id IN (${ids.locA1}::uuid, ${ids.locA2}::uuid, ${ids.locB1}::uuid)`;
      await db.$executeRaw`DELETE FROM businesses WHERE id IN (${ids.bizA}::uuid, ${ids.bizB}::uuid)`;
      await db.$executeRaw`DELETE FROM users WHERE id = ${ids.user}::uuid`;
      await db.$executeRaw`DELETE FROM organizations WHERE id IN (${ids.orgA}::uuid, ${ids.orgB}::uuid)`;
    }
    await db.$disconnect();
  });

  const add = (role: string, org: string, biz: string, loc: string | null) =>
    db.$executeRaw`INSERT INTO membership_scopes (id, organization_id, user_id, role, business_id, location_id)
      VALUES (${randomUUID()}::uuid, ${org}::uuid, ${ids.user}::uuid, ${role}::"MembershipRole", ${biz}::uuid, ${loc}::uuid)`;

  it('назначение на свой филиал сохраняется, повтор нельзя', async (ctx) => {
    if (!migrated) return ctx.skip();
    await add('STAFF', ids.orgA, ids.bizA, ids.locA1);
    await expect(add('STAFF', ids.orgA, ids.bizA, ids.locA1)).rejects.toThrow();
  });

  it('бизнес целиком тоже один раз (частичный индекс при NULL филиале)', async (ctx) => {
    if (!migrated) return ctx.skip();
    await add('MANAGER', ids.orgA, ids.bizA, null);
    await expect(add('STAFF', ids.orgA, ids.bizA, null)).rejects.toThrow();
  });

  it('владельцу область не назначают', async (ctx) => {
    if (!migrated) return ctx.skip();
    await expect(add('OWNER', ids.orgA, ids.bizA, ids.locA2)).rejects.toThrow();
  });

  it('чужой бизнес в этой организации отклоняется триггером', async (ctx) => {
    if (!migrated) return ctx.skip();
    await expect(add('STAFF', ids.orgA, ids.bizB, null)).rejects.toThrow(
      /не принадлежит организации/,
    );
  });

  it('филиал не своего бизнеса отклоняется триггером', async (ctx) => {
    if (!migrated) return ctx.skip();
    await expect(add('STAFF', ids.orgA, ids.bizA, ids.locB1)).rejects.toThrow(
      /не принадлежит бизнесу/,
    );
  });

  it('человека, которого нет в организации, назначить нельзя', async (ctx) => {
    if (!migrated) return ctx.skip();
    await expect(add('STAFF', ids.orgB, ids.bizB, ids.locB1)).rejects.toThrow(/нет в организации/);
  });

  it('приостановка: время и автор идут вместе, у активного пусты', async (ctx) => {
    if (!migrated) return ctx.skip();
    await expect(
      db.$executeRaw`UPDATE memberships SET status = 'SUSPENDED' WHERE user_id = ${ids.user}::uuid`,
    ).rejects.toThrow();
    await expect(
      db.$executeRaw`UPDATE memberships SET suspended_at = now() WHERE user_id = ${ids.user}::uuid`,
    ).rejects.toThrow();
    await db.$executeRaw`UPDATE memberships SET status = 'SUSPENDED', suspended_at = now()
      WHERE user_id = ${ids.user}::uuid`;
    await db.$executeRaw`UPDATE memberships SET status = 'ACTIVE', suspended_at = NULL, suspended_by = NULL
      WHERE user_id = ${ids.user}::uuid`;
  });

  it('приглашение: телефон в +E.164 и назначения только списком', async (ctx) => {
    if (!migrated) return ctx.skip();
    const base = (phone: string | null, scopes: string | null) =>
      db.$executeRaw`INSERT INTO invites (id, organization_id, email, role, token_hash, expires_at, created_by, phone, scopes)
        VALUES (${randomUUID()}::uuid, ${ids.orgA}::uuid, ${`i-${randomUUID().slice(0, 8)}@example.test`}, 'STAFF',
          ${randomUUID().replaceAll('-', '').padEnd(64, '0')}, now() + interval '7 days', ${ids.user}::uuid,
          ${phone}, ${scopes}::jsonb)`;
    await expect(base('8 701 000 00 00', null)).rejects.toThrow();
    await expect(base(null, '{"role":"STAFF"}')).rejects.toThrow();
    await base('+77010000000', '[{"role":"STAFF","businessId":"x","locationId":null}]');
    await db.$executeRaw`DELETE FROM invites WHERE organization_id = ${ids.orgA}::uuid`;
  });
});
