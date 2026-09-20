/**
 * Перед изолированным прогоном e2e (ADR-042): схема pms_test существует, миграции догнаны, данные есть,
 * стенд стойки отдаёт страницы (а не пропавшие чанки пересобранной под ним сборки — `tools/desk-health.ts`).
 * Копия данных делается только при пустой схеме: освежать её посреди чужого прогона нельзя — npm run test:schema -- --refresh.
 */
import { assertDeskReady, probeDesk } from './tools/desk-health';
import { TEST_WEB_PORT } from './tools/test-schema-plan';
import { ensureTestSchema } from './tools/test-schema';

/** Страницы разных частей стойки: у каждой свои чанки, одной проверки готовности Playwright не хватило */
const PAGES = ['/today', '/chessboard', '/reservations', '/inventory', '/analytics'];

export default async function globalSetup(): Promise<void> {
  const report = await ensureTestSchema();
  console.log(
    `[pms_test] миграций применено ${report.migrated.length} из ${report.totalMigrations}; данные ${
      report.copied ? 'скопированы сейчас' : `от ${report.refreshedAt ?? '—'}`
    }`,
  );
  assertDeskReady(await probeDesk(`http://127.0.0.1:${TEST_WEB_PORT}`, PAGES), TEST_WEB_PORT);
}
