/**
 * Импорт номерного фонда из аудита Exely в PMS. Запуск из корня:
 *   npx tsx scripts/imports/src/cli-import-inventory.ts
 * DATABASE_URL читает программа из .env (SECURITY.md §3). Транзакция одна: либо всё, либо ничего.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createPrismaClient } from '@pms/database';
import { summarizeInventoryPlan } from '@pms/domain';
import {
  LUXX_APARTS_PROPERTY,
  buildInventoryImportPlan,
  importInventoryPlan,
  parseExelyAccommodationTypes,
  parseExelyInventory,
} from './exely/index';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });
const AUDIT = resolve(ROOT, 'project-input/exely/audit-2026-09-07');

const inv = parseExelyInventory(readFileSync(resolve(AUDIT, 'inventory.md'), 'utf-8'));
const types = parseExelyAccommodationTypes(
  readFileSync(resolve(AUDIT, 'spravochniki.md'), 'utf-8'),
);
const plan = buildInventoryImportPlan(inv, types);
const expected = summarizeInventoryPlan(plan);
console.log(
  `План: ${expected.totalUnits} единиц = ${expected.rooms} ROOM + ${expected.beds} BED, гостей ${expected.maxGuests}`,
);

const db = createPrismaClient();
try {
  const report = await db.$transaction(
    (tx) => importInventoryPlan(tx, plan, { ...LUXX_APARTS_PROPERTY }),
    {
      timeout: 60_000,
    },
  );
  console.log('Импорт завершён. Создано / обновлено:');
  for (const [k, v] of Object.entries(report)) {
    if (typeof v === 'object' && v !== null)
      console.log(`  ${k.padEnd(20)} ${v.created} / ${v.updated}`);
  }
  console.log(`  единиц в БД: ${report.unitsInDb}`);
} finally {
  await db.$disconnect();
}
