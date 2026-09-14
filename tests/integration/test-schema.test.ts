import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { describe, expect, it } from 'vitest';
import { createPrismaClient } from '@pms/database';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * ADR-040: интеграционные тесты работают в схеме pms_test. Опция схемы Prisma касается только запросов, которые строит
 * сама Prisma; прямой SQL (запись неисправности, длительность сессии сайта) шёл в public — 14.09.2026 тестовая
 * неисправность так попала в рабочую таблицу и разбудила сторожа. Прямой SQL обязан видеть ту же схему.
 */
describe.skipIf(!url)('схема автотестов pms_test (integration, DATABASE_URL required)', () => {
  it('прямой SQL в тестах работает в pms_test, а не в рабочих данных', async () => {
    expect(process.env.DATABASE_SCHEMA).toBe('pms_test');
    const db = createPrismaClient(url);
    try {
      const rows = await db.$queryRaw<Array<{ schema: string }>>`SELECT current_schema() AS schema`;
      expect(rows[0]!.schema).toBe('pms_test');
    } finally {
      await db.$disconnect();
    }
  });
});
