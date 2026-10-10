/**
 * Двойной ввод (PLAN неделя 6, Gate 8): сутки в Exely и в PMS должны сходиться числом к числу.
 * Только чтение Exely (Универсальный API, EXELY_API_KEY), без персональных данных — только счётчики.
 * Запуск: npx tsx scripts/reconciliation/src/cli-double-entry.ts [YYYY-MM-DD]  (по умолчанию завтра, Алматы)
 * Пишет reports/double-entry-YYYY-MM-DD.md. Код выхода 1 при любом расхождении.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createPrismaClient } from '@pms/database';
import { exely } from '@pms/integrations';
import { LUXX_APARTS_PROPERTY } from '@pms/imports';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });
const almatyToday = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
const plus = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const DATE = process.argv[2] ?? plus(almatyToday, 1);
if (!/^\d{4}-\d{2}-\d{2}$/.test(DATE)) throw new Error('дата YYYY-MM-DD');
const key = process.env.EXELY_API_KEY;
if (!key) throw new Error('EXELY_API_KEY пуст');

interface Counts {
  arrivals: number;
  departures: number;
  occupied: number;
  byCategory: Record<string, number>;
}
const empty = (): Counts => ({ arrivals: 0, departures: 0, occupied: 0, byCategory: {} });
/** Метка автотестов: такие брони есть только в PMS и в сверку с Exely не идут */
const E2E_NOTE = 'E2E-АВТОТЕСТ';
let e2eSkipped = 0;
/** Сколько занятых клеток на сетке: проживание без назначенной ячейки шахматка не рисует */
let cellsOnGrid = 0;
const withoutUnit: Array<{ number: string; category: string; stay: string }> = [];

// ── Exely: активные брони, затрагивающие сутки ──
const client = new exely.ExelyUniversalClient({ apiKey: key });
const numbers = await client.searchBookings({
  state: 'Active',
  affectsPeriodFrom: `${DATE}T00:00`,
  affectsPeriodTo: `${plus(DATE, 1)}T00:00`,
});
const ex = empty();
/** Номера броней Exely, занимающих эту ночь — для поимённого разбора расхождений */
const exOccupying = new Set<string>();
const roomTypeNames = new Map<string, string>();
for (const n of numbers) {
  const b = await client.booking(n);
  for (const rs of b.roomStays) {
    if (rs.bookingStatus === 'Cancelled' || rs.status === 'Cancelled') continue;
    const ci = rs.checkInDateTime.slice(0, 10);
    const co = rs.checkOutDateTime.slice(0, 10);
    if (ci === DATE) ex.arrivals += 1;
    if (co === DATE) ex.departures += 1;
    if (ci <= DATE && DATE < co) {
      ex.occupied += 1;
      exOccupying.add(b.number);
      ex.byCategory[rs.roomTypeId] = (ex.byCategory[rs.roomTypeId] ?? 0) + 1;
    }
  }
}

// ── PMS ──
const db = createPrismaClient();
const pms = empty();
/** Проживания PMS, занимающие ночь — для поимённого разбора расхождений */
const pmsOccupying: Array<{ number: string; category: string; stay: string }> = [];
try {
  const property = await db.property.findFirstOrThrow({
    where: { name: LUXX_APARTS_PROPERTY.name },
    select: { id: true },
  });
  const types = await db.accommodationType.findMany({
    where: { propertyId: property.id },
    select: { id: true, exelyId: true, name: true },
  });
  for (const t of types) roomTypeNames.set(t.exelyId ?? t.id, t.name);
  const items = await db.reservationItem.findMany({
    where: {
      reservation: { propertyId: property.id },
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      arrivalDate: { lte: new Date(`${DATE}T00:00:00Z`) },
      departureDate: { gte: new Date(`${DATE}T00:00:00Z`) },
    },
    select: {
      arrivalDate: true,
      departureDate: true,
      accommodationType: { select: { exelyId: true, id: true, name: true } },
      reservation: { select: { confirmationNumber: true, notes: true } },
      // Шахматка рисует НАЗНАЧЕНИЯ, а не проживания: проживание без ячейки на сетке не видно вовсе.
      // Поэтому в отчёт идёт и то, и другое — иначе сверка проходит по данным, которых нет на экране.
      allocations: {
        where: {
          startDate: { lte: new Date(`${DATE}T00:00:00Z`) },
          endDate: { gt: new Date(`${DATE}T00:00:00Z`) },
        },
        select: { inventoryUnit: { select: { code: true } } },
      },
    },
  });
  for (const it of items) {
    // Брони, созданные автотестами, живут в той же базе. Они не существуют в Exely и сдвинули бы
    // сверку на ровно своё количество, поэтому исключаются явно и пересчитываются в отчёт.
    if (it.reservation.notes === E2E_NOTE) {
      e2eSkipped += 1;
      continue;
    }
    const ci = it.arrivalDate.toISOString().slice(0, 10);
    const co = it.departureDate.toISOString().slice(0, 10);
    if (ci === DATE) pms.arrivals += 1;
    if (co === DATE) pms.departures += 1;
    if (ci <= DATE && DATE < co) {
      pms.occupied += 1;
      const k = it.accommodationType.exelyId ?? it.accommodationType.id;
      pms.byCategory[k] = (pms.byCategory[k] ?? 0) + 1;
      if (it.allocations.length) cellsOnGrid += 1;
      else
        withoutUnit.push({
          number: it.reservation.confirmationNumber,
          category: it.accommodationType.name,
          stay: `${ci} → ${co}`,
        });
      pmsOccupying.push({
        number: it.reservation.confirmationNumber,
        category: it.accommodationType.name,
        stay: `${ci} → ${co}`,
      });
    }
  }
} finally {
  await db.$disconnect();
}

