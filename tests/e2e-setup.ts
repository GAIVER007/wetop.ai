/**
 * Перед изолированным прогоном e2e (ADR-040): схема pms_test существует, миграции догнаны, данные есть.
 * Копия данных делается только при пустой схеме: освежать её посреди чужого прогона нельзя — npm run test:schema -- --refresh.
 */
import { ensureTestSchema } from './tools/test-schema';

export default async function globalSetup(): Promise<void> {
  const report = await ensureTestSchema();
  console.log(
    `[pms_test] миграций применено ${report.migrated.length} из ${report.totalMigrations}; данные ${
      report.copied ? 'скопированы сейчас' : `от ${report.refreshedAt ?? '—'}`
    }`,
  );
}
