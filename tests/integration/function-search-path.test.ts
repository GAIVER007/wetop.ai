import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * Советник Supabase (02.10.2026, «function_search_path_mutable»): функции схемы брали search_path того, кто их
 * вызвал. Тогда таблица или функция с тем же именем в чужой схеме, стоящей в пути раньше, подменяет нашу. Миграция
 * 20261003000043_function_search_path закрепляет путь у каждой функции; тест держит правило и для будущих функций.
 *
 * Функции расширений (btree_gist лежит в public) не наши: их путь задаёт расширение, их тест не берёт.
 */
describe.skipIf(!url)(
  'search_path у функций схемы закреплён (integration, DATABASE_URL required)',
  () => {
    let db: Db;
    beforeAll(() => {
      db = createPrismaClient(url);
    });
    afterAll(async () => {
      await db.$disconnect();
    });

    it('у каждой своей функции схемы search_path задан и начинается с её схемы', async () => {
      const rows = await db.$queryRaw<
        Array<{ fn: string; schema: string; config: string[] | null }>
      >`
      SELECT p.oid::regprocedure::text AS fn, n.nspname AS schema, p.proconfig AS config
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = current_schema()
        AND NOT EXISTS (
          SELECT 1 FROM pg_depend d
          WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e'
        )`;
      expect(rows.length, 'в схеме нет своих функций: миграции не применены').toBeGreaterThan(0);
      const unpinned = rows
        .filter((r) => {
          const path = (r.config ?? []).find((c) => c.startsWith('search_path='));
          if (!path) return true;
          const first = path.slice('search_path='.length).split(',')[0]!.trim().replace(/"/g, '');
          return first !== r.schema;
        })
        .map((r) => r.fn);
      expect(unpinned, 'функции без закреплённого search_path своей схемы').toEqual([]);
    });

    it('закреплённый путь не ломает функции: запись журнала идёт, правка записи запрещена', async () => {
      await expect(
        db.$transaction(async (tx) => {
          const org = await tx.organization.create({
            data: { name: 'Тест пути функций', status: 'ACTIVE' },
          });
          const entry = await tx.auditLog.create({
            data: {
              organizationId: org.id,
              entityType: 'test',
              entityId: 'search-path',
              action: 'test.search_path',
            },
          });
          await tx.$executeRaw`UPDATE audit_logs SET action = 'changed' WHERE id = ${entry.id}::uuid`;
        }),
      ).rejects.toThrow(/append-only/);
    });
  },
);
