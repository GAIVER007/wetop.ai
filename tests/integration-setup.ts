/**
 * Перед интеграционными тестами: схема pms_test существует, миграции догнаны, данные есть (ADR-040).
 * Сами тесты получают DATABASE_SCHEMA=pms_test из vitest.config.ts и пишут только туда.
 * Без DATABASE_URL тесты пропускаются (describe.skipIf), схема тогда не нужна.
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { ensureTestSchema } from './tools/test-schema';

export default async function setup(): Promise<void> {
  loadEnv({ path: resolve(import.meta.dirname, '../.env'), quiet: true });
  if (!process.env.DATABASE_URL) return;
  const report = await ensureTestSchema();
  if (report.migrated.length || report.copied)
    console.log(
      `[pms_test] миграций применено ${report.migrated.length}; данные ${report.copied ? 'скопированы' : 'на месте'}`,
    );
}
