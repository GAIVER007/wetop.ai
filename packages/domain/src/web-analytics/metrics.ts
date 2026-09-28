/**
 * Метрики сайта по определениям GA4.
 * (`docs/legacy/analytics-2026-09-12.md`). Считаются по сессиям периода; даты — в часовом поясе объекта.
 */
import type { DeviceKind } from './device';
import type { SourceKind } from './source';

export interface SessionRow {
  visitorKey: string;
  startedAt: Date;
  pageviews: number;
  durationSeconds: number;
  sourceKind: SourceKind;
  source: string | null;
  device: DeviceKind;
  browser?: string | null;
  os?: string | null;
  language?: string | null;
  /** Бронь виджета в этой сессии (срез 9) */
  reservationId?: string | null;
}

export interface Summary {
  sessions: number;
  visitors: number;
  pageviews: number;
  pagesPerSession: number;
  avgDurationSeconds: number;
  mobileSessions: number;
  mobileShare: number;
  bounces: number;
  bounceRate: number;
  /** Сессий, закончившихся бронью с сайта (срез 9) */
  bookings: number;
}

/** Отказ: один просмотр и меньше 10 секунд на сайте. */
export const BOUNCE_SECONDS = 10;
export const isBounce = (s: Pick<SessionRow, 'pageviews' | 'durationSeconds'>): boolean =>
  s.pageviews <= 1 && s.durationSeconds < BOUNCE_SECONDS;

const round2 = (x: number) => Math.round(x * 100) / 100;
const ratio = (a: number, b: number) => (b === 0 ? 0 : round2(a / b));

export function summarize(rows: readonly SessionRow[]): Summary {
  const sessions = rows.length;
  const pageviews = rows.reduce((n, r) => n + r.pageviews, 0);
  const duration = rows.reduce((n, r) => n + r.durationSeconds, 0);
  const mobileSessions = rows.filter((r) => r.device === 'MOBILE').length;
  const bounces = rows.filter(isBounce).length;
  const bookings = rows.filter((r) => !!r.reservationId).length;
  return {
    sessions,
    visitors: new Set(rows.map((r) => r.visitorKey)).size,
    pageviews,
    pagesPerSession: ratio(pageviews, sessions),
    avgDurationSeconds: sessions === 0 ? 0 : Math.round(duration / sessions),
    mobileSessions,
    mobileShare: ratio(mobileSessions, sessions),
    bounces,
    bounceRate: ratio(bounces, sessions),
    bookings,
  };
}

// ───────────── даты в часовом поясе объекта ─────────────

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

interface Parts {
  y: number;
  m: number;
  d: number;
  hh: number;
  mm: number;
  ss: number;
}

function parts(at: Date, tz: string): Parts {
  const p = Object.fromEntries(
    fmt(tz)
      .formatToParts(at)
      .map((x) => [x.type, x.value]),
  );
  return {
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    hh: Number(p.hour),
    mm: Number(p.minute),
    ss: Number(p.second),
  };
}

/** Дата YYYY-MM-DD момента `at` в поясе `tz`. */
export function localDate(at: Date, tz: string): string {
  const { y, m, d } = parts(at, tz);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * «Сегодня» по часам объекта (С-13, ТЗ аудита 25.09.2026): одна функция вместо одиннадцати копий
 * `Date.now() + 5 * 3600 * 1000`. От неё зависят штрафы, досрочный выезд и отмены каналов —
 * объект не в UTC+5 не должен получать их в чужой час.
 */
export function todayAt(tz: string, now: Date = new Date()): string {
  return localDate(now, tz);
}

/** Смещение пояса в минутах для момента `at` (положительное к востоку от UTC). */
function offsetMinutes(at: Date, tz: string): number {
  const { y, m, d, hh, mm, ss } = parts(at, tz);
  return Math.round((Date.UTC(y, m - 1, d, hh, mm, ss) - at.getTime()) / 60000);
}

/** Начало календарного дня `date` (YYYY-MM-DD) в поясе `tz` как момент UTC. */
export function zonedStartOfDay(date: string, tz: string): Date {
  const [y = 0, m = 1, d = 1] = date.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d);
  const first = new Date(guess - offsetMinutes(new Date(guess), tz) * 60000);
  // второй проход на случай перевода часов ровно в полночь; для Азии/Алматы совпадает с первым
  return new Date(guess - offsetMinutes(first, tz) * 60000);
}

const DAY_MS = 86_400_000;
const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);
const nextDay = (date: string) => isoDay(Date.parse(`${date}T00:00:00Z`) + DAY_MS);

/** Полуинтервал [начало from, начало дня после to) в UTC. */
export function periodBoundsUtc(
  from: string,
  to: string,
  tz: string,
): { startUtc: Date; endUtcExclusive: Date } {
  return {
    startUtc: zonedStartOfDay(from, tz),
    endUtcExclusive: zonedStartOfDay(nextDay(to), tz),
  };
}

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const isIsoDate = (s: unknown): s is string => {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const t = Date.parse(`${s}T00:00:00Z`);
  return !Number.isNaN(t) && isoDay(t) === s;
};

