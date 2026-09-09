/**
 * Импорт календаря цен и ограничений Exely (снимок `project-input/exely/prices/`).
 * Запуск: npx tsx scripts/imports/src/cli-import-price-calendar.ts [путь-к-json]
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createPrismaClient } from '@pms/database';
import { LUXX_APARTS_PROPERTY, importPriceCalendar, parseExelyPriceCalendar } from './exely/index';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });
const file = resolve(
  ROOT,
  process.argv[2] ?? 'project-input/exely/prices/price-calendar-2026-09-09.json',
);
const plan = parseExelyPriceCalendar(JSON.parse(readFileSync(file, 'utf-8')));
console.log(
  `календарь ${plan.period.from} → ${plan.period.to}: тарифов ${plan.tariffs.length}, строк цен ${plan.dailyRates.length}, строк ограничений ${plan.restrictions.length}`,
);
const db = createPrismaClient();
try {
  const property = await db.property.findFirstOrThrow({
    where: { name: LUXX_APARTS_PROPERTY.name },
    select: { id: true },
  });
  const r = await db.$transaction((tx) => importPriceCalendar(tx, plan, property.id), {
    timeout: 300_000,
    maxWait: 30_000,
  });
  console.log(
    `daily_rates: создано ${r.dailyRates.created} / обновлено ${r.dailyRates.updated} / без изменений ${r.dailyRates.unchanged}`,
  );
  console.log(
    `restrictions: создано ${r.restrictions.created} / обновлено ${r.restrictions.updated} / без изменений ${r.restrictions.unchanged}`,
  );
  for (const c of r.currencyChanged) console.log(`  валюта ${c.code}: ${c.from} → ${c.to}`);
} finally {
  await db.$disconnect();
}
