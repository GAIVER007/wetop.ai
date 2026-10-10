/**
 * Период из Exely против PMS — отчёт без ПД. Сырьё кладёт scripts/imports/src/exely/cli-dump-period.ts
 * в project-input/exely/api/<папка> (закрыта от чтения агентом); этот скрипт печатает только числа и номера броней.
 *
 * Что считает:
 *  1) брони и проживания периода по карточкам: статусы, категории, каналы, ночи;
 *  2) деньги: начисления по дням пребывания (проживание, услуги), стоимость / оплачено / к оплате по карточкам;
 *  3) журнал платежей Exely за период: по типу операции, способу оплаты, дням; что добавляют внешние предоплаты;
 *  4) PMS против карточек: каждое проживание по exely_room_stay_id — есть ли, статус, даты, категория, цена,
 *     перенесённая оплата (тем же нормализатором, что и импорт); сутки периода — заезды / выезды / занято,
 *     по правилам двойного ввода (cli-double-entry.ts).
 *
 * Запуск: npx tsx scripts/reconciliation/src/cli-exely-period.ts <папка выгрузки>
 * Пишет reports/exely-period-<from>_<to>.md; «Историю сверки» дописывает строкой на каждый прогон.
 * Код выхода 1, если PMS расходится с карточками Exely.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createPrismaClient } from '@pms/database';
import type { exely } from '@pms/integrations';
import {
  LUXX_APARTS_PROPERTY,
  adaptUniBooking,
  normalizeExelyReservation,
  toMinorUnits,
  type ReservationImportRecord,
  type ReservationItemImportRecord,
} from '@pms/imports';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });
const DIR_NAME = process.argv[2];
if (!DIR_NAME) throw new Error('укажите папку выгрузки: project-input/exely/api/<папка>');
const DIR = resolve(ROOT, `project-input/exely/api/${DIR_NAME}`);
const load = <T>(n: string): T => JSON.parse(readFileSync(resolve(DIR, n), 'utf-8')) as T;
const manifest = load<{
  period: { from: string; to: string };
  finishedAt?: string;
  payments?: { start: string; end: string | null };
  cards?: { failed: number };
}>('manifest.json');
const FROM = manifest.period.from;
const TO = manifest.period.to;
const plus = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const TO_EXCL = plus(TO, 1);
const DAYS: string[] = [];
for (let d = FROM; d <= TO; d = plus(d, 1)) DAYS.push(d);
const almatyToday = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
const E2E_NOTE = 'E2E-АВТОТЕСТ';

const nightsIn = (arr: string, dep: string) => {
  const s = arr > FROM ? arr : FROM;
  const e = dep < TO_EXCL ? dep : TO_EXCL;
  return e > s ? Math.round((Date.parse(`${e}T00:00:00Z`) - Date.parse(`${s}T00:00:00Z`)) / 86_400_000) : 0;
};
const touches = (arr: string, dep: string) =>
  nightsIn(arr, dep) > 0 || (arr >= FROM && arr <= TO) || (dep >= FROM && dep <= TO);
const money = (m: bigint) => {
  const d = (m < 0n ? -m : m).toString().padStart(3, '0');
  return `${m < 0n ? '−' : ''}${d.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')},${d.slice(-2)} ₸`;
};
const add = <K>(m: Map<K, bigint>, k: K, v: bigint) => m.set(k, (m.get(k) ?? 0n) + v);
const inc = <K>(m: Map<K, number>, k: K, v = 1) => m.set(k, (m.get(k) ?? 0) + v);
const ddmm = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;

const TYPE_NAME: Record<string, string> = {
  '5074312': 'Одноместная с окном',
  '5074686': 'Одноместная без окон',
  '5074687': 'Двухместная',
  '5074688': 'Общая мужская',
  '5074689': 'Общая женская',
};
const typeName = (code: string) => TYPE_NAME[code.replace(/^exely-/, '')] ?? code;
const STATUS_RU: Record<string, string> = {
  New: 'новое (не заехал)',
  CheckedIn: 'проживает',
  CheckedOut: 'выехал',
  Cancelled: 'отменено',
};

// ── карточки ──
const rooms = load<exely.UniRoom[]>('rooms.json');
const roomMap = new Map(rooms.map((r) => [r.id, r.name]));
const typeMap = new Map(rooms.map((r) => [r.roomTypeId, `exely-${r.roomTypeId}`]));
const cards = readdirSync(resolve(DIR, 'bookings'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => load<exely.UniBooking>(`bookings/${f}`));

interface StayRow {
  booking: exely.UniBooking;
  raw: exely.UniRoomStay;
  item: ReservationItemImportRecord | null;
  record: ReservationImportRecord | null;
  cancelled: boolean;
  channel: string;
}
const normalizeErrors: string[] = [];
const stays: StayRow[] = [];
for (const b of cards) {
  let record: ReservationImportRecord | null = null;
  try {
    record = normalizeExelyReservation(adaptUniBooking(b), { roomMap, typeMap });
  } catch (e) {
    normalizeErrors.push(`${b.number}: ${(e as Error).message.slice(0, 160)}`);
  }
  const channel = b.sourceChannelName?.trim() || b.source?.value?.trim() || '—';
  for (const s of b.roomStays) {
    const cancelled = s.bookingStatus === 'Cancelled' || s.status === 'Cancelled';
    stays.push({
      booking: b,
      raw: s,
      item: record?.items.find((i) => i.exelyRoomStayId === s.id) ?? null,
      record,
      cancelled,
      channel,
    });
  }
}
const rawIn = (s: StayRow) => s.raw.checkInDateTime.slice(0, 10);
const rawOut = (s: StayRow) => s.raw.checkOutDateTime.slice(0, 10);
const periodStays = stays.filter((s) => touches(rawIn(s), rawOut(s)));
const activePeriod = periodStays.filter((s) => !s.cancelled);

// §1 брони и проживания
const bookingsActive = new Set(activePeriod.map((s) => s.booking.number));
const bookingsCancelled = new Set(
  periodStays.filter((s) => s.cancelled && !bookingsActive.has(s.booking.number)).map((s) => s.booking.number),
);
const byStatus = new Map<string, number>();
for (const s of periodStays) inc(byStatus, s.cancelled ? 'Cancelled' : s.raw.status);
const nightsByType = new Map<string, { past: number; future: number; stays: number }>();
for (const s of activePeriod) {
  const arr = s.item?.arrivalDate ?? rawIn(s);
  const dep = s.item?.departureDate ?? rawOut(s);
  const code = s.raw.roomTypeId;
  const row = nightsByType.get(code) ?? { past: 0, future: 0, stays: 0 };
  row.stays += 1;
  for (let d = arr > FROM ? arr : FROM; d < dep && d < TO_EXCL; d = plus(d, 1)) {
    if (d < almatyToday) row.past += 1;
    else row.future += 1;
  }
  nightsByType.set(code, row);
}

// §2 деньги
const kind1 = existsSync(resolve(DIR, 'analytics-services-kind1.json'))
  ? load<exely.UniAnalyticsServices>('analytics-services-kind1.json')
  : null;
const cancelledKind1 = existsSync(resolve(DIR, 'analytics-services-cancelled-kind1.json'))
  ? load<exely.UniAnalyticsServices>('analytics-services-cancelled-kind1.json')
  : null;
const kind2 = existsSync(resolve(DIR, 'analytics-services-kind2.json'))
  ? load<exely.UniAnalyticsServices>('analytics-services-kind2.json')
  : null;
const channelByBooking = new Map(cards.map((b) => [b.number, b.sourceChannelName?.trim() || b.source?.value?.trim() || '—']));
const SERVICE_KIND: Record<number, string> = {
  0: 'Проживание',
  1: 'Доп. услуга',
  2: 'Трансфер',
  3: 'Ранний заезд',
  4: 'Поздний выезд',
};
const serviceRows = new Map<string, { n: number; qty: number; sum: bigint; discount: bigint }>();
const revenueByChannel = new Map<string, bigint>();
const revenueByDay = new Map<string, bigint>();
let servicesNoCard = 0;
if (kind1) {
  const resById = new Map(kind1.reservations.map((r) => [r.id, r]));
  for (const s of kind1.services) {
    const label = s.kind === 0 ? SERVICE_KIND[0]! : `${SERVICE_KIND[s.kind] ?? `kind ${s.kind}`}: ${s.name}`;
    const row = serviceRows.get(label) ?? { n: 0, qty: 0, sum: 0n, discount: 0n };
    const minor = toMinorUnits(s.amount, `начисление ${s.id}`);
    row.n += 1;
    row.qty += s.quantity ?? 0;
    row.sum += minor;
    row.discount += toMinorUnits(s.discount ?? 0, `скидка ${s.id}`);
    serviceRows.set(label, row);
    const day = `${s.date.slice(0, 4)}-${s.date.slice(4, 6)}-${s.date.slice(6, 8)}`;
    add(revenueByDay, day, minor);
    const bn = resById.get(s.reservationId)?.bookingNumber;
    const ch = bn ? channelByBooking.get(bn) : undefined;
    if (!ch) servicesNoCard += 1;
    add(revenueByChannel, ch ?? 'нет карточки в выгрузке', minor);
  }
}
let cardPrice = 0n,
  cardPaid = 0n;
for (const s of activePeriod) {
  if (!s.item) continue;
  cardPrice += s.item.priceMinor;
  cardPaid += s.item.paidMinor;
}

// §1 каналы
const channels = new Map<string, { bookings: Set<string>; stays: number; nights: number; cancelled: Set<string> }>();
for (const s of periodStays) {
  const row = channels.get(s.channel) ?? { bookings: new Set(), stays: 0, nights: 0, cancelled: new Set() };
  if (s.cancelled) row.cancelled.add(s.booking.number);
  else {
    row.bookings.add(s.booking.number);
    row.stays += 1;
    row.nights += nightsIn(s.item?.arrivalDate ?? rawIn(s), s.item?.departureDate ?? rawOut(s));
  }
  channels.set(s.channel, row);
}

// §3 платежи
interface ExelyPayment {
  id: number | string;
  bookingNumber?: string | null;
  actionKind: number;
  amount: number;
  paymentMethod?: number | null;
  paymentSystem?: string | null;
  currency?: string | null;
  dateTime?: string | null;
  paymentDateTime?: string | null;
  cancellationDateTime?: string | null;
}
const paymentsOf = (file: string): ExelyPayment[] => {
  if (!existsSync(resolve(DIR, file))) return [];
  const r = load<{ data?: { payments?: ExelyPayment[] } }>(file);
  return r.data?.payments ?? [];
};
const payPlain = paymentsOf('analytics-payments.json');
const payAll = paymentsOf('analytics-payments-with-external.json');
const plainIds = new Set(payPlain.map((p) => String(p.id)));
const ACTION: Record<number, { ru: string; sign: 1n | -1n }> = {
  0: { ru: 'оплата', sign: 1n },
  1: { ru: 'возврат', sign: -1n },
  2: { ru: 'отмена оплаты', sign: -1n },
  3: { ru: 'отмена возврата', sign: 1n },
  4: { ru: 'предоплата', sign: 1n },
};
/**
 * Сумма операции со знаком движения денег. Выгрузка 13.09.2026: суммы всегда положительные, направление — в actionKind;
 * один платёж по нескольким счетам приходит несколькими строками с одним id (часть на каждый счёт) — строки складываются.
 */
