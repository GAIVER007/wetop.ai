/**
 * Отчёт переезда по одному каналу (CUTOVER.md «Чеклист канала»; Q-034, Q-086). Перед включением канала
 * в Channex и после него: что перенесено, всё ли с ячейкой, сходится ли число будущих броней с живым Exely,
 * у скольких есть номер брони канала (external_id), проставлена ли предоплата площадки (платёж EXTERNAL).
 * Exely — ТОЛЬКО ЧТЕНИЕ (Универсальный API, EXELY_API_KEY). Без ПД: номера броней, даты, категории, суммы.
 * Запуск: npm run cutover:channel -- <booking|trip|expedia|agoda|hostelworld|ostrovok>
 * Пишет reports/cutover-<псевдоним>-<YYYY-MM-DD>.md.
 * Код выхода: 0 — число сходится и все проживания с ячейкой; 1 — нет; 2 — псевдоним не указан или неизвестен.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createPrismaClient } from '@pms/database';
import { exely } from '@pms/integrations';
import {
  LUXX_APARTS_PROPERTY,
  adaptUniBooking,
  normalizeExelyReservation,
  type ReservationImportRecord,
} from '@pms/imports';
import {
  CHANNELS,
  channelByAlias,
  compareNumbers,
  isChannelName,
  nightsBetween,
  readiness,
  renderCutoverReport,
  selectExelyFuture,
  summarizeStays,
  tenge,
  type CutoverStay,
} from './cutover-compare';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });

const aliasArg = process.argv[2];
const spec = aliasArg ? channelByAlias(aliasArg) : undefined;
if (!spec) {
  console.error(
    (aliasArg ? `неизвестный псевдоним «${aliasArg}». ` : 'укажите псевдоним канала. ') +
      'Доступны:\n' +
      CHANNELS.map(
        (c) =>
          `  ${c.alias.padEnd(12)} Exely «${c.exelyName}», Channex «${c.channexOtaName}», подтяжка старых броней: ${c.pullsHistory ? 'да' : 'нет'}`,
      ).join('\n'),
  );
  process.exit(2);
}
const key = process.env.EXELY_API_KEY;
if (!key) throw new Error('EXELY_API_KEY пуст');

const almatyToday = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
const TODAY = almatyToday;
const asDate = (d: string) => new Date(`${d}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const plus = (d: string, n: number) => {
  const x = asDate(d);
  x.setUTCDate(x.getUTCDate() + n);
  return iso(x);
};
/** Метка автотестов: такие брони есть только в PMS и в сверку с Exely не идут */
const E2E_NOTE = 'E2E-АВТОТЕСТ';

// ── PMS: живые будущие проживания канала ──
const db = createPrismaClient();
const stays: CutoverStay[] = [];
/** Имена каналов у будущих броней в БД — подсказка, если по псевдониму ничего не нашлось */
const channelsSeen = new Map<string, number>();
let e2eSkipped = 0;
try {
  const property = await db.property.findFirstOrThrow({
    where: { name: LUXX_APARTS_PROPERTY.name },
    select: { id: true },
  });
  const items = await db.reservationItem.findMany({
    where: {
      reservation: {
        propertyId: property.id,
        status: { not: 'CANCELLED' },
        channel: { not: null },
      },
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      departureDate: { gt: asDate(TODAY) },
    },
    select: {
      arrivalDate: true,
      departureDate: true,
      price: true,
      accommodationType: { select: { code: true } },
      allocations: {
        select: { startDate: true, endDate: true, inventoryUnit: { select: { code: true } } },
        orderBy: { startDate: 'asc' },
      },
      folio: {
        select: {
          charges: { select: { amount: true, voidedAt: true } },
          allocations: {
            select: { amount: true, payment: { select: { method: true, status: true } } },
          },
          refunds: { select: { amount: true } },
        },
      },
      reservation: {
        select: { confirmationNumber: true, channel: true, externalId: true, notes: true },
      },
    },
  });
  for (const it of items) {
    const ch = it.reservation.channel ?? '';
    channelsSeen.set(ch, (channelsSeen.get(ch) ?? 0) + 1);
    if (!isChannelName(ch, spec)) continue;
    if (it.reservation.notes?.includes(E2E_NOTE)) {
      e2eSkipped += 1;
      continue;
    }
    const arrival = iso(it.arrivalDate);
    const departure = iso(it.departureDate);
    const nights = nightsBetween(arrival, departure);
    // Покрытие ночей назначениями: ячейка «на все ночи» — иначе на шахматке дыра
    let covered = 0;
    const codes: string[] = [];
    for (const a of it.allocations) {
      const from = iso(a.startDate) > arrival ? iso(a.startDate) : arrival;
      const to = iso(a.endDate) < departure ? iso(a.endDate) : departure;
      if (to > from) covered += nightsBetween(from, to);
      if (!codes.includes(a.inventoryUnit.code)) codes.push(a.inventoryUnit.code);
    }
    const f = it.folio;
    const charged = f?.charges.filter((c) => !c.voidedAt).reduce((x, c) => x + c.amount, 0n) ?? 0n;
    const paid =
      f?.allocations
        .filter((a) => a.payment.status === 'COMPLETED')
        .reduce((x, a) => x + a.amount, 0n) ?? 0n;
    const refunded = f?.refunds.reduce((x, r) => x + r.amount, 0n) ?? 0n;
    const hasPrepayment =
      f?.allocations.some(
        (a) => a.payment.method === 'EXTERNAL' && a.payment.status === 'COMPLETED' && a.amount > 0n,
      ) ?? false;
    stays.push({
      number: it.reservation.confirmationNumber,
      arrival,
      departure,
      category: it.accommodationType.code,
      unit: codes.length ? codes.join('/') : null,
      unitCovered: codes.length > 0 && covered === nights,
      hasExternalId: !!it.reservation.externalId,
      hasPrepayment,
      priceMinor: it.price,
      dueMinor: charged - paid + refunded,
    });
  }
} finally {
  await db.$disconnect();
}
console.log(
  `PMS: живых будущих проживаний канала ${spec.alias}: ${stays.length}` +
    (e2eSkipped ? ` (исключено автотестов: ${e2eSkipped})` : ''),
);
if (!stays.length)
  console.log(
    '  имена каналов у будущих броней в БД: ' +
      [...channelsSeen.entries()].map(([n, c]) => `«${n}» ${c}`).join(', '),
  );

