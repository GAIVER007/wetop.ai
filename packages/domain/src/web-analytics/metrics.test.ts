import { describe, expect, it } from 'vitest';
import {
  dailyBreakdown,
  demandCalendar,
  devicesBreakdown,
  eventsBreakdown,
  localDate,
  monthPeriod,
  periodBoundsUtc,
  sourcesBreakdown,
  summarize,
  topPages,
  type SessionRow,
} from './metrics';

const TZ = 'Asia/Almaty'; // UTC+5 без перевода часов
const row = (over: Partial<SessionRow>): SessionRow => ({
  visitorKey: 'A',
  startedAt: new Date('2026-09-12T05:00:00Z'), // 10:00 Алматы
  pageviews: 1,
  durationSeconds: 0,
  sourceKind: 'DIRECT',
  source: null,
  device: 'DESKTOP',
  ...over,
});

/** Контрольные числа гейта среза 8 (план §11). */
const GATE: SessionRow[] = [
  row({ visitorKey: 'A', pageviews: 2, durationSeconds: 40 }),
  row({
    visitorKey: 'A',
    startedAt: new Date('2026-09-12T05:31:00Z'),
    pageviews: 1,
    durationSeconds: 5,
    sourceKind: 'SOCIAL',
    source: 'instagram',
  }),
  row({
    visitorKey: 'B',
    startedAt: new Date('2026-09-12T18:59:30Z'), // 23:59:30 Алматы — ещё 12.09
    pageviews: 1,
    durationSeconds: 30,
    sourceKind: 'SEARCH',
    source: 'google',
    device: 'MOBILE',
  }),
];

describe('сводка (определения GA4 / Exely)', () => {
  it('гейт: 3 сессии, 2 посетителя, 4 просмотра, 1,33 страниц/сессию, 33 % мобильных, 1 отказ', () => {
    expect(summarize(GATE)).toEqual({
      sessions: 3,
      visitors: 2,
      pageviews: 4,
      pagesPerSession: 1.33,
      avgDurationSeconds: 25,
      mobileSessions: 1,
      mobileShare: 0.33,
      bounces: 1,
      bounceRate: 0.33,
      bookings: 0,
    });
  });
  it('пусто — нули, без деления на ноль', () => {
    expect(summarize([])).toEqual({
      sessions: 0,
      visitors: 0,
      pageviews: 0,
      pagesPerSession: 0,
      avgDurationSeconds: 0,
      mobileSessions: 0,
      mobileShare: 0,
      bounces: 0,
      bounceRate: 0,
      bookings: 0,
    });
  });
});

