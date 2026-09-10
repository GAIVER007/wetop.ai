/**
 * Сверка фонда PMS с аудитом Exely (Gate 1). Запуск из корня:
 *   npx tsx scripts/reconciliation/src/cli-inventory.ts [--live]
 * Пишет reports/inventory-YYYY-MM-DD.md. Код выхода 1 при любом расхождении.
 *
 * --live дополнительно сверяет фонд с ЖИВЫМ Exely (GET /v1/rooms, только чтение). Без него сверка
 * замкнута сама на себя: и импорт, и сравнение читают одни и те же два файла аудита, поэтому отчёт
 * доказывает лишь, что импорт ничего не потерял, а не что фонд в Exely сегодня такой же.
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
import { exely as exelyApi } from '@pms/integrations';
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
  let md = renderInventoryReport(cmp, date);
  if (process.argv.includes('--live')) md += await liveSection();
  mkdirSync(resolve(ROOT, 'reports'), { recursive: true });
  const out = resolve(ROOT, `reports/inventory-${date}.md`);
  writeFileSync(out, md);
  console.log(md);
  console.log(`→ ${out}`);
  process.exitCode = cmp.ok ? 0 : 1;
} finally {
  await db.$disconnect();
}

/** Сверка с живым Exely: только чтение, ПД не запрашиваются (в /v1/rooms их нет). */
async function liveSection(): Promise<string> {
  const key = process.env['EXELY_API_KEY'];
  if (!key) return '\n## Живой Exely\n\nEXELY_API_KEY не задан — сверка не выполнялась.\n';
  const client = new exelyApi.ExelyUniversalClient({ apiKey: key });
  const rooms = await client.rooms();
  const dbUnits = await db.inventoryUnit.findMany({
    where: { accommodationType: { property: { name: LUXX_APARTS_PROPERTY.name } } },
    select: { exelyRoomNumber: true, accommodationType: { select: { exelyId: true, name: true } } },
  });
  const liveByType = new Map<string, number>();
  for (const r of rooms) liveByType.set(r.roomTypeId, (liveByType.get(r.roomTypeId) ?? 0) + 1);
  const pmsByType = new Map<string, { n: number; name: string }>();
  for (const u of dbUnits) {
    const id = (u.accommodationType.exelyId ?? '').replace(/^exely-/, '');
    const cur = pmsByType.get(id) ?? { n: 0, name: u.accommodationType.name };
    cur.n += 1;
    pmsByType.set(id, cur);
  }
  const liveNumbers = new Set(rooms.map((r) => r.name));
  const pmsNumbers = new Set(dbUnits.map((u) => u.exelyRoomNumber).filter(Boolean) as string[]);
  const onlyLive = [...liveNumbers].filter((n) => !pmsNumbers.has(n));
  const onlyPms = [...pmsNumbers].filter((n) => !liveNumbers.has(n));
  const types = new Set([...liveByType.keys(), ...pmsByType.keys()]);
  const rows = [...types].sort().map((t) => {
    const pms = pmsByType.get(t)?.n ?? 0;
    const live = liveByType.get(t) ?? 0;
    return `| ${pmsByType.get(t)?.name ?? t} | ${pms} | ${live} | ${pms - live} |`;
  });
  const ok = onlyLive.length === 0 && onlyPms.length === 0 && rows.every((r) => r.endsWith('| 0 |'));
  if (!ok) process.exitCode = 1;
  return [
    '',
    '## Живой Exely (GET /v1/rooms, только чтение)',
    '',
    `Прочитано на ${new Date().toISOString().slice(0, 19)} UTC. Это внешний источник, а не файл аудита.`,
    '',
    '| Категория | PMS | EXELY | DIFF |',
    '|---|---:|---:|---:|',
    `| всего единиц | ${pmsNumbers.size} | ${liveNumbers.size} | ${pmsNumbers.size - liveNumbers.size} |`,
    ...rows,
    '',
    onlyLive.length ? `Только в Exely: ${onlyLive.join(', ')}` : 'Единиц, которых нет в PMS: нет.',
    onlyPms.length ? `Только в PMS: ${onlyPms.join(', ')}` : 'Единиц, которых нет в Exely: нет.',
    '',
    `LIVE RESULT: ${ok ? 'OK — фонд в Exely сегодня такой же' : 'FAIL — фонд разошёлся'}`,
    '',
  ].join('\n');
}
