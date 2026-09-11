/**
 * Шаг 2.5 (Gate 2): загрузка месяца по единице-суткам — PMS (`Allocation`) против отчёта загрузки Exely.
 * Считаем по фактической ячейке (как отчёт Exely) и по забронированной категории (гипотеза Q-099).
 * Без персональных данных — только счётчики. Запуск: npx tsx scripts/reconciliation/src/cli-unit-nights.ts [YYYY-MM]
 * Пишет reports/unit-nights-YYYY-MM.md. Код выхода 1 при расхождении с контрольными числами.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createPrismaClient } from '@pms/database';
import { LUXX_APARTS_PROPERTY } from '@pms/imports';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });
const MONTH = process.argv[2] ?? '2026-08';
if (!/^\d{4}-\d{2}$/.test(MONTH)) throw new Error('месяц YYYY-MM');
const from = new Date(`${MONTH}-01T00:00:00Z`);
const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
const daysInMonth = Math.round((to.getTime() - from.getTime()) / 86_400_000);

/**
 * Контрольные числа за август 2026. Источник — расчёт аудита 07.09.2026 (`00-otvety.md`, строка 663):
 * «взяты все заезды июля и августа, у каждого посчитана часть проживания, попавшая в интервал 01–31.08».
 * То есть это НЕ отчёт Exely, а сумма по заездам двух месяцев. Гости, заехавшие ДО 1 июля, в неё не попали.
 * Разобрано 11.09.2026 по карточкам Exely: в мужском доме 4 таких долгожителя дали 49 августовских ночей
 * (47 с назначенной койкой + 2 без). Ночи заездов июля–августа по мужскому дому = 996, ровно число аудита.
 * Поэтому контроль по мужскому дому = 996 + 47; остальные категории долгожителей не имели.
 * Женский дом: одна бронь изменена в Exely 09.09.2026 (заезд перенесён с 30.07 на 22.08, живая карточка
 * проверена по API 11.09) — минус 18 августовских ночей против снимка 08.09; синхронизация 10.09 это подхватила.
 */
const CONTROL: Record<string, Record<string, number>> = {
  '2026-08': {
    'exely-5074312': 122,
    'exely-5074686': 245,
    'exely-5074687': 121,
    'exely-5074688': 996 + 47,
    'exely-5074689': 690 - 18,
  },
};
const control = CONTROL[MONTH];

