/**
 * Импорт справочника услуг Exely (9 позиций из аудита spravochniki.md §8) в БД.
 * Запуск: npx tsx scripts/imports/src/cli-import-services.ts [путь к spravochniki.md]
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createPrismaClient } from '@pms/database';
import { LUXX_APARTS_PROPERTY, importServices, parseExelyServices } from './exely/index';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });
const file =
  process.argv[2] ?? resolve(ROOT, 'project-input/exely/audit-2026-09-07/spravochniki.md');
const services = parseExelyServices(readFileSync(file, 'utf-8'));
console.log(`услуг в справочнике: ${services.length}`);

const db = createPrismaClient();
try {
  const property = await db.property.findFirstOrThrow({
    where: { name: LUXX_APARTS_PROPERTY.name },
    select: { id: true },
  });
  const report = await db.$transaction((tx) => importServices(tx, services, property.id));
  console.log(
    `создано ${report.created}, обновлено ${report.updated}, без изменений ${report.unchanged}`,
  );
} finally {
  await db.$disconnect();
}