// ── Exely живьём: будущие брони канала (только GET) ──
const client = new exely.ExelyUniversalClient({ apiKey: key });
// окно ≤365 дней (docs/exely/universal-pms-api-1.5.0.md, «Поиск бронирований»); дальше года броней нет
const numbers = await client.searchBookings({
  state: 'Active',
  affectsPeriodFrom: `${TODAY}T00:00`,
  affectsPeriodTo: `${plus(TODAY, 364)}T00:00`,
});
console.log(`Exely: активных броней с проживанием в ближайшие 364 дня: ${numbers.length}`);
const rooms = await client.rooms();
const roomMap = new Map(rooms.map((r) => [r.id, r.name]));
const typeMap = new Map(rooms.map((r) => [r.roomTypeId, `exely-${r.roomTypeId}`]));
const records: ReservationImportRecord[] = [];
const unparsed: string[] = [];
for (const [i, n] of numbers.entries()) {
  try {
    const card = await client.booking(n);
    records.push(normalizeExelyReservation(adaptUniBooking(card), { roomMap, typeMap }));
  } catch (e) {
    unparsed.push(n);
    console.log(`  карточка ${n} не разобрана: ${(e as Error).message}`);
  }
  if ((i + 1) % 50 === 0) console.log(`  карточек получено ${i + 1}/${numbers.length}`);
}
const exelySide = selectExelyFuture(records, spec, TODAY);

// ── Отчёт ──
const takenAt = `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`;
const md = renderCutoverReport({
  channel: spec,
  today: TODAY,
  takenAt,
  stays,
  exely: exelySide,
  unparsedExely: unparsed,
});
mkdirSync(resolve(ROOT, 'reports'), { recursive: true });
const out = resolve(ROOT, `reports/cutover-${spec.alias}-${TODAY}.md`);
writeFileSync(out, md);

const t = summarizeStays(stays);
const cmp = compareNumbers(
  stays.map((s) => s.number),
  exelySide.numbers,
);
const r = readiness(t, cmp);
console.log(
  [
    '',
    `Канал ${spec.alias} (Exely «${spec.exelyName}», Channex «${spec.channexOtaName}»), подтяжка старых броней: ${spec.pullsHistory ? 'да' : 'нет'}`,
    `Броней: PMS ${t.reservations} / Exely ${new Set(exelySide.numbers).size} · проживаний ${t.stays} / ${exelySide.stays} · ночей ${t.nights} / ${exelySide.nights} · сумма ${tenge(t.amountMinor)} / ${tenge(exelySide.amountMinor)} ₸`,
    `Общих номеров ${cmp.common.length}, только в Exely ${cmp.onlyExely.length}, только в PMS ${cmp.onlyPms.length}` +
      (cmp.bornOutsideExely.length ? `, рождены не в Exely ${cmp.bornOutsideExely.length}` : '') +
      (unparsed.length ? `, не разобрано карточек Exely ${unparsed.length}` : ''),
    `С ячейкой ${t.withUnit} / без ${t.withoutUnit} · с номером канала ${t.withExternalId} / без ${t.withoutExternalId} · с предоплатой ${t.withPrepayment} / без ${t.withoutPrepayment}`,
    `Готовность: число сходится — ${r.countMatches ? 'да' : 'нет'}; состав совпадает — ${r.setsMatch ? 'да' : 'нет'}; все с ячейкой — ${r.allWithUnit ? 'да' : 'нет'}; предоплата у ${r.prepaid} из ${r.prepaidOf}`,
    `RESULT: ${r.ok ? 'OK' : 'FAIL'}`,
    `→ ${out}`,
  ].join('\n'),
);
process.exitCode = r.ok ? 0 : 1;
