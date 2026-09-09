/**
 * Сверка календаря цен PMS со снимком Exely (Gate 3, цены). Запуск из корня:
 *   npx tsx scripts/reconciliation/src/cli-rates.ts [путь-к-json]
 * Пишет reports/rates-YYYY-MM-DD.md. Код выхода 1 при любом расхождении.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createPrismaClient } from '@pms/database';
import { LUXX_APARTS_PROPERTY, parseExelyPriceCalendar, readRatesFromDb } from '@pms/imports';
import { compareRates, renderRatesReport } from './rates-compare';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });
const file = resolve(
  ROOT,
  process.argv[2] ?? 'project-input/exely/prices/price-calendar-2026-09-09.json',
);
const exely = parseExelyPriceCalendar(JSON.parse(readFileSync(file, 'utf-8')));
const db = createPrismaClient();
try {
  const property = await db.property.findFirstOrThrow({
    where: { name: LUXX_APARTS_PROPERTY.name },
    select: { id: true },
  });
  const pms = await readRatesFromDb(db, property.id, exely.period);
  const cmp = compareRates({ exely: exely.dailyRates, pms: pms.dailyRates });
  const date = new Date().toISOString().slice(0, 10);
  const md = renderRatesReport(cmp, {
    controlDate: date,
    period: exely.period,
    names: pms.names,
    restrictions: { exely: exely.restrictions.length, pms: pms.restrictions.length },
  });
  mkdirSync(resolve(ROOT, 'reports'), { recursive: true });
  const out = resolve(ROOT, `reports/rates-${date}.md`);
  writeFileSync(out, md);
  console.log(md);
  console.log(`→ ${out}`);
  process.exitCode = cmp.ok && exely.restrictions.length === pms.restrictions.length ? 0 : 1;
} finally {
  await db.$disconnect();
}
