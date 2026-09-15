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
import { compareDay, type ExelyStay, type PmsStay } from './double-entry';

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

/** Метка автотестов: такие брони есть только в PMS и в сверку с Exely не идут */
const E2E_NOTE = 'E2E-АВТОТЕСТ';
let e2eSkipped = 0;

// ── Exely: активные брони, затрагивающие сутки ──
const client = new exely.ExelyUniversalClient({ apiKey: key });
const numbers = await client.searchBookings({
  state: 'Active',
  affectsPeriodFrom: `${DATE}T00:00`,
  affectsPeriodTo: `${plus(DATE, 1)}T00:00`,
});
const exelyStays: ExelyStay[] = [];
const roomTypeNames = new Map<string, string>();
for (const n of numbers) {
  const b = await client.booking(n);
  for (const rs of b.roomStays)
    exelyStays.push({
      bookingNumber: b.number,
      roomTypeId: rs.roomTypeId,
      checkIn: rs.checkInDateTime.slice(0, 10),
      checkOut: rs.checkOutDateTime.slice(0, 10),
      actualCheckOut: rs.actualCheckOutDateTime?.slice(0, 10) ?? null,
      status: rs.status,
      bookingStatus: rs.bookingStatus,
    });
}

// ── PMS ──
const db = createPrismaClient();
const pmsStays: PmsStay[] = [];
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
      // Незаезды берём тоже: Универсальный API Exely незаезда не знает, и молча выброшенное
      // проживание давало −1, который гасил чужую ошибку. Такие строки называет отчёт.
      status: { not: 'CANCELLED' },
      arrivalDate: { lte: new Date(`${DATE}T00:00:00Z`) },
      departureDate: { gte: new Date(`${DATE}T00:00:00Z`) },
    },
    select: {
      arrivalDate: true,
      departureDate: true,
      status: true,
      exelyRoomStayId: true,
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
    pmsStays.push({
      number: it.reservation.confirmationNumber,
      categoryKey: it.accommodationType.exelyId ?? it.accommodationType.id,
      categoryName: it.accommodationType.name,
      arrival: it.arrivalDate.toISOString().slice(0, 10),
      departure: it.departureDate.toISOString().slice(0, 10),
      status: it.status,
      fromExely: it.exelyRoomStayId !== null,
      hasUnit: it.allocations.length > 0,
    });
  }
} finally {
  await db.$disconnect();
}

const r = compareDay(DATE, exelyStays, pmsStays);
const lines = [
  `# Double entry — ${DATE}`,
  '',
  `CONTROL: ${new Date().toISOString().slice(0, 16)} UTC · Exely активных броней за сутки: ${numbers.length} (только чтение, без ПД)` +
    (e2eSkipped ? ` · исключено проживаний автотестов: ${e2eSkipped}` : ''),
  '',
  '| Metric | PMS | EXELY | DIFF |',
  '|---|---:|---:|---:|',
  `| arrivals | ${r.pms.arrivals} | ${r.exely.arrivals} | ${r.pms.arrivals - r.exely.arrivals} |`,
  `| departures | ${r.pms.departures} | ${r.exely.departures} | ${r.pms.departures - r.exely.departures} |`,
  `| occupied units (night) | ${r.pms.occupied} | ${r.exely.occupied} | ${r.pms.occupied - r.exely.occupied} |`,
  // строка про сетку: столько занятых клеток увидит администратор на шахматке
  `| из них видно на шахматке (есть ячейка) | ${r.cellsOnGrid} | — | ${r.cellsOnGrid - r.pms.occupied} |`,
];
const cats = new Set([...Object.keys(r.pms.byCategory), ...Object.keys(r.exely.byCategory)]);
for (const c of [...cats].sort())
  lines.push(
    `| ${roomTypeNames.get(c) ?? c} | ${r.pms.byCategory[c] ?? 0} | ${r.exely.byCategory[c] ?? 0} | ${(r.pms.byCategory[c] ?? 0) - (r.exely.byCategory[c] ?? 0)} |`,
  );
lines.push(
  '',
  `RESULT: ${r.ok ? 'OK — сутки сходятся' : 'FAIL — есть расхождения, поимённый разбор ниже'}`,
  '',
);
const named = (rows: typeof r.onlyPms) =>
  rows.map((p) => `| ${p.number} | ${p.category} | ${p.stay} | ${p.why ?? ''} |`);
if (r.withoutUnit.length) {
  lines.push(
    `## Проживания без ячейки — ${r.withoutUnit.length} (на шахматке их не видно)`,
    '',
    '| Бронь | Категория | Проживание | Почему |',
    '|---|---|---|---|',
    ...named(r.withoutUnit),
    '',
  );
}

// ── Поимённый разбор: какие именно брони расходятся (Gate 8: расхождение должно быть названо) ──
// Списки считаются всегда, а не только при разошедшихся числах: две встречные ошибки дают ноль.
if (!r.ok) {
  lines.push(
    '## Разбор расхождения',
    '',
    `Занимают ночь только в PMS: **${r.onlyPms.length}**. Занимают ночь только в Exely: **${r.onlyExely.length}**.` +
      (r.noShow.length ? ` Незаездов, которые в Exely ещё заняты: **${r.noShow.length}**.` : ''),
    '',
  );
  if (r.onlyPms.length) {
    lines.push(
      'Только в PMS — брони, которых на эти сутки нет в Exely: сокращены, отменены или переселены после',
      'последнего переноса, либо заведены прямо в PMS (сайт, канал, стойка). Колонка «Почему» говорит, что именно.',
      '',
      '| Бронь | Категория | Проживание | Почему |',
      '|---|---|---|---|',
      ...named(r.onlyPms.slice(0, 40)),
      '',
    );
    if (r.onlyPms.length > 40) lines.push(`…и ещё ${r.onlyPms.length - 40} строк.`, '');
  }
  if (r.onlyExely.length) {
    lines.push(
      'Только в Exely — брони, которых нет в PMS (созданы после переноса). Подтянуть:',
      '`npx tsx scripts/imports/src/cli-sync-day.ts ' + DATE + '`',
      '',
      ...r.onlyExely.slice(0, 40).map((n) => `- ${n}`),
      '',
    );
    if (r.onlyExely.length > 40) lines.push(`…и ещё ${r.onlyExely.length - 40} строк.`, '');
  }
  if (r.noShow.length) {
    lines.push(
      'Незаезды: стойка отметила незаезд в PMS, а Универсальный API Exely такого статуса не отдаёт —',
      'бронь там всё ещё занимает ночь. Снять её в Exely должен человек.',
      '',
      '| Бронь | Категория | Проживание | Почему |',
      '|---|---|---|---|',
      ...named(r.noShow),
      '',
    );
  }
}
mkdirSync(resolve(ROOT, 'reports'), { recursive: true });
const out = resolve(ROOT, `reports/double-entry-${DATE}.md`);
writeFileSync(out, lines.join('\n'));
console.log(lines.join('\n'));
console.log(`→ ${out}`);
process.exitCode = r.ok ? 0 : 1;