describe('даты в часовом поясе объекта', () => {
  it('localDate переводит UTC в дату Алматы', () => {
    expect(localDate(new Date('2026-09-12T18:59:30Z'), TZ)).toBe('2026-09-12');
    expect(localDate(new Date('2026-09-12T19:00:00Z'), TZ)).toBe('2026-09-13');
  });
  it('periodBoundsUtc — полуинтервал [начало from, начало дня после to) в UTC', () => {
    expect(periodBoundsUtc('2026-09-01', '2026-09-30', TZ)).toEqual({
      startUtc: new Date('2026-08-31T19:00:00Z'),
      endUtcExclusive: new Date('2026-09-30T19:00:00Z'),
    });
  });
  it('monthPeriod — первый и последний день месяца', () => {
    expect(monthPeriod('2026-09')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(monthPeriod('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });
});

describe('по дням', () => {
  it('каждый день периода, включая нулевые; посетители уникальны внутри дня', () => {
    const d = dailyBreakdown(GATE, '2026-09-11', '2026-09-13', TZ);
    expect(d).toEqual([
      { date: '2026-09-11', sessions: 0, visitors: 0, pageviews: 0, mobile: 0 },
      { date: '2026-09-12', sessions: 3, visitors: 2, pageviews: 4, mobile: 1 },
      { date: '2026-09-13', sessions: 0, visitors: 0, pageviews: 0, mobile: 0 },
    ]);
  });
});

describe('источники', () => {
  it('гейт: DIRECT 1, SOCIAL/instagram 1, SEARCH/google 1; доля и среднее время', () => {
    expect(sourcesBreakdown(GATE)).toEqual([
      {
        kind: 'DIRECT',
        source: null,
        sessions: 1,
        visitors: 1,
        pageviews: 2,
        avgDurationSeconds: 40,
        share: 0.33,
        bookings: 0,
      },
      {
        kind: 'SEARCH',
        source: 'google',
        sessions: 1,
        visitors: 1,
        pageviews: 1,
        avgDurationSeconds: 30,
        share: 0.33,
        bookings: 0,
      },
      {
        kind: 'SOCIAL',
        source: 'instagram',
        sessions: 1,
        visitors: 1,
        pageviews: 1,
        avgDurationSeconds: 5,
        share: 0.33,
        bookings: 0,
      },
    ]);
  });
  it('сортировка — по сессиям убыванию, при равенстве по виду и источнику', () => {
    const rows = [
      row({ sourceKind: 'REFERRAL', source: '2gis.kz' }),
      row({ sourceKind: 'REFERRAL', source: '2gis.kz' }),
      row({ sourceKind: 'DIRECT' }),
    ];
    expect(sourcesBreakdown(rows).map((s) => `${s.kind}/${s.source}`)).toEqual([
      'REFERRAL/2gis.kz',
      'DIRECT/null',
    ]);
  });
});

describe('страницы и спрос', () => {
  it('topPages считает просмотры по пути и долю', () => {
    expect(
      topPages([{ path: '/' }, { path: '/rooms' }, { path: '/' }, { path: '/contacts' }], 2),
    ).toEqual([
      { path: '/', views: 2, share: 0.5 },
      { path: '/contacts', views: 1, share: 0.25 },
    ]);
  });
  it('demandCalendar — запросов на дату заезда, только валидные даты', () => {
    expect(
      demandCalendar([
        { props: { arrival: '2026-10-01', departure: '2026-10-03' } },
        { props: { arrival: '2026-10-01' } },
        { props: { arrival: '2026-09-28' } },
        { props: { arrival: 'вчера' } },
        { props: null },
      ]),
    ).toEqual([
      { arrival: '2026-09-28', searches: 1 },
      { arrival: '2026-10-01', searches: 2 },
    ]);
  });
});

describe('события и устройства', () => {
  it('eventsBreakdown — число событий и сессий по имени, по убыванию', () => {
    expect(
      eventsBreakdown([
        { name: 'phone_click', sessionKey: 's1' },
        { name: 'phone_click', sessionKey: 's1' },
        { name: 'search', sessionKey: 's2' },
        { name: 'whatsapp_click', sessionKey: 's1' },
        { name: 'phone_click', sessionKey: 's3' },
      ]),
    ).toEqual([
      { name: 'phone_click', count: 3, sessions: 2 },
      { name: 'search', count: 1, sessions: 1 },
      { name: 'whatsapp_click', count: 1, sessions: 1 },
    ]);
    expect(eventsBreakdown([])).toEqual([]);
  });
  it('devicesBreakdown — устройства, браузеры и ОС с долями; неизвестное — null', () => {
    const rows = [
      row({ device: 'MOBILE', browser: 'Chrome', os: 'Android' }),
      row({ device: 'MOBILE', browser: 'Safari', os: 'iOS' }),
      row({ device: 'DESKTOP', browser: 'Chrome', os: 'macOS' }),
      row({ device: 'DESKTOP' }),
    ];
    const d = devicesBreakdown(rows);
    expect(d.devices).toEqual([
      { key: 'DESKTOP', sessions: 2, share: 0.5 },
      { key: 'MOBILE', sessions: 2, share: 0.5 },
    ]);
    expect(d.browsers).toEqual([
      { key: 'Chrome', sessions: 2, share: 0.5 },
      { key: 'Safari', sessions: 1, share: 0.25 },
      { key: null, sessions: 1, share: 0.25 },
    ]);
    expect(d.os.map((x) => x.key)).toEqual(['Android', 'iOS', 'macOS', null]);
  });
});

describe('брони с сайта (срез 9)', () => {
  it('summary.bookings и bookings по источникам считают сессии с бронью', () => {
    const rows = [
      row({ visitorKey: 'A', reservationId: 'r1' }),
      row({ visitorKey: 'B', sourceKind: 'SEARCH', source: 'google', reservationId: 'r2' }),
      row({ visitorKey: 'C', sourceKind: 'SEARCH', source: 'google' }),
    ];
    expect(summarize(rows).bookings).toBe(2);
    expect(summarize(GATE).bookings).toBe(0);
    expect(sourcesBreakdown(rows).map((s) => [s.source, s.sessions, s.bookings])).toEqual([
      ['google', 2, 1],
      [null, 1, 1],
    ]);
  });
});