const signed = (p: ExelyPayment) => {
  const minor = toMinorUnits(p.amount, `платёж ${p.id}`);
  const abs = minor < 0n ? -minor : minor;
  return (ACTION[p.actionKind]?.sign ?? 1n) * abs;
};
// Отмена оплаты в этой выдаче — не отдельная строка actionKind=2, а отметка cancellationDateTime на самой операции:
// такие деньги не двигались, в движение не идут (показываются отдельно).
const payLive = payAll.filter((p) => !p.cancellationDateTime);
const payVoided = payAll.filter((p) => p.cancellationDateTime);
const payByAction = new Map<number, { n: number; sum: bigint; voidedN: number; voidedSum: bigint }>();
const payBySystem = new Map<string, { n: number; net: bigint; in: bigint; out: bigint }>();
const payByDay = new Map<string, { n: number; net: bigint }>();
let payNet = 0n;
const payBookingsNoCard = new Set<string>();
const cardNumbers = new Set(cards.map((b) => b.number));
for (const p of payAll) {
  const row = payByAction.get(p.actionKind) ?? { n: 0, sum: 0n, voidedN: 0, voidedSum: 0n };
  row.n += 1;
  row.sum += toMinorUnits(p.amount, `платёж ${p.id}`);
  if (p.cancellationDateTime) {
    row.voidedN += 1;
    row.voidedSum += toMinorUnits(p.amount, `платёж ${p.id}`);
  }
  payByAction.set(p.actionKind, row);
}
for (const p of payLive) {
  const v = signed(p);
  payNet += v;
  const sys = (p.paymentSystem ?? '').trim() || '—';
  const sr = payBySystem.get(sys) ?? { n: 0, net: 0n, in: 0n, out: 0n };
  sr.n += 1;
  sr.net += v;
  if (v >= 0n) sr.in += v;
  else sr.out += v;
  payBySystem.set(sys, sr);
  const dt = (p.paymentDateTime || p.dateTime || '').slice(0, 8);
  const day = dt ? `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}` : '—';
  const dr = payByDay.get(day) ?? { n: 0, net: 0n };
  dr.n += 1;
  dr.net += v;
  payByDay.set(day, dr);
  if (p.bookingNumber && !cardNumbers.has(p.bookingNumber)) payBookingsNoCard.add(p.bookingNumber);
}
const extOnly = payAll.filter((p) => !plainIds.has(String(p.id)));
const extNet = extOnly.filter((p) => !p.cancellationDateTime).reduce((a, p) => a + signed(p), 0n);

