/**
 * Сбрасывает прикладные данные WETOP до пустого onboarding-состояния.
 *
 * По умолчанию выполняет только dry-run. Apply требует одновременно `--apply` и точное значение
 * RESET_CONFIRM. Скрипт не создаёт backup: перед apply оператор обязан выполнить и проверить процедуру
 * из docs/ops/backups.md и сохранить путь к дампу в журнале релиза.
 */
import { createPrismaClient, Prisma } from '@pms/database';

export const RESET_CONFIRMATION = 'WETOP_EMPTY_ONBOARDING_2026_09_28';
export const retainedIdentityTables = new Set([
  '_prisma_migrations',
  'organizations',
  'users',
  'memberships',
  'sessions',
  'platform_admins',
]);

export function assertResetConfirmation(value: string | undefined): void {
  if (value !== RESET_CONFIRMATION)
    throw new Error(
      `Для apply задайте RESET_CONFIRM=${RESET_CONFIRMATION}. Без точного значения данные не меняются.`,
    );
}

type Identity = { user_id: string; organization_id: string };
type TableRow = { tablename: string };
type CountRow = { count: bigint };

const safeIdentifier = (value: string): string => {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new Error(`Небезопасное имя таблицы: ${value}`);
  return `"${value}"`;
};

async function identityCandidates(db: ReturnType<typeof createPrismaClient>): Promise<Identity[]> {
  return db.$queryRaw<Identity[]>(Prisma.sql`
    SELECT DISTINCT pa."user_id", m."organization_id"
    FROM "platform_admins" pa
    JOIN "users" u ON u."id" = pa."user_id"
    JOIN "memberships" m ON m."user_id" = u."id" AND m."role" = 'OWNER'
    JOIN "sessions" s
      ON s."user_id" = u."id"
     AND s."organization_id" = m."organization_id"
     AND s."revoked_at" IS NULL
     AND s."expires_at" > now()
    WHERE pa."revoked_at" IS NULL
  `);
}

async function applicationTables(db: ReturnType<typeof createPrismaClient>): Promise<string[]> {
  const rows = await db.$queryRaw<TableRow[]>(Prisma.sql`
    SELECT "tablename"
    FROM "pg_tables"
    WHERE "schemaname" = current_schema()
    ORDER BY "tablename"
  `);
  return rows.map((r) => r.tablename).filter((name) => !retainedIdentityTables.has(name));
}

async function tableCount(
  db: ReturnType<typeof createPrismaClient>,
  table: string,
): Promise<number> {
  const [row] = await db.$queryRawUnsafe<CountRow[]>(`SELECT count(*) AS "count" FROM ${safeIdentifier(table)}`);
  return Number(row?.count ?? 0n);
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error('DATABASE_URL не задан');
  const apply = process.argv.includes('--apply');
  if (apply) assertResetConfirmation(process.env.RESET_CONFIRM);

  const db = createPrismaClient(url, process.env.DATABASE_SCHEMA ?? '');
  try {
    const identities = await identityCandidates(db);
    if (identities.length !== 1)
      throw new Error(
        `Сброс остановлен: ожидалась одна активная пара platform-admin + OWNER + session, найдено ${identities.length}`,
      );
    const keep = identities[0]!;
    const tables = await applicationTables(db);
    const populated: Array<{ table: string; rows: number }> = [];
    for (const table of tables) {
      const rows = await tableCount(db, table);
      if (rows > 0) populated.push({ table, rows });
    }

    console.log(
      JSON.stringify({
        mode: apply ? 'apply' : 'dry-run',
        retainedIdentity: { users: 1, organizations: 1 },
        tablesToClear: tables.length,
        populatedTables: populated,
      }),
    );
    if (!apply) return;

    await db.$transaction(
      async (tx) => {
        if (tables.length) {
          const names = tables.map(safeIdentifier).join(', ');
          await tx.$executeRawUnsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
        }
        await tx.$executeRaw(Prisma.sql`
          DELETE FROM "sessions"
          WHERE NOT (
            "user_id" = ${keep.user_id}::uuid
            AND "organization_id" = ${keep.organization_id}::uuid
            AND "revoked_at" IS NULL
            AND "expires_at" > now()
          )
        `);
        await tx.$executeRaw(Prisma.sql`
          DELETE FROM "platform_admins" WHERE "user_id" <> ${keep.user_id}::uuid
        `);
        await tx.$executeRaw(Prisma.sql`
          DELETE FROM "memberships"
          WHERE "user_id" <> ${keep.user_id}::uuid OR "organization_id" <> ${keep.organization_id}::uuid
        `);
        await tx.$executeRaw(Prisma.sql`
          DELETE FROM "users" WHERE "id" <> ${keep.user_id}::uuid
        `);
        await tx.$executeRaw(Prisma.sql`
          DELETE FROM "organizations" WHERE "id" <> ${keep.organization_id}::uuid
        `);
      },
      { maxWait: 30_000, timeout: 180_000 },
    );

    const [users, organizations, memberships, admins, sessions] = await Promise.all([
      tableCount(db, 'users'),
      tableCount(db, 'organizations'),
      tableCount(db, 'memberships'),
      tableCount(db, 'platform_admins'),
      tableCount(db, 'sessions'),
    ]);
    const nonEmpty: Array<{ table: string; rows: number }> = [];
    for (const table of tables) {
      const rows = await tableCount(db, table);
      if (rows > 0) nonEmpty.push({ table, rows });
    }
    if (users !== 1 || organizations !== 1 || memberships !== 1 || admins !== 1 || sessions < 1)
      throw new Error(
        `Проверка identity не прошла: users=${users}, organizations=${organizations}, memberships=${memberships}, admins=${admins}, activeSessions=${sessions}`,
      );
    if (nonEmpty.length) throw new Error(`После сброса остались прикладные строки: ${JSON.stringify(nonEmpty)}`);
    console.log(
      JSON.stringify({
        result: 'reset-complete',
        users,
        organizations,
        memberships,
        platformAdmins: admins,
        activeSessions: sessions,
        applicationRows: 0,
      }),
    );
  } finally {
    await db.$disconnect();
  }
}

if (import.meta.filename === process.argv[1])
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
