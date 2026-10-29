import { datesBetween, localDate, monthPeriod, type DeviceKind, type SourceKind } from '@pms/domain';

/**
 * «Сайт wetop.ai» в кабинете руководителя (владелец 29.10.2026): посетители месяца по дням, откуда пришли,
 * страницы, доля телефонов и путь посетителя к регистрации по событиям счётчика главной (`signup_*`).
 * Доли целыми десятыми процента (`500` это 50,0%), без плавающей точки. Только счёт, без персональных данных.
 */
export interface SiteReportInput {
  month: string;
  timezone: string;
  sessions: ReadonlyArray<{ visitorKey: string; sessionKey?: string; startedAt: Date; sourceKind: SourceKind; source: string | null; device: DeviceKind }>;
  events: ReadonlyArray<{ name: string; sessionKey: string }>;
  pageviews: ReadonlyArray<{ path: string }>;
}

export interface SiteReport {
  month: string;
  visitors: number;
  sessions: number;
  /** Доля посещений с телефона, десятые процента */
  mobileShare: number;
  daily: Array<{ date: string; visitors: number }>;
  /** Посетители, дошедшие до шага (каждый один раз) */
  path: { visitors: number; signupOpen: number; signupSent: number; signupDone: number; loginOpen: number };
  sources: Array<{ kind: SourceKind; source: string | null; visitors: number; share: number }>;
  pages: Array<{ path: string; views: number; share: number }>;
}

const tenths = (part: number, whole: number) => (whole ? Math.floor((part * 1000) / whole) : 0);

export function buildSiteReport(input: SiteReportInput): SiteReport {
  const { from, to } = monthPeriod(input.month);
  const visitorOf = new Map<string, string>();
  for (const s of input.sessions) if (s.sessionKey) visitorOf.set(s.sessionKey, s.visitorKey);
  const visitors = new Set(input.sessions.map((s) => s.visitorKey));
  const reached = (name: string) =>
    new Set(input.events.filter((e) => e.name === name).flatMap((e) => (visitorOf.has(e.sessionKey) ? [visitorOf.get(e.sessionKey)!] : []))).size;

  const byDay = new Map<string, Set<string>>(datesBetween(from, to).map((d) => [d, new Set<string>()]));
  for (const s of input.sessions) byDay.get(localDate(s.startedAt, input.timezone))?.add(s.visitorKey);

  const groups = new Map<string, { kind: SourceKind; source: string | null; v: Set<string> }>();
  for (const s of input.sessions) {
    const key = `${s.sourceKind} ${s.source ?? ''}`;
    const g = groups.get(key) ?? { kind: s.sourceKind, source: s.source, v: new Set<string>() };
    g.v.add(s.visitorKey);
    groups.set(key, g);
  }
  const views = new Map<string, number>();
  for (const p of input.pageviews) views.set(p.path, (views.get(p.path) ?? 0) + 1);

  return {
    month: input.month,
    visitors: visitors.size,
    sessions: input.sessions.length,
    mobileShare: tenths(input.sessions.filter((s) => s.device === 'MOBILE').length, input.sessions.length),
    daily: [...byDay.entries()].map(([date, v]) => ({ date, visitors: v.size })),
    path: {
      visitors: visitors.size,
      signupOpen: reached('signup_open'),
      signupSent: reached('signup_sent'),
      signupDone: reached('signup_done'),
      loginOpen: reached('login_open'),
    },
    sources: [...groups.values()]
      .map((g) => ({ kind: g.kind, source: g.source, visitors: g.v.size, share: tenths(g.v.size, visitors.size) }))
      .sort((a, b) => b.visitors - a.visitors || a.kind.localeCompare(b.kind) || (a.source ?? '').localeCompare(b.source ?? '')),
    pages: [...views.entries()]
      .map(([path, n]) => ({ path, views: n, share: tenths(n, input.pageviews.length) }))
      .sort((a, b) => b.views - a.views || a.path.localeCompare(b.path))
      .slice(0, 10),
  };
}
