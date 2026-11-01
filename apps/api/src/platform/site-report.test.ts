import { describe, expect, it } from 'vitest';
import type { DeviceKind, SourceKind } from '@pms/domain';
import { buildSiteReport } from './site-report';

/**
 * Кабинет руководителя, «Сайт wetop.ai» (владелец 29.10.2026): посетители по дням, откуда пришли, страницы,
 * телефон или компьютер и путь «зашёл → открыл регистрацию → отправил форму → подтвердил почту». Только счёт.
 */
const s = (visitorKey: string, sessionKey: string, startedAt: string, source: string | null, kind: SourceKind, device: DeviceKind = 'DESKTOP', country: string | null = null) => ({
  country,
  visitorKey,
  sessionKey,
  startedAt: new Date(startedAt),
  pageviews: 1,
  durationSeconds: 30,
  sourceKind: kind,
  source,
  device,
});

describe('отчёт сайта wetop.ai в кабинете', () => {
  const sessions = [
    s('v1', 's1', '2026-10-01T08:00:00Z', 'google', 'SEARCH', 'MOBILE', 'KZ'),
    s('v1', 's2', '2026-10-02T08:00:00Z', null, 'DIRECT', 'MOBILE', 'KZ'),
    s('v2', 's3', '2026-10-02T09:00:00Z', 'instagram', 'SOCIAL', 'DESKTOP', 'QA'),
    s('v3', 's4', '2026-10-02T10:00:00Z', 'google', 'PAID'),
  ];
  const events = [
    { name: 'signup_open', sessionKey: 's2' },
    { name: 'signup_open', sessionKey: 's2' },
    { name: 'signup_sent', sessionKey: 's2' },
    { name: 'signup_done', sessionKey: 's2' },
    { name: 'signup_open', sessionKey: 's3' },
    { name: 'login_open', sessionKey: 's4' },
  ];
  const pageviews = [{ path: '/' }, { path: '/' }, { path: '/pricing/' }];
  const r = buildSiteReport({ month: '2026-10', timezone: 'Asia/Almaty', sessions, events, pageviews });

  it('итоги месяца и дни месяца без пропусков', () => {
    expect(r.visitors).toBe(3);
    expect(r.sessions).toBe(4);
    expect(r.mobileShare).toBe(500);
    expect(r.daily).toHaveLength(31);
    expect(r.daily[1]).toMatchObject({ date: '2026-10-02', visitors: 3 });
  });

  it('путь по посетителям: каждый шаг один раз, проценты десятыми', () => {
    expect(r.path).toEqual({ visitors: 3, signupOpen: 2, signupSent: 1, signupDone: 1, loginOpen: 1 });
  });

  it('откуда пришли: по посетителям, крупные сверху, при равенстве по виду; реклама отдельно от поиска', () => {
    expect(r.sources.map((x) => [x.kind, x.source, x.visitors])).toEqual([
      ['DIRECT', null, 1],
      ['PAID', 'google', 1],
      ['SEARCH', 'google', 1],
      ['SOCIAL', 'instagram', 1],
    ]);
  });

  it('страницы: просмотры по адресу', () => {
    expect(r.pages[0]).toEqual({ path: '/', views: 2, share: 666 });
  });
  it('страны посетителей (миграция 169): посетители и дошедшие до подтверждения почты; без страны отдельно', () => {
    expect(r.countries).toEqual([
      { country: 'KZ', visitors: 1, signupDone: 1 },
      { country: 'QA', visitors: 1, signupDone: 0 },
      { country: null, visitors: 1, signupDone: 0 },
    ]);
  });

  it('по дням (вариант Б, владелец 01.11.2026): посетители, визиты, шаги пути и главный источник дня; пустой день нулями', () => {
    const d2 = r.daily[1]!;
    expect(d2).toEqual({ date: '2026-10-02', visitors: 3, sessions: 3, signupOpen: 2, signupSent: 1, signupDone: 1, mobile: 1, sources: ['DIRECT', 'google', 'instagram'] });
    expect(r.daily[0]).toEqual({ date: '2026-10-01', visitors: 1, sessions: 1, signupOpen: 0, signupSent: 0, signupDone: 0, mobile: 1, sources: ['google'] });
    expect(r.daily[5]).toEqual({ date: '2026-10-06', visitors: 0, sessions: 0, signupOpen: 0, signupSent: 0, signupDone: 0, mobile: 0, sources: [] });
  });
});
