/**
 * Статистика по выгрузке Универсального API (project-input/exely/api/<дата>) — без ПД.
 * Считает контрольные числа Gate 2 (PLAN.md): единице-сутки августа по категориям, заезды,
 * будущие проживания и их сумму. Запуск: npx tsx scripts/imports/src/exely/cli-stats-universal.ts 2026-09-08
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { exely } from '@pms/integrations';

const ROOT = resolve(import.meta.dirname, '../../../..');
const day = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const DIR = resolve(ROOT, `project-input/exely/api/${day}`);
const load = <T>(n: string): T => JSON.parse(readFileSync(resolve(DIR, n), 'utf-8')) as T;

const TYPE_NAME: Record<string, string> = {
  '5074312': 'Одноместная с окном',
  '5074686': 'Одноместная без окон',
  '5074687': 'Двухместная',
  '5074688': 'Общая мужская',
  '5074689': 'Общая женская',
};
const CONTROL = {
  unitDays: { '5074312': 122, '5074686': 245, '5074687': 121, '5074688': 996, '5074689': 690 },
  total: 2174,
  arrivals: 1044,
  futureStays: 209,
  futureSum: 474353500n,
};

// ── август: начисления по дням пребывания (kind=1) → единице-сутки
const k1 = load<exely.UniAnalyticsServices>('analytics-services-aug-kind1.json');
const resById = new Map(k1.reservations.map((r) => [r.id, r]));
const stayRows = k1.services.filter((s) => s.kind === 0);
const unitDays = new Map<string, Set<string>>(); // roomTypeId → set(date|reservationId)
for (const s of stayRows) {
  const r = resById.get(s.reservationId);
  const t = String(r?.roomTypeId ?? '?');
  if (!unitDays.has(t)) unitDays.set(t, new Set());
  unitDays.get(t)!.add(`${s.date}|${s.reservationId}`);
}
console.log(
  `\nАВГУСТ 2026 — единице-сутки по начислениям kind=1 (строк проживания: ${stayRows.length}, проживаний: ${k1.reservations.length})`,
);
console.log('| Категория | API | Контроль | diff |\n|---|---:|---:|---:|');
let total = 0;
for (const [t, ctrl] of Object.entries(CONTROL.unitDays)) {
  const n = unitDays.get(t)?.size ?? 0;
  total += n;
  console.log(`| ${TYPE_NAME[t]} | ${n} | ${ctrl} | ${n - ctrl} |`);
}
console.log(`| ИТОГО | ${total} | ${CONTROL.total} | ${total - CONTROL.total} |`);
const revenueAug = stayRows.reduce((a, s) => a + Math.round(s.amount * 100), 0);
console.log(
  `начисления за проживание в августе (kind=1): ${(revenueAug / 100).toLocaleString('ru-RU')} ₸`,
);

// ── заезды августа из карточек броней
const files = readdirSync(resolve(DIR, 'bookings')).filter((f) => f.endsWith('.json'));
const bookings = files.map((f) => load<exely.UniBooking>(`bookings/${f}`));
let arrivalsAug = 0,
  futureStays = 0,
  futureSum = 0n,
  inHouse = 0,
  cancelledStays = 0;
const futureByStatus = new Map<string, number>();
for (const b of bookings) {
  for (const s of b.roomStays) {
    const inDate = s.checkInDateTime.slice(0, 10);
    if (
      s.status !== 'Cancelled' &&
      s.bookingStatus !== 'Cancelled' &&
      inDate >= '2026-08-01' &&
      inDate <= '2026-08-31'
    )
      arrivalsAug++;
    if (s.status === 'Cancelled' || s.bookingStatus === 'Cancelled') {
      cancelledStays++;
      continue;
    }
    const outDate = s.checkOutDateTime.slice(0, 10);
    if (inDate > day) {
      futureStays++;
      futureSum += BigInt(Math.round(s.totalPrice.amount * 100));
      futureByStatus.set(s.status, (futureByStatus.get(s.status) ?? 0) + 1);
    } else if (inDate <= day && outDate > day) inHouse++;
  }
}
console.log(`\nБРОНИ (карточек: ${bookings.length})`);
console.log(
  `заезды августа (проживания, не отменённые): ${arrivalsAug} — контроль ${CONTROL.arrivals}, diff ${arrivalsAug - CONTROL.arrivals}`,
);
console.log(
  `будущие проживания (заезд после ${day}): ${futureStays} — контроль 209 на 07.09, diff ${futureStays - CONTROL.futureStays}; сумма ${(Number(futureSum) / 100).toLocaleString('ru-RU')} ₸ — контроль 4 743 535 ₸`,
);
console.log(
  `  по статусам: ${[...futureByStatus.entries()].map(([k, v]) => `${k} ${v}`).join(', ')}`,
);
console.log(
  `проживают сейчас (${day}): ${inHouse} — Exely 08.09 показывала 87; отменённых проживаний в выборке: ${cancelledStays}`,
);