const lines = [
  `# Double entry — ${DATE}`,
  '',
  `CONTROL: ${new Date().toISOString().slice(0, 16)} UTC · Exely активных броней за сутки: ${numbers.length} (только чтение, без ПД)` +
    (e2eSkipped ? ` · исключено проживаний автотестов: ${e2eSkipped}` : ''),
  '',
  '| Metric | PMS | EXELY | DIFF |',
  '|---|---:|---:|---:|',
  `| arrivals | ${pms.arrivals} | ${ex.arrivals} | ${pms.arrivals - ex.arrivals} |`,
  `| departures | ${pms.departures} | ${ex.departures} | ${pms.departures - ex.departures} |`,
  `| occupied units (night) | ${pms.occupied} | ${ex.occupied} | ${pms.occupied - ex.occupied} |`,
  // строка про сетку: столько занятых клеток увидит администратор на шахматке
  `| из них видно на шахматке (есть ячейка) | ${cellsOnGrid} | — | ${cellsOnGrid - pms.occupied} |`,
];
const cats = new Set([...Object.keys(pms.byCategory), ...Object.keys(ex.byCategory)]);
for (const c of [...cats].sort())
  lines.push(
    `| ${roomTypeNames.get(c) ?? c} | ${pms.byCategory[c] ?? 0} | ${ex.byCategory[c] ?? 0} | ${(pms.byCategory[c] ?? 0) - (ex.byCategory[c] ?? 0)} |`,
  );
const ok =
  withoutUnit.length === 0 &&
  pms.arrivals === ex.arrivals &&
  pms.departures === ex.departures &&
  pms.occupied === ex.occupied &&
  [...cats].every((c) => (pms.byCategory[c] ?? 0) === (ex.byCategory[c] ?? 0));
lines.push(
  '',
  `RESULT: ${ok ? 'OK — сутки сходятся' : 'FAIL — есть расхождения, поимённый разбор ниже'}`,
  '',
);
if (withoutUnit.length) {
  lines.push(
    `## Проживания без ячейки — ${withoutUnit.length} (на шахматке их не видно)`,
    '',
    '| Бронь | Категория | Проживание |',
    '|---|---|---|',
    ...withoutUnit.map((p) => `| ${p.number} | ${p.category} | ${p.stay} |`),
    '',
  );
}

// ── Поимённый разбор: какие именно брони расходятся (Gate 8: расхождение должно быть названо) ──
if (!ok) {
  const onlyPms = pmsOccupying.filter((p) => !exOccupying.has(p.number));
  const pmsNumbers = new Set(pmsOccupying.map((p) => p.number));
  const onlyExely = [...exOccupying].filter((n) => !pmsNumbers.has(n));
  lines.push(
    '## Разбор расхождения',
    '',
    `Занимают ночь только в PMS: **${onlyPms.length}**. Занимают ночь только в Exely: **${onlyExely.length}**.`,
    '',
  );
  if (onlyPms.length) {
    lines.push(
      'Только в PMS — брони, которые в Exely на эти сутки уже не активны (сокращены, отменены или переселены',
      'после последнего переноса). При параллельном ведении такие строки означают, что PMS отстала от Exely.',
      '',
      '| Бронь | Категория | Проживание |',
      '|---|---|---|',
      ...onlyPms.slice(0, 40).map((p) => `| ${p.number} | ${p.category} | ${p.stay} |`),
      '',
    );
    if (onlyPms.length > 40) lines.push(`…и ещё ${onlyPms.length - 40} строк.`, '');
  }
  if (onlyExely.length) {
    lines.push(
      'Только в Exely — брони, которых нет в PMS (созданы после переноса). Подтянуть:',
      '`npx tsx scripts/imports/src/cli-sync-day.ts ' + DATE + '`',
      '',
      ...onlyExely.slice(0, 40).map((n) => `- ${n}`),
      '',
    );
    if (onlyExely.length > 40) lines.push(`…и ещё ${onlyExely.length - 40} строк.`, '');
  }
}
mkdirSync(resolve(ROOT, 'reports'), { recursive: true });
const out = resolve(ROOT, `reports/double-entry-${DATE}.md`);
writeFileSync(out, lines.join('\n'));
console.log(lines.join('\n'));
console.log(`→ ${out}`);
process.exitCode = ok ? 0 : 1;
