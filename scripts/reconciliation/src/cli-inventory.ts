/**
 * Сверка фонда PMS с аудитом Exely (Gate 1). Запуск из корня:
 *   npx tsx scripts/reconciliation/src/cli-inventory.ts
 * Пишет reports/inventory-YYYY-MM-DD.md. Код выхода 1 при любом расхождении.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createPrismaClient } from '@pms/database';
import { summarizeInventoryPlan } from '@pms/domain';
import {
  LUXX_APARTS_PROPERTY,
  buildInventoryImportPlan,
  parseExelyAccommodationTypes,
  parseExelyInventory,
  readInventoryPlanFromDb,
} from '@pms/imports';
import { compareInventory, renderInventoryReport } from './inventory-compare';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });
const AUDIT = resolve(ROOT, 'project-input/exely/audit-2026-09-07');

const exelyPlan = buildInventoryImportPlan(
  parseExelyInventory(readFileSync(resolve(AUDIT, 'inventory.md'), 'utf-8')),
  parseExelyAccommodationTypes(readFileSync(resolve(AUDIT, 'spravochniki.md'), 'utf-8')),
);
const db = createPrismaClient();
try {
  const fromDb = await readInventoryPlanFromDb(db, LUXX_APARTS_PROPERTY.name);
  if (!fromDb) throw new Error(`В БД нет объекта «${LUXX_APARTS_PROPERTY.name}» — сначала импорт`);
  const cmp = compareInventory({
    pms: summarizeInventoryPlan(fromDb.plan),
    exely: summarizeInventoryPlan(exelyPlan),
    blocksInPms: fromDb.blocks,
    blocksInExely: 0, // аудит 07.09.2026: блокировок 0
  });
  const date = new Date().toISOString().slice(0, 10);
  const md = renderInventoryReport(cmp, date);
  mkdirSync(resolve(ROOT, 'reports'), { recursive: true });
  const out = resolve(ROOT, `reports/inventory-${date}.md`);
  writeFileSync(out, md);
  console.log(md);
  console.log(`→ ${out}`);
  process.exitCode = cmp.ok ? 0 : 1;
} finally {
  await db.$disconnect();
}
