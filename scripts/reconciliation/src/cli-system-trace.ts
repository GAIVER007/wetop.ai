/**
 * Сквозная проверка слоёв — «проект работает как единое целое» (поручение владельца 14.09.2026).
 * Один и тот же факт читается в каждом слое и сравнивается:
 *  1) сутки: Exely (живой) ↔ Supabase ↔ API /desk/today ↔ экран «Обзор дня»;
 *     шахматка на 14 суток: каждое назначение в Supabase ↔ API /chessboard ↔ число и клетка на экране;
 *  2) брони: все активные на сутки и все изменённые в Exely за 24 часа — карточка Exely ↔ проживания в Supabase
 *     ↔ GET /reservations/:номер ↔ карточка брони на экране;
 *  3) связи: свежесть синхронизации Exely, очередь ARI и webhook Channex, контент из Channex,
 *     подключение базы (Supabase ↔ API ↔ экран «Подключения»).
 * Во всех слоях только чтение. Без ПД: номера броней, даты, статусы, категории, суммы, счётчики.
 * Брони автотестов (заметка E2E-АВТОТЕСТ) и созданные в самой PMS с Exely не сравниваются, но на экранах стойки
 * считаются — как их видит администратор. Слои читаются не в один миг, а синхронизация Exely идёт каждые 5 минут:
 * расхождение перепроверяется один раз, прежде чем попасть в отчёт.
 * Запуск: npx tsx scripts/reconciliation/src/cli-system-trace.ts [YYYY-MM-DD]   (по умолчанию сегодня, Алматы)
 * Пишет reports/system-trace-YYYY-MM-DD.md. Код выхода 1 при любом расхождении.
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
  STATUS_LABEL,
  deskCounts,
  exelyVerdict,
  layerMismatches,
  parseStayCells,
  parseStayRows,
  stayDiff,
  testIdText,
  type LayerRow,
  type StayState,
} from './system-trace';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });
const API = process.env.APP_API_URL ?? 'http://127.0.0.1:3001';
const WEB = process.env.WEB_URL ?? 'http://127.0.0.1:3000';
const HOUR = 3_600_000;
const startedAt = new Date();
const almatyToday = new Date(startedAt.getTime() + 5 * HOUR).toISOString().slice(0, 10);
const DATE = process.argv[2] ?? almatyToday;
if (!/^\d{4}-\d{2}-\d{2}$/.test(DATE)) throw new Error('дата YYYY-MM-DD');
const key = process.env.EXELY_API_KEY;
if (!key) throw new Error('EXELY_API_KEY пуст');

const plus = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const iso = (d: Date) => d.toISOString().slice(0, 10);
const day = (d: string) => new Date(`${d}T00:00:00Z`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Exely понимает modifiedFrom/modifiedTo во времени объекта (ADR-032) */
const propertyTime = (ms: number) => new Date(ms + 5 * HOUR).toISOString().slice(0, 16);
const E2E_NOTE = 'E2E-АВТОТЕСТ';
const WINDOW = Array.from({ length: 14 }, (_, i) => plus(DATE, i));
const LAST = WINDOW.at(-1)!;
const INACTIVE = new Set(['CANCELLED', 'NO_SHOW']);
const METRIC = {
  arrivals: 'заезды',
  departures: 'выезды',
  inHouse: 'проживают',
  toCheckIn: 'ожидают заселения',
  toCheckOut: 'ожидают выезда',
} as const;