const db = createPrismaClient();
try {
  const property = await db.property.findFirstOrThrow({
    where: { name: LUXX_APARTS_PROPERTY.name },
    select: { id: true },
  });
  const types = await db.accommodationType.findMany({
    where: { propertyId: property.id },
    select: { code: true, name: true, _count: { select: { units: true } } },
    orderBy: { code: 'asc' },
  });
  const allocs = await db.allocation.findMany({
    where: {
      startDate: { lt: to },
      endDate: { gt: from },
      reservationItem: { status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
    },
    select: {
      startDate: true,
      endDate: true,
      inventoryUnit: { select: { accommodationType: { select: { code: true } } } },
      reservationItem: {
        select: { status: true, accommodationType: { select: { code: true } } },
      },
    },
  });
  const byUnit: Record<string, number> = {};
  const byBooked: Record<string, number> = {};
  /** Разбивка ночей по статусу проживания — объясняет расхождение с отчётом Exely */
  const byStatus: Record<string, Record<string, number>> = {};
  let stays = 0;
  for (const a of allocs) {
    const s = Math.max(a.startDate.getTime(), from.getTime());
    const e = Math.min(a.endDate.getTime(), to.getTime());
    const nights = Math.round((e - s) / 86_400_000);
    if (nights <= 0) continue;
    stays += 1;
    const u = a.inventoryUnit.accommodationType.code;
    const b = a.reservationItem.accommodationType.code;
    byUnit[u] = (byUnit[u] ?? 0) + nights;
    byBooked[b] = (byBooked[b] ?? 0) + nights;
    const st = a.reservationItem.status;
    (byStatus[u] ??= {})[st] = (byStatus[u][st] ?? 0) + nights;
  }
  const unitsTotal = types.reduce((x, t) => x + t._count.units, 0);
  const capacity = unitsTotal * daysInMonth;
  const sum = (r: Record<string, number>) => Object.values(r).reduce((x, y) => x + y, 0);
  let mismatch = 0;
  const rows = types.map((t) => {
    const u = byUnit[t.code] ?? 0;
    const b = byBooked[t.code] ?? 0;
    const c = control?.[t.code];
    const diff = c === undefined ? null : u - c;
    if (diff) mismatch += 1;
    return `| ${t.name} | ${t._count.units * daysInMonth} | ${u} | ${b} | ${c ?? '—'} | ${diff === null ? '—' : diff === 0 ? '0 ✅' : diff > 0 ? `+${diff}` : diff} |`;
  });
  const totalU = sum(byUnit);
  const totalC = control ? sum(control) : null;
  const totalDiff = totalC === null ? null : totalU - totalC;
  if (totalDiff) mismatch += 1;
  const md = [
    `# Единице-сутки ${MONTH}: PMS против отчёта загрузки Exely`,
    '',
    `Снято ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC. Источник PMS: \`allocations\` проживаний со статусом не CANCELLED / NO_SHOW,`,
    `ночи в пределах месяца. «По ячейке» — категория фактической единицы (так считает отчёт Exely); «по брони» — категория,`,
    `на которую бронировали (Q-099). Контрольные числа — расчёт аудита 07.09.2026 по заездам июля–августа,`,
    `по мужскому дому добавлены 47 ночей четырёх гостей с заездом до 1 июля (разбор 11.09.2026, см. комментарий в скрипте).`,
    '',
    `| Категория | Ёмкость | PMS по ячейке | PMS по брони | Exely | diff (ячейка − Exely) |`,
    `|---|---|---|---|---|---|`,
    ...rows,
    `| **Итого** | **${capacity}** | **${totalU}** | **${sum(byBooked)}** | **${totalC ?? '—'}** | **${totalDiff === null ? '—' : totalDiff === 0 ? '0 ✅' : totalDiff}** |`,
    '',
    `Загрузка: PMS ${((totalU / capacity) * 100).toFixed(1)} %${totalC === null ? '' : `, Exely ${((totalC / capacity) * 100).toFixed(1)} %`}. Проживаний с ночами в месяце: ${stays}.`,
    '',
    mismatch === 0
      ? '**Расхождение 0.** Gate 2 по единице-суткам закрыт.'
      : `**Расхождение есть (${mismatch} строк).** Разбор по статусам проживания ниже.`,
    '',
    ...(mismatch === 0
      ? []
      : [
          '## Разбор расходящихся категорий по статусу проживания',
          '',
          'Отчёт загрузки Exely считает фактически прожитые ночи. Ночи проживаний, которые так и остались',
          'в статусе «подтверждено» в прошедшем месяце (гость не заезжал, бронь не отменяли), в загрузку Exely не попадают.',
          '',
          '| Категория | Статус | Ночей |',
          '|---|---|---|',
          ...types
            .filter(
              (t) => control && byUnit[t.code] !== undefined && byUnit[t.code] !== control[t.code],
            )
            .flatMap((t) =>
              Object.entries(byStatus[t.code] ?? {})
                .sort((a, b) => b[1] - a[1])
                .map(([st, n]) => `| ${t.name} | ${st} | ${n} |`),
            ),
          '',
        ]),
  ].join('\n');
  mkdirSync(resolve(ROOT, 'reports'), { recursive: true });
  const out = resolve(ROOT, `reports/unit-nights-${MONTH}.md`);
  writeFileSync(out, md);
  console.log(md);
  console.log(`→ ${out}`);
  process.exitCode = mismatch === 0 ? 0 : 1;
} finally {
  await db.$disconnect();
}
