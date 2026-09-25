import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

const MIGRATION = resolve(
  import.meta.dirname,
  '../../packages/database/prisma/migrations/20260925000020_access_extensions/migration.sql',
);

/** Заполнение ролей ровно тем SQL, что в миграции: проверяется запрос, который применит владелец, а не его пересказ */
const backfill = (): string => {
  const sql = readFileSync(MIGRATION, 'utf8');
  const match = /UPDATE "memberships"[\s\S]*?;/.exec(sql);
  if (!match) throw new Error('в миграции нет заполнения ролей');
  return match[0];
};

/** Откат транзакции после проверок: заполнение ролей идёт по всем организациям схемы, чужие строки не меняются */
class Rollback extends Error {}

/**
 * Доступ к платформе и расширения (DATA_MODEL §16 v1.9, миграция 20260925000020, ADR-083). Проверяется сама база:
 * владельцем существующей организации становится самый ранний участник и ровно один; у пробного расширения срок
 * обязателен; отметка главного администратора — только у существующего человека. Всё вымышленное (ADR-010),
 * убирается за собой.
 */
describe.skipIf(!url)('роли, главный администратор и расширения (integration, DATABASE_URL required)', () => {
  let db: Db;
  const mark = Date.now().toString(36);
  const orgA = randomUUID();
  const orgB = randomUUID();
  // двое, пришедшие в одну секунду: какой id меньше, решает сравнение строк — так же сравнивает uuid и PostgreSQL
  const [twinLow, twinHigh] = [randomUUID(), randomUUID()].sort() as [string, string];
  const users = { first: randomUUID(), second: randomUUID(), third: randomUUID(), twinLow, twinHigh };

  beforeAll(async () => {
    db = createPrismaClient(url);
    await db.organization.createMany({
      data: [
        { id: orgA, name: `Тест ролей ${mark}` },
        { id: orgB, name: `Тест ролей, двое в одну секунду ${mark}` },
      ],
    });
    await db.user.createMany({
      // почта строчными — CHECK `users_email_lowercase` (DATA_MODEL §13)
      data: Object.entries(users).map(([key, id]) => ({
        id,
        email: `roles-${key.toLowerCase()}-${mark}@example.invalid`,
      })),
    });
    const at = (minute: number) => new Date(Date.UTC(2026, 8, 20, 9, minute));
    await db.$executeRawUnsafe(
      `INSERT INTO "memberships" ("user_id", "organization_id", "created_at") VALUES
        ($1::uuid, $4::uuid, $6), ($2::uuid, $4::uuid, $7), ($3::uuid, $4::uuid, $8),
        ($5::uuid, $9::uuid, $6), ($10::uuid, $9::uuid, $6)`,
      users.first,
      users.second,
      users.third,
      orgA,
      users.twinHigh,
      at(0),
      at(5),
      at(9),
      orgB,
      users.twinLow,
    );
  });

  afterAll(async () => {
    if (!db) return;
    const ids = Object.values(users);
    // уборка не падает, даже если таблиц ещё нет (прогон до миграции): иначе вымышленные люди остались бы в схеме
    const quietly = (sql: string, arg: unknown) => db.$executeRawUnsafe(sql, arg).catch(() => 0);
    await quietly(`DELETE FROM "organization_extensions" WHERE "organization_id" = ANY($1::uuid[])`, [orgA, orgB]);
    await quietly(`DELETE FROM "platform_admins" WHERE "user_id" = ANY($1::uuid[])`, ids);
    await quietly(`DELETE FROM "memberships" WHERE "user_id" = ANY($1::uuid[])`, ids);
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await db.$disconnect();
  });

  it('новое членство — сотрудник; миграция делает владельцем самого раннего участника, и ровно одного', async () => {
    const before = await db.$queryRawUnsafe<Array<{ role: string }>>(
      `SELECT "role"::text AS role FROM "memberships" WHERE "organization_id" = $1::uuid`,
      orgA,
    );
    expect(before.map((r) => r.role)).toEqual(['STAFF', 'STAFF', 'STAFF']);

    let after: Array<{ organization_id: string; user_id: string; role: string }> = [];
    await db
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe(backfill());
        after = await tx.$queryRawUnsafe(
          `SELECT "organization_id"::text, "user_id"::text, "role"::text AS role FROM "memberships"
           WHERE "organization_id" = ANY($1::uuid[]) ORDER BY "organization_id", "user_id"`,
          [orgA, orgB],
        );
        throw new Rollback();
      })
      .catch((e: unknown) => {
        if (!(e instanceof Rollback)) throw e;
      });

    const role = (org: string, user: string) =>
      after.find((r) => r.organization_id === org && r.user_id === user)?.role;
    expect(role(orgA, users.first)).toBe('OWNER');
    expect(role(orgA, users.second)).toBe('STAFF');
    expect(role(orgA, users.third)).toBe('STAFF');
    // пришли в одну секунду — владелец тот, у кого меньше user_id: не двое и не ни одного
    expect(role(orgB, users.twinLow)).toBe('OWNER');
    expect(role(orgB, users.twinHigh)).toBe('STAFF');
    expect(after.filter((r) => r.role === 'OWNER')).toHaveLength(2);
  });

  it('пробное расширение — только со сроком; оплаченное может быть бессрочным', async () => {
    const insert = (org: string, status: string, until: Date | null) =>
      db.$executeRawUnsafe(
        `INSERT INTO "organization_extensions" ("organization_id", "extension", "status", "active_until", "updated_at")
         VALUES ($1::uuid, 'AI_SELLER', $2::"ExtensionStatus", $3, now())`,
        org,
        status,
        until,
      );
    await expect(insert(orgA, 'TRIAL', null)).rejects.toThrow(/organization_extensions_trial_until_check/);
    await expect(insert(orgA, 'ACTIVE', null)).resolves.toBe(1);
    // одна строка на организацию и расширение
    await expect(insert(orgA, 'OFF', null)).rejects.toThrow(/organization_extensions_pkey|Unique constraint/);
    await expect(insert(orgB, 'TRIAL', new Date('2026-10-02T00:00:00.000Z'))).resolves.toBe(1);
  });

  it('главный администратор — только существующий человек, одна строка на человека', async () => {
    const grant = (user: string) =>
      db.$executeRawUnsafe(`INSERT INTO "platform_admins" ("user_id") VALUES ($1::uuid)`, user);
    await expect(grant(randomUUID())).rejects.toThrow(/platform_admins_user_id_fkey|Foreign key/);
    await expect(grant(users.first)).resolves.toBe(1);
    await expect(grant(users.first)).rejects.toThrow(/platform_admins_pkey|Unique constraint/);
    const [row] = await db.$queryRawUnsafe<Array<{ revoked: boolean }>>(
      `SELECT "revoked_at" IS NOT NULL AS revoked FROM "platform_admins" WHERE "user_id" = $1::uuid`,
      users.first,
    );
    expect(row?.revoked).toBe(false);
  });
});