// Журнал платежей против «оплачено» в карточках. Честно проверяемы только брони, созданные в периоде:
// все их оплаты позже создания, значит, целиком внутри окна журнала. Брони с отменёнными проживаниями не берутся.
const createdInPeriod = new Set((kind2?.reservations ?? []).map((r) => r.bookingNumber));
const journalByBooking = new Map<string, bigint>();
for (const p of payLive) if (p.bookingNumber) add(journalByBooking, p.bookingNumber, signed(p));
const payCheck = { checked: 0, matched: 0, mismatch: [] as string[] };
for (const b of cards) {
  if (!createdInPeriod.has(b.number)) continue;
  if (b.roomStays.some((s) => s.bookingStatus === 'Cancelled' || s.status === 'Cancelled')) continue;
  const where = `бронь ${b.number}`;
  const card = b.roomStays.reduce(
    (a, s) =>
      a +
      toMinorUnits(s.totalPrice?.amount ?? 0, where) -
      toMinorUnits(s.totalPrice?.toPayAmount ?? 0, where) +
      toMinorUnits(s.totalPrice?.toRefundAmount ?? 0, where),
    0n,
  );
  const journal = journalByBooking.get(b.number) ?? 0n;
  payCheck.checked += 1;
  if (card === journal) payCheck.matched += 1;
  else payCheck.mismatch.push(`${b.number}: журнал ${money(journal)}, карточка ${money(card)}`);
}

