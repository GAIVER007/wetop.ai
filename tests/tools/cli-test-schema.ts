/**
 * Схема автотестов pms_test (ADR-040): создать, накатить миграции, скопировать данные рабочей базы.
 *   npm run test:schema                 — создать/догнать миграции; данные копируются, только если схема пуста
 *   npm run test:schema -- --refresh    — заново скопировать все таблицы из public (тесты в это время не запускать)
 * Прогоны integration и e2e вызывают то же самое сами; руками — чтобы освежить копию.
 */
import { ensureTestSchema } from './test-schema';

const refresh = process.argv.includes('--refresh');
const report = await ensureTestSchema({ refresh, log: (line) => console.log(line) });
console.log(
  `схема ${report.created ? 'создана' : 'уже была'}; миграций применено сейчас ${report.migrated.length}, всего ${report.totalMigrations}`,
);
if (report.copied) {
  const off = report.copied.filter((r) => r.rows !== r.live);
  console.log('таблица · скопировано · в рабочей сейчас');
  for (const r of report.copied) if (r.rows || r.live) console.log(`  ${r.table.padEnd(30)} ${String(r.rows).padStart(6)} ${String(r.live).padStart(6)}`);
  console.log(
    off.length
      ? `расходится сразу после копии: ${off.map((r) => r.table).join(', ')} — рабочая база меняется (синхронизация, другие прогоны)`
      : 'копия совпадает с рабочими таблицами строка в строку',
  );
} else console.log('данные не копировались (схема не пуста; освежить — --refresh)');
console.log(`копия данных от: ${report.refreshedAt ?? '—'}`);