/** Первый и последний день месяца YYYY-MM. */
export function monthPeriod(ym: string): { from: string; to: string } {
  const [y = 0, m = 1] = ym.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, '0')}` };
}

/** Список дат from..to включительно. */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const end = Date.parse(`${to}T00:00:00Z`);
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= end; t += DAY_MS) out.push(isoDay(t));
  return out;
}

// ───────────── разрезы ─────────────

export interface DailyRow {
  date: string;
  sessions: number;
  visitors: number;
  pageviews: number;
  mobile: number;
}

export function dailyBreakdown(
  rows: readonly SessionRow[],
  from: string,
  to: string,
  tz: string,
): DailyRow[] {
  const byDate = new Map<
    string,
    { sessions: number; visitors: Set<string>; pageviews: number; mobile: number }
  >();
  for (const date of datesBetween(from, to)) {
    byDate.set(date, { sessions: 0, visitors: new Set(), pageviews: 0, mobile: 0 });
  }
  for (const r of rows) {
    const day = byDate.get(localDate(r.startedAt, tz));
    if (!day) continue;
    day.sessions += 1;
    day.visitors.add(r.visitorKey);
    day.pageviews += r.pageviews;
    if (r.device === 'MOBILE') day.mobile += 1;
  }
  return [...byDate.entries()].map(([date, d]) => ({
    date,
    sessions: d.sessions,
    visitors: d.visitors.size,
    pageviews: d.pageviews,
    mobile: d.mobile,
  }));
}

export interface SourceRow {
  kind: SourceKind;
  source: string | null;
  sessions: number;
  visitors: number;
  pageviews: number;
  avgDurationSeconds: number;
  share: number;
  bookings: number;
}

export function sourcesBreakdown(rows: readonly SessionRow[]): SourceRow[] {
  const groups = new Map<string, { kind: SourceKind; source: string | null; rows: SessionRow[] }>();
  for (const r of rows) {
    const key = `${r.sourceKind} ${r.source ?? ''}`;
    const g = groups.get(key) ?? { kind: r.sourceKind, source: r.source, rows: [] };
    g.rows.push(r);
    groups.set(key, g);
  }
  const total = rows.length;
  return [...groups.values()]
    .map((g) => ({
      kind: g.kind,
      source: g.source,
      sessions: g.rows.length,
      visitors: new Set(g.rows.map((r) => r.visitorKey)).size,
      pageviews: g.rows.reduce((n, r) => n + r.pageviews, 0),
      avgDurationSeconds: Math.round(
        g.rows.reduce((n, r) => n + r.durationSeconds, 0) / g.rows.length,
      ),
      share: ratio(g.rows.length, total),
      bookings: g.rows.filter((r) => !!r.reservationId).length,
    }))
    .sort(
      (a, b) =>
        b.sessions - a.sessions ||
        a.kind.localeCompare(b.kind) ||
        (a.source ?? '').localeCompare(b.source ?? ''),
    );
}

export interface PageRow {
  path: string;
  views: number;
  share: number;
}

export function topPages(pageviews: ReadonlyArray<{ path: string }>, limit = 20): PageRow[] {
  const counts = new Map<string, number>();
  for (const p of pageviews) counts.set(p.path, (counts.get(p.path) ?? 0) + 1);
  const total = pageviews.length;
  return [...counts.entries()]
    .map(([path, views]) => ({ path, views, share: ratio(views, total) }))
    .sort((a, b) => b.views - a.views || a.path.localeCompare(b.path))
    .slice(0, limit);
}

export interface DemandRow {
  arrival: string;
  searches: number;
}

/** Календарь спроса: сколько раз посетители искали заезд на дату (событие `search`, `props.arrival`). */
export function demandCalendar(events: ReadonlyArray<{ props: unknown }>): DemandRow[] {
  const counts = new Map<string, number>();
  for (const e of events) {
    const arrival =
      e.props && typeof e.props === 'object' ? (e.props as Record<string, unknown>).arrival : null;
    if (!isIsoDate(arrival)) continue;
    counts.set(arrival, (counts.get(arrival) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([arrival, searches]) => ({ arrival, searches }))
    .sort((a, b) => a.arrival.localeCompare(b.arrival));
}

export interface EventRow {
  name: string;
  count: number;
  /** В скольких сессиях событие случилось хотя бы раз */
  sessions: number;
}

/** События с сайта за период: клики по телефону и WhatsApp, поиск дат, шаги бронирования. */
export function eventsBreakdown(
  events: ReadonlyArray<{ name: string; sessionKey: string }>,
): EventRow[] {
  const byName = new Map<string, { count: number; sessions: Set<string> }>();
  for (const e of events) {
    const g = byName.get(e.name) ?? { count: 0, sessions: new Set<string>() };
    g.count += 1;
    g.sessions.add(e.sessionKey);
    byName.set(e.name, g);
  }
  return [...byName.entries()]
    .map(([name, g]) => ({ name, count: g.count, sessions: g.sessions.size }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export interface ShareRow {
  /** null — счётчик не смог определить (нет User-Agent) */
  key: string | null;
  sessions: number;
  share: number;
}

export interface DevicesBreakdown {
  devices: ShareRow[];
  browsers: ShareRow[];
  os: ShareRow[];
}

function shareRows(
  rows: readonly SessionRow[],
  pick: (r: SessionRow) => string | null,
  limit: number,
): ShareRow[] {
  const counts = new Map<string | null, number>();
  for (const r of rows) {
    const k = pick(r);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, sessions]) => ({ key, sessions, share: ratio(sessions, rows.length) }))
    .sort((a, b) => b.sessions - a.sessions || (a.key ?? '\uffff').localeCompare(b.key ?? '\uffff'))
    .slice(0, limit);
}

/** С чего заходят: устройство, браузер, ОС — по сессиям периода. */
export function devicesBreakdown(rows: readonly SessionRow[]): DevicesBreakdown {
  return {
    devices: shareRows(rows, (r) => r.device, 3),
    browsers: shareRows(rows, (r) => r.browser ?? null, 8),
    os: shareRows(rows, (r) => r.os ?? null, 8),
  };
}