// Статусы Exely против дат: выезд не отмечен, незаезд не отмечен
const hygiene = { checkedInPast: 0, newPast: 0, newStarted: 0, earlyDeparture: 0 };
for (const s of activePeriod) {
  const ci = rawIn(s),
    co = rawOut(s);
  if (s.raw.status === 'CheckedIn' && co < almatyToday) hygiene.checkedInPast += 1;
  if (s.raw.status === 'New' && co <= almatyToday) hygiene.newPast += 1;
  if (s.raw.status === 'New' && ci < almatyToday && co > almatyToday) hygiene.newStarted += 1;
  if (s.item && s.item.departureDate < co) hygiene.earlyDeparture += 1;
}

// ── §4 PMS ──
const db = createPrismaClient();
interface Diff {
  number: string;
  stay: string;
  what: string;
}
const diffs: Diff[] = [];
const counters = {
  expected: 0,
  missing: 0,
  status: 0,
  dates: 0,
  category: 0,
  price: 0,
  paid: 0,
  paidKeptInPms: 0,
  unit: 0,
};
const days = new Map<string, { exA: number; exD: number; exO: number; pmA: number; pmD: number; pmO: number }>();
for (const d of DAYS) days.set(d, { exA: 0, exD: 0, exO: 0, pmA: 0, pmD: 0, pmO: 0 });
const pmsNightsByType = new Map<string, number>();
const staleInPms: string[] = [];
let pmsE2E = 0,
  pmsNotFromExely = 0;
