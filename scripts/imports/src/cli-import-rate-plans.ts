/** Импорт 6 тарифов Exely из аудита. Запуск: npx tsx scripts/imports/src/cli-import-rate-plans.ts */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createPrismaClient } from '@pms/database';
import {
  LUXX_APARTS_PROPERTY,
  buildRatePlanImportPlan,
  importRatePlans,
  parseExelyRatePlans,
} from './exely/index';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });
const rows = parseExelyRatePlans(
  readFileSync(resolve(ROOT, 'project-input/exely/audit-2026-09-07/spravochniki.md'), 'utf-8'),
);
const db = createPrismaClient();
try {
  const property = await db.property.findFirstOrThrow({
    where: { name: LUXX_APARTS_PROPERTY.name },
    select: { id: true, currency: true },
  });
  const types = await db.accommodationType.findMany({
    where: { propertyId: property.id },
    select: { code: true },
  });
  const plan = buildRatePlanImportPlan(
    rows,
    types.map((t) => t.code),
    property.currency,
  );
  const r = await db.$transaction((tx) => importRatePlans(tx, plan, property.id), {
    timeout: 120_000,
  });
  console.log(
    `тарифов: создано ${r.ratePlans.created} / обновлено ${r.ratePlans.updated}; активных ${plan.ratePlans.filter((p) => p.active).length} из ${plan.ratePlans.length}; связей с категориями добавлено ${r.links}`,
  );
  for (const p of plan.ratePlans)
    console.log(`  ${p.active ? '●' : '○'} ${p.code} ${p.name}${p.note ? ` — ${p.note}` : ''}`);
} finally {
  await db.$disconnect();
}