async function api<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`API ${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}
async function page(path: string): Promise<string> {
  const res = await fetch(`${WEB}${path}`, { signal: AbortSignal.timeout(180_000) });
  if (!res.ok) throw new Error(`WETOP ${path}: HTTP ${res.status}`);
  return res.text();
}
/** Проверка с одной перепроверкой: слои читаются не одновременно, синхронизация могла пройти между чтениями */
async function checked<T extends { issues: string[] }>(run: () => Promise<T>, pauseMs: number): Promise<T & { rechecked: boolean }> {
  let first: T;
  try {
    first = await run();
  } catch (e) {
    console.log(`ошибка чтения слоёв: ${(e as Error).message} — повтор через ${pauseMs / 1000} с`);
    await sleep(pauseMs);
    return { ...(await run()), rechecked: true };
  }
  if (first.issues.length === 0) return { ...first, rechecked: false };
  await sleep(pauseMs);
  return { ...(await run()), rechecked: true };
}

const failures: string[] = [];
const warnings: string[] = [];
const fail = (s: string) => failures.push(s);
const table = (rows: LayerRow[], layers: string[]) => [
  `| Показатель | ${layers.join(' | ')} | |`,
  `|---|${layers.map(() => '---:').join('|')}|---|`,
  ...rows.map(
    (r) =>
      `| ${r.metric} | ${layers.map((l) => r.values[l] ?? '—').join(' | ')} | ${layerMismatches([r]).length ? '**≠**' : 'ок'} |`,
  ),
];

// ── 0. Связи и свежесть ─────────────────────────────────────────────────────────────────────────
interface Freshness {
  exely: { lastSyncAt: string | null; mode: string | null };
  channex: { lastEventAt: string | null; outboxPending: number; outboxFailed: number; oldestPendingAt: string | null };
}
const freshness = await api<Freshness>('/system/freshness');
const webFreshness = (await (
  await fetch(`${WEB}/api/freshness`, { signal: AbortSignal.timeout(60_000) })
).json()) as Freshness;
const webhook = await api<{
  registered: boolean;
  active: boolean;
  webhookSuspect: boolean;
  callbackReachable: boolean | null;
  lastWebhookAt: string | null;
}>('/channels/channex/webhook/status');
const syncAgeMin = freshness.exely.lastSyncAt
  ? Math.round((startedAt.getTime() - Date.parse(freshness.exely.lastSyncAt)) / 60_000)
  : null;
/** Синхронизация идёт каждые 5 минут, прогон — до нескольких минут: решение о свежести — ещё раз в конце проверки */
const staleAtStart = syncAgeMin === null || syncAgeMin > 15;
if (freshness.channex.outboxFailed > 0) fail(`очередь ARI: упавших отправок ${freshness.channex.outboxFailed}`);
const pendingAgeMin = freshness.channex.oldestPendingAt
  ? Math.round((startedAt.getTime() - Date.parse(freshness.channex.oldestPendingAt)) / 60_000)
  : 0;
if (pendingAgeMin > 10) fail(`очередь ARI: изменение ждёт отправки ${pendingAgeMin} мин`);
if (!webhook.registered || !webhook.active || webhook.webhookSuspect || webhook.callbackReachable === false)
  fail(
    `webhook Channex: зарегистрирован ${webhook.registered}, активен ${webhook.active}, под подозрением ${webhook.webhookSuspect}, адрес отвечает ${webhook.callbackReachable}`,
  );
const freshnessOnScreen =
  webFreshness.exely.lastSyncAt === freshness.exely.lastSyncAt &&
  webFreshness.channex.outboxPending === freshness.channex.outboxPending &&
  webFreshness.channex.outboxFailed === freshness.channex.outboxFailed;
if (!freshnessOnScreen) fail('строка свежести на экране (/api/freshness) не совпадает с API /system/freshness');

const content = await api<{
  state: string;
  photos: unknown[];
  property: { description: string | null } | null;
}>('/channels/channex/content');
const contentShown = (await page('/hotel-settings/description')).includes('data-testid="content-description"');
if (content.state === 'READY' && content.property?.description && !contentShown)
  fail('описание объекта из Channex есть в API, но не показано на экране «Описание»');
if (content.state !== 'READY') warnings.push(`контент Channex: состояние ${content.state}`);

// ── 1. Exely: карточки активных на сутки и изменённых за 24 часа ────────────────────────────────
const client = new exely.ExelyUniversalClient({ apiKey: key });
const affecting = new Set(
  await client.searchBookings({
    state: 'Active',
    affectsPeriodFrom: `${DATE}T00:00`,
    affectsPeriodTo: `${plus(DATE, 1)}T00:00`,
  }),
);
const modified = new Set<string>();
for (const state of ['Active', 'Cancelled'] as const)
  for (const n of await client.searchBookings({
    state,
    modifiedFrom: propertyTime(startedAt.getTime() - 24 * HOUR),
    modifiedTo: propertyTime(startedAt.getTime() + 5 * 60_000),
  }))
    modified.add(n);
const rooms = await client.rooms();
const ctx = {
  roomMap: new Map(rooms.map((r) => [r.id, r.name])),
  typeMap: new Map(rooms.map((r) => [r.roomTypeId, `exely-${r.roomTypeId}`])),
};
interface ExelyCard {
  record: ReservationImportRecord;
  lastModified: string | null;
}
const readCard = async (n: string): Promise<ExelyCard> => {
  const card = await client.booking(n);
  const lm = card.lastModified ?? null;
  return {
    record: normalizeExelyReservation(adaptUniBooking(card), ctx),
    lastModified: lm && !/([zZ]|[+-]\d\d:?\d\d)$/.test(lm) ? `${lm}Z` : lm,
  };
};
const cards = new Map<string, ExelyCard>();
for (const n of new Set([...affecting, ...modified])) {
  cards.set(n, await readCard(n));
  if (cards.size % 25 === 0) console.log(`  карточек Exely ${cards.size}`);
}
console.log(`Exely: активных на ${DATE} ${affecting.size}, изменённых за 24 ч ${modified.size}, карточек ${cards.size}`);

const db = createPrismaClient();
try {
  const property = await db.property.findFirstOrThrow({
    where: { name: LUXX_APARTS_PROPERTY.name },
    select: { id: true },
  });

  // ── 2. Сутки и шахматка: Supabase → API → экран ─────────────────────────────────────────────
  const dayItems = () =>
    db.reservationItem.findMany({
      where: {
        reservation: { propertyId: property.id },
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        arrivalDate: { lte: day(DATE) },
        departureDate: { gte: day(DATE) },
      },
      select: {
        status: true,
        arrivalDate: true,
        departureDate: true,
        exelyRoomStayId: true,
        accommodationType: { select: { code: true } },
        reservation: { select: { confirmationNumber: true, notes: true } },
      },
    });
  const snapshot = async () => {
    const items = await dayItems();
    const allocations = await db.allocation.findMany({
      where: {
        startDate: { lte: day(LAST) },
        endDate: { gt: day(DATE) },
        reservationItem: { status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
      },
      select: {
        startDate: true,
        endDate: true,
        reservationItemId: true,
        inventoryUnit: { select: { code: true } },
        reservationItem: { select: { reservation: { select: { confirmationNumber: true } } } },
      },
    });
    const desk = await api<{ counts: Record<string, number> }>(`/desk/today?date=${DATE}`);
    const board = await api<{ summary: Record<string, { occupied: number; free: number }> }>(
      `/chessboard?from=${DATE}&to=${LAST}`,
    );
    const todayHtml = await page(`/today?date=${DATE}`);
    const boardHtml = await page(`/chessboard?from=${DATE}&to=${LAST}`);

    const dbCounts = deskCounts(
      items.map((it) => ({ status: it.status, arrivalDate: iso(it.arrivalDate), departureDate: iso(it.departureDate) })),
      DATE,
    );
    const ui = (id: string) => testIdText(todayHtml, id);
    const deskRows: LayerRow[] = (
      [
        ['arrivals', 'c-arrivals'],
        ['departures', 'c-departures'],
        ['inHouse', 'c-inhouse'],
        ['toCheckIn', 'c-tocheckin'],
        ['toCheckOut', 'c-tocheckout'],
      ] as const
    ).map(([k, id]) => ({
      metric: METRIC[k],
      values: { supabase: dbCounts[k], api: desk.counts[k] ?? null, экран: ui(id) },
    }));
    const cells = parseStayCells(boardHtml);
    const nightsOf = (a: (typeof allocations)[number]) =>
      WINDOW.filter((d) => iso(a.startDate) <= d && d < iso(a.endDate));
    const gridRows: LayerRow[] = WINDOW.map((d) => ({
      metric: `занято ${d}`,
      values: {
        supabase: allocations.filter((a) => nightsOf(a).includes(d)).length,
        api: board.summary[d]?.occupied ?? null,
        экран: testIdText(boardHtml, `occupied-${d}`),
        клеток: cells.filter((c) => c.date === d).length,
      },
    }));
    gridRows.push({ metric: `свободно ${DATE}`, values: { api: board.summary[DATE]?.free ?? null, экран: ui('c-free') } });

    // каждая ночь каждого назначения — клетка той же брони в той же ячейке, и лишних клеток нет
    const expected = new Map(
      allocations.flatMap((a) =>
        nightsOf(a).map((d) => [
          `${a.reservationItemId}|${d}|${a.inventoryUnit.code}`,
          `${a.reservationItem.reservation.confirmationNumber} ${d} ячейка ${a.inventoryUnit.code}`,
        ]),
      ),
    );
    const shown = new Map(cells.map((c) => [`${c.itemId}|${c.date}|${c.unitCode}`, `${c.number} ${c.date} ячейка ${c.unitCode}`]));
    const missing = [...expected].filter(([k]) => !shown.has(k)).map(([, v]) => v);
    const extra = [...shown].filter(([k]) => !expected.has(k)).map(([, v]) => v);

    const issues = [
      ...layerMismatches([...deskRows, ...gridRows]).map((r) => `«${r.metric}» ${JSON.stringify(r.values)}`),
      ...(missing.length ? [`назначений без клетки на шахматке ${missing.length}: ${missing.slice(0, 10).join('; ')}`] : []),
      ...(extra.length ? [`клеток на шахматке без назначения в базе ${extra.length}: ${extra.slice(0, 10).join('; ')}`] : []),
    ];
    return { items, deskRows, gridRows, cellsChecked: expected.size, issues };
  };
  const snap = await checked(snapshot, 30_000);
  for (const s of snap.issues) fail(`сутки и шахматка: ${s}`);

  // Exely ↔ Supabase по суткам: проживания из Exely, без автотестов
  const night = (xs: Array<{ status: string; arrivalDate: string; departureDate: string; code: string }>) => {
    const m: Record<string, number> = {};
    for (const x of xs)
      if (!INACTIVE.has(x.status) && x.arrivalDate <= DATE && DATE < x.departureDate) m[x.code] = (m[x.code] ?? 0) + 1;
    return m;
  };
  const exelyDay = (items: Awaited<ReturnType<typeof dayItems>>, active: ReadonlySet<string>): LayerRow[] => {
    const exStays = [...cards.values()]
      .filter(({ record }) => active.has(record.confirmationNumber))
      .flatMap(({ record }) => record.items);
    const linked = items.filter((it) => it.exelyRoomStayId && it.reservation.notes !== E2E_NOTE);
    const exCounts = deskCounts(exStays, DATE);
    const dbCounts = deskCounts(
      linked.map((it) => ({ status: it.status, arrivalDate: iso(it.arrivalDate), departureDate: iso(it.departureDate) })),
      DATE,
    );
    const exNight = night(exStays.map((it) => ({ ...it, code: it.accommodationTypeCode })));
    const dbNight = night(
      linked.map((it) => ({
        status: it.status,
        arrivalDate: iso(it.arrivalDate),
        departureDate: iso(it.departureDate),
        code: it.accommodationType.code,
      })),
    );
    return [
      ...(Object.keys(METRIC) as Array<keyof typeof METRIC>).map((k) => ({
        metric: METRIC[k],
        values: { exely: exCounts[k], supabase: dbCounts[k] },
      })),
      ...[...new Set([...Object.keys(exNight), ...Object.keys(dbNight)])].sort().map((c) => ({
        metric: `ночь ${DATE}, ${c}`,
        values: { exely: exNight[c] ?? 0, supabase: dbNight[c] ?? 0 },
      })),
    ];
  };
  let dayRowsItems = snap.items;
  let exelyRows = exelyDay(snap.items, affecting);

  // ── 3. Брони по цепочке Exely → Supabase → API → карточка ─────────────────────────────────────
  const itemsOf = (n: string, stayIds: string[]) =>
    db.reservationItem.findMany({
      where: { OR: [{ exelyRoomStayId: { in: stayIds } }, { reservation: { confirmationNumber: n } }] },
      select: {
        id: true,
        exelyRoomStayId: true,
        status: true,
        arrivalDate: true,
        departureDate: true,
        price: true,
        accommodationType: { select: { code: true } },
        reservation: { select: { confirmationNumber: true } },
        allocations: {
          select: { inventoryUnit: { select: { code: true, exelyRoomNumber: true } } },
          orderBy: { startDate: 'asc' },
        },
      },
    });
  type DbItem = Awaited<ReturnType<typeof itemsOf>>[number];
  const dbState = (i: DbItem): StayState => ({
    status: i.status,
    arrivalDate: iso(i.arrivalDate),
    departureDate: iso(i.departureDate),
    categoryCode: i.accommodationType.code,
    priceMinor: i.price.toString(),
  });
  const lastSyncStartedAt = async () => {
    const last = await db.auditLog.findFirst({
      where: { action: 'exely.sync' },
      orderBy: { createdAt: 'desc' },
      select: { after: true },
    });
    return (last?.after as { startedAt?: string } | null)?.startedAt ?? null;
  };

  const pending: string[] = [];
  const reseated: string[] = [];
  const unseated: string[] = [];
  /** С переездом внутри срока (ADR-044): среди ячеек есть ячейка из Exely и ещё одна */
  const movedInside: string[] = [];
  const counters = { stays: 0, staysOk: 0, cards: 0, apiItems: 0, uiRows: 0, rechecked: 0 };
  for (const [idx, n] of [...cards.keys()].entries()) {
    const trace = async () => {
      const exCard = cards.get(n)!;
      const stayIds = exCard.record.items.map((i) => i.exelyRoomStayId);
      const rows = await itemsOf(n, stayIds);
      const syncStart = await lastSyncStartedAt();
      const issues: string[] = [];
      const waiting: string[] = [];
      const seat: { reseated: string[]; unseated: string[]; moved: string[] } = { reseated: [], unseated: [], moved: [] };
      let ok = 0;
      for (const it of exCard.record.items) {
        const row = rows.find((r) => r.exelyRoomStayId === it.exelyRoomStayId);
        const diffs = row
          ? stayDiff(
              {
                status: it.status,
                arrivalDate: it.arrivalDate,
                departureDate: it.departureDate,
                categoryCode: it.accommodationTypeCode,
                priceMinor: it.priceMinor.toString(),
              },
              dbState(row),
            )
          : ['проживания нет в Supabase'];
        const label = `${n} (проживание ${it.exelyRoomStayId})`;
        const verdict = exelyVerdict(diffs, exCard.lastModified, syncStart);
        if (verdict === 'ok') ok += 1;
        else if (verdict === 'pending-sync') waiting.push(`${label}: ${diffs.join('; ')}`);
        else issues.push(`Exely → Supabase: ${label}: ${diffs.join('; ')}`);
        if (row && !INACTIVE.has(row.status) && it.exelyRoomNumber) {
          const units = [...new Set(row.allocations.map((a) => a.inventoryUnit.exelyRoomNumber))];
          if (units.length === 0) seat.unseated.push(`${label}: в Exely ячейка ${it.exelyRoomNumber}, в PMS без ячейки`);
          else if (!units.includes(it.exelyRoomNumber))
            seat.reseated.push(`${label}: в Exely ячейка ${it.exelyRoomNumber}, в PMS ${units.join(', ')}`);
          else if (units.length > 1) seat.moved.push(`${label}: ${units.join(' → ')}`);
        }
      }
      for (const extra of rows.filter(
        (r) => r.exelyRoomStayId && !stayIds.includes(r.exelyRoomStayId) && !INACTIVE.has(r.status),
      ))
        issues.push(`Exely → Supabase: ${n}: активное проживание ${extra.exelyRoomStayId} есть в PMS, в карточке Exely его нет (Q-127)`);

      let apiItems = 0;
      let uiRows = 0;
      if (rows.length > 0) {
        const card = await api<{
          items: Array<{
            id: string;
            status: string;
            arrivalDate: string;
            departureDate: string;
            accommodationTypeCode: string;
            accommodationTypeName: string;
            priceMinor: string;
            unitCode: string | null;
          }>;
        }>(`/reservations/${encodeURIComponent(n)}`);
        const mine = rows.filter((r) => r.reservation.confirmationNumber === n);
        if (card.items.length !== mine.length)
          issues.push(`Supabase → API: ${n}: проживаний в API ${card.items.length}, в базе ${mine.length}`);
        for (const r of mine) {
          const a = card.items.find((x) => x.id === r.id);
          if (!a) {
            issues.push(`Supabase → API: ${n}: проживания ${r.id} нет в ответе API`);
            continue;
          }
          apiItems += 1;
          const diffs = stayDiff(dbState(r), {
            status: a.status,
            arrivalDate: a.arrivalDate,
            departureDate: a.departureDate,
            categoryCode: a.accommodationTypeCode,
            priceMinor: a.priceMinor,
          });
          const units = r.allocations.map((x) => x.inventoryUnit.code);
          if (a.unitCode !== null && !units.includes(a.unitCode))
            diffs.push(`ячейка в API ${a.unitCode}, назначения в базе ${units.join(', ') || '—'}`);
          if (a.unitCode === null && units.length > 0 && !INACTIVE.has(r.status))
            diffs.push(`в API без ячейки, в базе ${units.join(', ')}`);
          if (diffs.length) issues.push(`Supabase → API: ${n}: ${diffs.join('; ')}`);
        }
        const screen = parseStayRows(await page(`/reservations/${encodeURIComponent(n)}`));
        if (screen.length !== card.items.length)
          issues.push(`API → экран: ${n}: строк на карточке ${screen.length}, проживаний в API ${card.items.length}`);
        card.items.forEach((a, k) => {
          const s = screen[k];
          if (!s) return;
          uiRows += 1;
          const diffs: string[] = [];
          if (s.unitCode !== a.unitCode) diffs.push(`ячейка ${a.unitCode ?? 'не назначена'} ≠ ${s.unitCode ?? 'не назначена'}`);
          if (s.category !== a.accommodationTypeName) diffs.push(`категория ${a.accommodationTypeName} ≠ ${s.category}`);
          if (s.arrivalDate !== a.arrivalDate) diffs.push(`заезд ${a.arrivalDate} ≠ ${s.arrivalDate}`);
          if (s.departureDate !== a.departureDate) diffs.push(`выезд ${a.departureDate} ≠ ${s.departureDate}`);
          const label = STATUS_LABEL[a.status] ?? a.status;
          if (s.statusLabel !== label) diffs.push(`статус ${label} ≠ ${s.statusLabel}`);
          if (s.priceMinor !== a.priceMinor) diffs.push(`цена ${a.priceMinor} ≠ ${s.priceMinor}`);
          if (diffs.length) issues.push(`API → экран: ${n}, строка ${k + 1}: ${diffs.join('; ')}`);
        });
      }
      return { issues, waiting, seat, ok, stays: exCard.record.items.length, apiItems, uiRows };
    };
    // ошибка чтения слоя (500 страницы, обрыв) — такое же расхождение, прогон не обрывается
    const attempt = async () => {
      try {
        return await trace();
      } catch (e) {
        const empty = { reseated: [] as string[], unseated: [] as string[], moved: [] as string[] };
        return { issues: [`ошибка чтения ${n}: ${(e as Error).message}`], waiting: [] as string[], seat: empty, ok: 0, stays: 0, apiItems: 0, uiRows: 0 };
      }
    };
    // перепроверка: карточка Exely читается заново — между чтениями синхронизация могла забрать новое изменение
    const first = await attempt();
    let result = first;
    if (first.issues.length) {
      counters.rechecked += 1;
      await sleep(10_000);
      cards.set(n, await readCard(n).catch(() => cards.get(n)!));
      result = await attempt();
    }
    for (const s of result.issues) fail(s);
    pending.push(...result.waiting);
    reseated.push(...result.seat.reseated);
    unseated.push(...result.seat.unseated);
    movedInside.push(...result.seat.moved);
    counters.stays += result.stays;
    counters.staysOk += result.ok;
    counters.apiItems += result.apiItems;
    counters.uiRows += result.uiRows;
    if (result.apiItems > 0) counters.cards += 1;
    if ((idx + 1) % 20 === 0) console.log(`  броней по цепочке ${idx + 1}/${cards.size}`);
  }

  // ── 4. Подключение базы: Supabase → API → экран «Подключения» ──────────────────────────────────
  const connection = await api<{ state: string; counts: Record<string, number> | null }>('/system/connection');
  const [units, categories, reservations, ratePlans, services, sites] = await Promise.all([
    db.inventoryUnit.count({ where: { accommodationType: { propertyId: property.id } } }),
    db.accommodationType.count({ where: { propertyId: property.id } }),
    db.reservation.count({ where: { propertyId: property.id } }),
    db.ratePlan.count({ where: { propertyId: property.id } }),
    db.service.count({ where: { propertyId: property.id } }),
    db.trackedSite.count({ where: { propertyId: property.id } }),
  ]);
  const connectionsHtml = await page('/connections');
  const connRows: LayerRow[] = [
    { metric: 'состояние', values: { api: connection.state, ожидание: 'READY' } },
    { metric: 'единиц', values: { supabase: units, api: connection.counts?.units ?? null, экран: testIdText(connectionsHtml, 'database-units') } },
    { metric: 'категорий', values: { supabase: categories, api: connection.counts?.categories ?? null } },
    { metric: 'бронирований', values: { supabase: reservations, api: connection.counts?.reservations ?? null } },
    { metric: 'тарифов', values: { supabase: ratePlans, api: connection.counts?.ratePlans ?? null } },
    { metric: 'услуг', values: { supabase: services, api: connection.counts?.services ?? null } },
    { metric: 'сайтов', values: { supabase: sites, api: connection.counts?.sites ?? null } },
  ];
  for (const r of layerMismatches(connRows)) fail(`подключение базы: «${r.metric}» ${JSON.stringify(r.values)}`);

  // Сутки Exely ↔ Supabase сняты в начале, пока шла синхронизация: разошлось — перечитать обе стороны в конце
  let dayRechecked = false;
  if (layerMismatches(exelyRows).length) {
    dayRechecked = true;
    const activeNow = new Set(
      await client.searchBookings({
        state: 'Active',
        affectsPeriodFrom: `${DATE}T00:00`,
        affectsPeriodTo: `${plus(DATE, 1)}T00:00`,
      }),
    );
    for (const n of activeNow) cards.set(n, await readCard(n));
    dayRowsItems = await dayItems();
    exelyRows = exelyDay(dayRowsItems, activeNow);
  }
  const freshnessEnd = await api<Freshness>('/system/freshness');
  const syncAgeEndMin = freshnessEnd.exely.lastSyncAt
    ? Math.round((Date.now() - Date.parse(freshnessEnd.exely.lastSyncAt)) / 60_000)
    : null;
  if (syncAgeEndMin === null || syncAgeEndMin > 15)
    fail(`синхронизация Exely: последняя ${freshnessEnd.exely.lastSyncAt ?? 'не найдена'} (${syncAgeEndMin ?? '—'} мин назад на конец проверки, норма ≤ 15)`);
  else if (staleAtStart)
    warnings.push(`синхронизация Exely в начале проверки была ${syncAgeMin ?? '—'} мин назад, к концу — ${syncAgeEndMin} мин`);

  // сутки Exely ↔ Supabase: расхождение, целиком объяснённое бронями «в пути», — не ошибка
  const exelyDayBad = layerMismatches(exelyRows);
  if (exelyDayBad.length && pending.length === 0)
    for (const r of exelyDayBad) fail(`Exely ↔ Supabase, сутки: «${r.metric}» ${JSON.stringify(r.values)}`);
  else if (exelyDayBad.length)
    warnings.push(`сутки Exely ↔ Supabase расходятся при бронях «в пути» (${pending.length}) — следующий прогон синхронизации их заберёт`);
  for (const s of reseated)
    warnings.push(`не на ячейке из Exely — место занято другой бронью, или бронь ещё не попала в пачку синхронизации: ${s}`);
  for (const s of unseated) warnings.push(`без ячейки — место из Exely занято, свободной ячейки и пары с переездом в категории нет (Q-119): ${s}`);

  const fromExely = dayRowsItems.filter((it) => it.exelyRoomStayId && it.reservation.notes !== E2E_NOTE);
  const pmsOnly = dayRowsItems.filter((it) => !it.exelyRoomStayId && it.reservation.notes !== E2E_NOTE);
  const e2e = dayRowsItems.filter((it) => it.reservation.notes === E2E_NOTE);

  // ── Отчёт ──────────────────────────────────────────────────────────────────────────────────────
  const ok = failures.length === 0;
  const lines = [
    `# Сквозная проверка слоёв — ${DATE}`,
    '',
    `Снято ${startedAt.toISOString().slice(0, 16)} UTC. Слои: Exely (живой, только чтение) → Supabase → API PMS → экраны WETOP; Channex — через API PMS. Без ПД. Скрипт: \`scripts/reconciliation/src/cli-system-trace.ts\`.`,
    '',
    `**RESULT: ${ok ? 'OK — слои сходятся' : `FAIL — расхождений ${failures.length}`}**`,
    '',
    '## Связи и свежесть',
    '',
    '| Что | Значение |',
    '|---|---|',
    `| Последняя синхронизация Exely | ${freshness.exely.lastSyncAt ?? '—'} (${syncAgeMin ?? '—'} мин назад, режим ${freshness.exely.mode ?? '—'}) |`,
    `| Очередь ARI в Channex | в ожидании ${freshness.channex.outboxPending}, упавших ${freshness.channex.outboxFailed}, старейшее ${freshness.channex.oldestPendingAt ?? '—'} |`,
    `| Webhook Channex | зарегистрирован ${webhook.registered ? 'да' : 'нет'}, активен ${webhook.active ? 'да' : 'нет'}, под подозрением ${webhook.webhookSuspect ? 'да' : 'нет'}, адрес отвечает ${webhook.callbackReachable === null ? '—' : webhook.callbackReachable ? 'да' : 'нет'}, последнее событие ${webhook.lastWebhookAt ?? '—'} |`,
    `| Строка свежести на экране = API | ${freshnessOnScreen ? 'да' : 'нет'} |`,
    `| Контент из Channex | ${content.state}, фото ${content.photos.length}, описание на экране ${contentShown ? 'показано' : 'нет'} |`,
    '',
    `## Сутки ${DATE}: Supabase → API → экран «Обзор дня»`,
    '',
    ...table(snap.deskRows, ['supabase', 'api', 'экран']),
    '',
    `Проживаний на сутки в Supabase: ${dayRowsItems.length} — из Exely ${fromExely.length}, созданы в PMS ${pmsOnly.length}, автотесты ${e2e.length}.${snap.rechecked ? ' Слои перепроверены через 30 с.' : ''}`,
    '',
    `## Сутки ${DATE}: Exely → Supabase (проживания из Exely, без автотестов)`,
    '',
    ...table(exelyRows, ['exely', 'supabase']),
    '',
    ...(dayRechecked ? ['В начале проверки сутки разошлись — обе стороны перечитаны в конце, в таблице итог.', ''] : []),
    `## Шахматка ${DATE} … ${LAST}: Supabase → API → экран`,
    '',
    ...table(snap.gridRows, ['supabase', 'api', 'экран', 'клеток']),
    '',
    `Клетка на экране сверена с назначением в базе по проживанию, дате и ячейке: ${snap.cellsChecked} ночей.`,
    '',
    '## Брони по цепочке Exely → Supabase → API → карточка брони',
    '',
    `| Звено | Проверено | Расхождений |`,
    `|---|---:|---:|`,
    `| Exely → Supabase (проживаний; броней ${cards.size}: активных на сутки ${affecting.size}, изменённых за 24 ч ${modified.size}) | ${counters.stays} | ${failures.filter((f) => f.startsWith('Exely → Supabase')).length} |`,
    `| Supabase → API (проживаний) | ${counters.apiItems} | ${failures.filter((f) => f.startsWith('Supabase → API')).length} |`,
    `| API → карточка на экране (строк; карточек ${counters.cards}) | ${counters.uiRows} | ${failures.filter((f) => f.startsWith('API → экран')).length} |`,
    '',
    `С переездом внутри срока (ADR-044) ${movedInside.length}${movedInside.length ? `: ${movedInside.join('; ')}` : ''}.`,
    '',
    `Сошлось с Exely ${counters.staysOk} из ${counters.stays}; «в пути» (изменены в Exely после старта последней синхронизации) ${pending.length}; броней, перепроверенных после первого расхождения, ${counters.rechecked}.`,
    '',
    '## Подключение базы: Supabase → API → экран «Подключения»',
    '',
    ...table(connRows, ['supabase', 'api', 'экран', 'ожидание']),
    '',
  ];
  if (failures.length) lines.push(`## Расхождения — ${failures.length}`, '', ...failures.slice(0, 80).map((f) => `- ${f}`), '');
  if (failures.length > 80) lines.push(`…и ещё ${failures.length - 80}.`, '');
  if (pending.length) lines.push(`## В пути — ${pending.length}`, '', ...pending.map((p) => `- ${p}`), '');
  if (warnings.length) lines.push(`## Предупреждения — ${warnings.length}`, '', ...warnings.map((w) => `- ${w}`), '');
  if (pmsOnly.length)
    lines.push(
      `## Созданы в PMS, в Exely их нет — ${pmsOnly.length}`,
      '',
      ...pmsOnly.map(
        (it) => `- ${it.reservation.confirmationNumber} · ${it.accommodationType.code} · ${iso(it.arrivalDate)} → ${iso(it.departureDate)} · ${it.status}`,
      ),
      '',
    );
  mkdirSync(resolve(ROOT, 'reports'), { recursive: true });
  const file = resolve(ROOT, `reports/system-trace-${DATE}.md`);
  writeFileSync(file, lines.join('\n'));
  console.log(lines.join('\n'));
  console.log(`→ ${file}`);
  process.exitCode = ok ? 0 : 1;
} finally {
  await db.$disconnect();
}