try {
  const property = await db.property.findFirstOrThrow({
    where: { name: LUXX_APARTS_PROPERTY.name },
    select: { id: true },
  });
  const expected = stays.filter((s) => s.item);
  counters.expected = expected.length;
  const ids = expected.map((s) => s.item!.exelyRoomStayId);
  const items = await db.reservationItem.findMany({
    where: { exelyRoomStayId: { in: ids } },
    select: {
      exelyRoomStayId: true,
      status: true,
      arrivalDate: true,
      departureDate: true,
      price: true,
      accommodationType: { select: { code: true } },
      allocations: { select: { inventoryUnit: { select: { exelyRoomNumber: true } } } },
    },
  });
  const pmsById = new Map(items.map((it) => [it.exelyRoomStayId!, it]));
  const pays = await db.payment.findMany({
    where: { propertyId: property.id, externalReference: { in: ids.map((id) => `exely:${id}`) } },
    select: { externalReference: true, amount: true, status: true },
  });
  const payById = new Map(pays.map((p) => [p.externalReference!.slice('exely:'.length), p]));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  for (const s of expected) {
    const e = s.item!;
    const where = { number: s.booking.number, stay: e.exelyRoomStayId };
    const it = pmsById.get(e.exelyRoomStayId);
    if (!it) {
      counters.missing += 1;
      diffs.push({ ...where, what: `нет в PMS (${e.arrivalDate} → ${e.departureDate}, ${e.status})` });
      continue;
    }
    if (it.status !== e.status) {
      counters.status += 1;
      diffs.push({ ...where, what: `статус PMS ${it.status}, Exely ${e.status}` });
    }
    if (iso(it.arrivalDate) !== e.arrivalDate || iso(it.departureDate) !== e.departureDate) {
      counters.dates += 1;
      diffs.push({
        ...where,
        what: `даты PMS ${iso(it.arrivalDate)} → ${iso(it.departureDate)}, Exely ${e.arrivalDate} → ${e.departureDate}`,
      });
    }
    if (it.accommodationType.code !== e.accommodationTypeCode) {
      counters.category += 1;
      diffs.push({
        ...where,
        what: `категория PMS ${typeName(it.accommodationType.code)}, Exely ${typeName(e.accommodationTypeCode)}`,
      });
    }
    if (it.price !== e.priceMinor) {
      counters.price += 1;
      diffs.push({ ...where, what: `цена PMS ${money(it.price)}, Exely ${money(e.priceMinor)}` });
    }
    const p = payById.get(e.exelyRoomStayId);
    const pmsPaid = p && p.status === 'COMPLETED' ? p.amount : 0n;
    if (e.paidMinor > 0n ? pmsPaid !== e.paidMinor : pmsPaid !== 0n) {
      if (e.paidMinor <= 0n) counters.paidKeptInPms += 1;
      else counters.paid += 1;
      diffs.push({ ...where, what: `оплачено PMS ${money(pmsPaid)}, Exely ${money(e.paidMinor)}` });
    }
    const holds = e.status !== 'CANCELLED' && e.status !== 'NO_SHOW';
    const unit = it.allocations[0]?.inventoryUnit.exelyRoomNumber ?? null;
    if (holds && e.exelyRoomNumber && unit !== e.exelyRoomNumber) counters.unit += 1;
  }

  // сутки периода: Exely — по карточкам без отменённых, в датах импорта (ранний выезд — фактической датой),
  // иначе ранний выезд показывался бы расхождением, которого в зеркале нет
  for (const s of stays) {
    if (s.cancelled) continue;
    const ci = s.item?.arrivalDate ?? rawIn(s),
      co = s.item?.departureDate ?? rawOut(s);
    for (const d of DAYS) {
      const row = days.get(d)!;
      if (ci === d) row.exA += 1;
      if (co === d) row.exD += 1;
      if (ci <= d && d < co) row.exO += 1;
    }
  }
  // PMS — все проживания объекта, кроме отменённых, незаездов и автотестов (как cli-double-entry.ts)
  const dumpIds = new Set(ids);
  const pmsItems = await db.reservationItem.findMany({
    where: {
      reservation: { propertyId: property.id },
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      arrivalDate: { lte: new Date(`${TO}T00:00:00Z`) },
      departureDate: { gte: new Date(`${FROM}T00:00:00Z`) },
    },
    select: {
      exelyRoomStayId: true,
      arrivalDate: true,
      departureDate: true,
      accommodationType: { select: { code: true } },
      reservation: { select: { confirmationNumber: true, notes: true } },
    },
  });
  for (const it of pmsItems) {
    if (it.reservation.notes === E2E_NOTE) {
      pmsE2E += 1;
      continue;
    }
    const ci = iso(it.arrivalDate),
      co = iso(it.departureDate);
    if (!it.exelyRoomStayId) pmsNotFromExely += 1;
    else if (!dumpIds.has(it.exelyRoomStayId))
      staleInPms.push(
        `${it.reservation.confirmationNumber} · ${it.exelyRoomStayId} (${ci} → ${co}; ${
          cardNumbers.has(it.reservation.confirmationNumber)
            ? 'бронь в Exely есть, этого проживания в ней уже нет'
            : 'брони нет в выгрузке'
        })`,
      );
    for (const d of DAYS) {
      const row = days.get(d)!;
      if (ci === d) row.pmA += 1;
      if (co === d) row.pmD += 1;
      if (ci <= d && d < co) row.pmO += 1;
    }
    inc(pmsNightsByType, it.accommodationType.code.replace(/^exely-/, ''), nightsIn(ci, co));
  }
} finally {
  await db.$disconnect();
}

const dayDiffs = DAYS.filter((d) => {
  const r = days.get(d)!;
  return r.exA !== r.pmA || r.exD !== r.pmD || r.exO !== r.pmO;
});
const itemDiffs =
  counters.missing +
  counters.status +
  counters.dates +
  counters.category +
  counters.price +
  counters.paid +
  counters.paidKeptInPms;
const ok = itemDiffs === 0 && dayDiffs.length === 0 && staleInPms.length === 0 && normalizeErrors.length === 0;

// ── отчёт ──
const OUT = resolve(ROOT, `reports/exely-period-${FROM}_${TO}.md`);
const HISTORY_START = '<!-- history:start -->';
const HISTORY_END = '<!-- history:end -->';
const prevRows = existsSync(OUT)
  ? (readFileSync(OUT, 'utf-8').split(HISTORY_START)[1]?.split(HISTORY_END)[0] ?? '')
      .split('\n')
      .filter((l) => l.startsWith('| ') && !l.startsWith('| Когда') && !l.startsWith('|---'))
  : [];
const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
const historyRow = `| ${stamp} UTC | ${DIR_NAME} | ${counters.expected} | ${counters.missing} | ${counters.status} | ${counters.dates} | ${counters.price} | ${counters.paid} | ${counters.paidKeptInPms} | ${dayDiffs.length} из ${DAYS.length} | ${staleInPms.length} | ${ok ? 'сходится' : 'расходится'} |`;

const typeRows = Object.keys(TYPE_NAME).map((code) => {
  const r = nightsByType.get(code) ?? { past: 0, future: 0, stays: 0 };
  const pms = pmsNightsByType.get(code) ?? 0;
  const ex = r.past + r.future;
  return `| ${TYPE_NAME[code]} | ${r.stays} | ${r.past} | ${r.future} | ${ex} | ${pms} | ${pms - ex} |`;
});
const sortedServices = [...serviceRows.entries()].sort((a, b) => (b[1].sum > a[1].sum ? 1 : -1));
const servicesTotal = sortedServices.reduce((a, [, r]) => a + r.sum, 0n);
const cancelledSum = (cancelledKind1?.services ?? []).reduce((a, s) => a + toMinorUnits(s.amount, s.id), 0n);
const createdBookings = new Set((kind2?.reservations ?? []).map((r) => r.bookingNumber));

const md = [
  `# Exely за ${ddmm(FROM)}–${ddmm(TO)}.${FROM.slice(0, 4)}: брони, деньги, платежи и сверка с PMS`,
  '',
  `Выгрузка \`${DIR_NAME}\` (Универсальный API Exely, только чтение), закончена ${manifest.finishedAt?.slice(0, 16).replace('T', ' ') ?? '—'} UTC.`,
  `Сырьё с ПД — \`project-input/exely/api/${DIR_NAME}/\` (вне git). В отчёте только числа и номера броней.`,
  `Отчёт собран ${stamp} UTC, сегодня по часам объекта ${ddmm(almatyToday)}: ночи до этой даты — прошедшие.`,
  '',
  '## 1. Брони и проживания периода',
  '',
  `Карточек в выгрузке: **${cards.length}** (брони, затрагивающие период, и все изменённые с ${ddmm(plus(FROM, -1))}; не получено: ${manifest.cards?.failed ?? 0}).`,
  `Затрагивают период: активных броней **${bookingsActive.size}**, полностью отменённых **${bookingsCancelled.size}**; проживаний **${periodStays.length}**, из них активных **${activePeriod.length}**.`,
  kind2 ? `Создано в периоде (начисления «по созданию», без отменённых): **${createdBookings.size}** броней.` : '',
  '',
  '| Статус проживания | Проживаний |',
  '|---|---:|',
  ...[...byStatus.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${STATUS_RU[k] ?? k} | ${v} |`),
  '',
  `Статусы Exely против дат (активные проживания периода на ${ddmm(almatyToday)}): выезд прошёл, а статус «проживает» — **${hygiene.checkedInPast}**;`,
  `выезд прошёл или сегодня, а статус «новое» (незаезд не отмечен) — **${hygiene.newPast}**; заезд прошёл, выезд впереди, а не заселён — **${hygiene.newStarted}**;`,
  `ранний выезд (фактический раньше планового) — ${hygiene.earlyDeparture}. Импорт переносит статусы как есть, даты раннего выезда — фактические.`,
  '',
  '### Ночи по категориям (активные проживания, в пределах периода)',
  '',
  '| Категория | Проживаний | Ночей прошло | Ночей впереди | Всего Exely | PMS | diff |',
  '|---|---:|---:|---:|---:|---:|---:|',
  ...typeRows,
  '',
  '### По каналам',
  '',
  '| Канал / источник | Броней | Проживаний | Ночей в периоде | Начислено за ночи периода | Отменённых броней |',
  '|---|---:|---:|---:|---:|---:|',
  ...[...channels.entries()]
    .sort((a, b) => b[1].nights - a[1].nights)
    .map(
      ([ch, r]) =>
        `| ${ch} | ${r.bookings.size} | ${r.stays} | ${r.nights} | ${money(revenueByChannel.get(ch) ?? 0n)} | ${r.cancelled.size} |`,
    ),
  '',
  '## 2. Деньги по проживаниям',
  '',
  kind1
    ? `Начисления по дням пребывания ${ddmm(FROM)}–${ddmm(TO)} (Exely «по пребыванию»): **${money(servicesTotal)}**, строк ${kind1.services.length}.`
    : 'Начисления по дням пребывания не выгружены.',
  '',
  '| Начисление | Строк | Количество | Сумма | Скидка |',
  '|---|---:|---:|---:|---:|',
  ...sortedServices.map(([k, r]) => `| ${k} | ${r.n} | ${r.qty} | ${money(r.sum)} | ${money(r.discount)} |`),
  '',
  cancelledKind1
    ? `Отменённые брони (начисления, которые были бы в периоде): строк ${cancelledKind1.services.length} на ${money(cancelledSum)}.`
    : '',
  servicesNoCard ? `Начислений по броням без карточки в выгрузке: ${servicesNoCard}.` : '',
  '',
  `По карточкам активных проживаний периода (полная стоимость проживания, в том числе ночи вне периода): стоимость **${money(cardPrice)}**, оплачено **${money(cardPaid)}**, к оплате **${money(cardPrice - cardPaid)}**.`,
  '',
  '## 3. Платежи',
  '',
  manifest.payments?.end
    ? `Журнал платежей Exely ${manifest.payments.start} – ${manifest.payments.end} (yyyyMMddHHmm, часы объекта): **${payAll.length}** строк по ${new Set(payAll.map((p) => String(p.id))).size} платежам, ${new Set(payAll.map((p) => p.bookingNumber)).size} броням; движение денег **${money(payNet)}**.`
    : 'Журнал платежей не выгружен.',
  `Отменённые операции (отметка отмены, деньги не двигались, в движение не входят): ${payVoided.length} строк на ${money(payVoided.reduce((a, p) => a + toMinorUnits(p.amount, String(p.id)), 0n))}.`,
  `Внешние предоплаты (есть только с флагом \`includeExternalPayments\`): ${extOnly.length} строк на ${money(extNet)}. Платежи из депозита API не отдаёт.`,
  payBookingsNoCard.size
    ? `Платежи по броням без карточки в выгрузке (проживание вне периода, оплачено в периоде): ${payBookingsNoCard.size} броней.`
    : '',
  '',
  '| Тип операции | Строк | Сумма | из них отменено: строк | сумма |',
  '|---|---:|---:|---:|---:|',
  ...[...payByAction.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(
      ([k, r]) =>
        `| ${ACTION[k]?.ru ?? `actionKind ${k}`} | ${r.n} | ${money(r.sum)} | ${r.voidedN} | ${money(r.voidedSum)} |`,
    ),
  '',
  '| Способ оплаты | Строк | Приход | Возвраты | Итого |',
  '|---|---:|---:|---:|---:|',
  ...[...payBySystem.entries()]
    .sort((a, b) => (b[1].net > a[1].net ? 1 : -1))
    .map(([k, r]) => `| ${k} | ${r.n} | ${money(r.in)} | ${money(r.out)} | ${money(r.net)} |`),
  `| **Итого** | **${payLive.length}** | | | **${money(payNet)}** |`,
  '',
  `Журнал против «оплачено» в карточках (брони, созданные в периоде, без отмен — все их оплаты внутри окна): проверено **${payCheck.checked}**, сходится **${payCheck.matched}**.`,
  payCheck.mismatch.length
    ? `\n<details><summary>Не сходится (${payCheck.mismatch.length})</summary>\n\n${payCheck.mismatch
        .slice(0, 40)
        .map((m) => `- ${m}`)
        .join('\n')}\n\n</details>`
    : '',
  '',
  '<details><summary>Платежи и начисления по дням</summary>',
  '',
  '| День | Платежей | Движение денег | Начислено за ночь (по пребыванию) |',
  '|---|---:|---:|---:|',
  ...DAYS.map((d) => {
    const p = payByDay.get(d);
    return `| ${ddmm(d)} | ${p?.n ?? 0} | ${money(p?.net ?? 0n)} | ${money(revenueByDay.get(d) ?? 0n)} |`;
  }),
  '',
  '</details>',
  '',
  '## 4. PMS против Exely',
  '',
  'Каждое проживание выгрузки прогнано через тот же нормализатор, что и импорт (`normalizeExelyReservation`): ожидание —',
  'ровно то, что импорт записал бы в PMS (статус, даты с ранним выездом, категория, цена, оплачено = сумма − к оплате).',
  'Сравнение идёт со снимком: PMS и после него получает изменения из Exely (автосинхронизация, ADR-032), поэтому',
  'расхождение по брони, изменённой в Exely позже снимка, значит «PMS новее снимка» — проверять по живой карточке.',
  '',
  '| Проверка | Проживаний |',
  '|---|---:|',
  `| проживаний в выгрузке | ${counters.expected} |`,
  `| нет в PMS | ${counters.missing} |`,
  `| статус отличается | ${counters.status} |`,
  `| даты отличаются | ${counters.dates} |`,
  `| категория отличается | ${counters.category} |`,
  `| цена отличается | ${counters.price} |`,
  `| оплачено отличается | ${counters.paid} |`,
  `| в Exely оплата обнулилась, в PMS платёж остался | ${counters.paidKeptInPms} |`,
  `| ячейка не та, что в Exely (справочно: импорт пересаживает при конфликте) | ${counters.unit} |`,
  `| активны в PMS в периоде, но в выгрузке Exely их нет | ${staleInPms.length} |`,
  '',
  `В PMS в периоде ещё ${pmsNotFromExely} проживаний не из Exely и ${pmsE2E} автотестов (исключены, как в двойном вводе).`,
  normalizeErrors.length
    ? `\n**Карточки, которые импорт не примет (${normalizeErrors.length}):**\n\n${normalizeErrors.map((m) => `- ${m}`).join('\n')}`
    : '',
  staleInPms.length ? `\n**Есть в PMS, нет в Exely:** ${staleInPms.slice(0, 40).join('; ')}` : '',
  diffs.length
    ? `\n<details><summary>Расхождения поимённо (${diffs.length}, первые 60)</summary>\n\n${diffs
        .slice(0, 60)
        .map((d) => `- ${d.number} · ${d.stay}: ${d.what}`)
        .join('\n')}\n\n</details>`
    : '',
  '',
  '### Сутки периода: заезды / выезды / занято',
  '',
  '| День | Заезды PMS | Exely | Выезды PMS | Exely | Занято PMS | Exely | |',
  '|---|---:|---:|---:|---:|---:|---:|---|',
  ...DAYS.map((d) => {
    const r = days.get(d)!;
    const same = r.exA === r.pmA && r.exD === r.pmD && r.exO === r.pmO;
    return `| ${ddmm(d)} | ${r.pmA} | ${r.exA} | ${r.pmD} | ${r.exD} | ${r.pmO} | ${r.exO} | ${same ? '✅' : '❌'} |`;
  }),
  '',
  ok
    ? '**Сходится в ноль:** все проживания периода есть в PMS с теми же статусом, датами, категорией, ценой и оплатой, все сутки совпадают.'
    : `**Расходится:** проживаний с расхождением ${itemDiffs}, суток ${dayDiffs.length} из ${DAYS.length}${staleInPms.length ? `, лишних в PMS ${staleInPms.length}` : ''}.`,
  '',
  '## История сверки',
  '',
  HISTORY_START,
  '| Когда | Выгрузка | Проживаний | Нет в PMS | Статус | Даты | Цена | Оплата | Оплата осталась в PMS | Сутки с расхождением | Лишние в PMS | Итог |',
  '|---|---|---:|---:|---:|---:|---:|---:|---:|---|---:|---|',
  ...prevRows,
  historyRow,
  HISTORY_END,
  '',
]
  .filter((l, i, a) => !(l === '' && a[i - 1] === ''))
  .join('\n');

mkdirSync(resolve(ROOT, 'reports'), { recursive: true });
writeFileSync(OUT, md);
console.log(md);
console.log(`→ ${OUT.replace(`${ROOT}/`, '')}`);
process.exitCode = ok ? 0 : 1;
