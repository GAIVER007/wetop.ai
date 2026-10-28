import { expect, it } from 'vitest';
import { decideScope, scopeIsStale } from './scope-resolve';
import type { WebVertical } from './vertical-landing';

const B1 = '11111111-1111-4111-8111-111111111111';
const L1 = '22222222-2222-4222-8222-222222222222';
const B2 = '33333333-3333-4333-8333-333333333333';
const L2 = '44444444-4444-4444-8444-444444444444';
const branch = (vertical: WebVertical, businessId = B1, locationId = L1) => ({
  vertical,
  locationId,
  location: { businessId },
});

it('нет доступных филиалов: прежний путь настройки, указатель не ставится', () => {
  expect(decideScope([], '/today')).toEqual({ kind: 'empty', target: '/onboarding' });
});

it('один филиал: выбирается сам, указатель только из ответа сервера', () => {
  expect(decideScope([branch('HOSPITALITY')], '/reservations?status=CONFIRMED')).toEqual({
    kind: 'select',
    pointer: `business=${B1};location=${L1}`,
    target: '/reservations?status=CONFIRMED',
  });
});

it('несколько филиалов: никогда не выбирается первый, человек выбирает на /branches', () => {
  const decision = decideScope([branch('HOSPITALITY'), branch('BEAUTY', B2, L2)], '/today');
  expect(decision).toEqual({ kind: 'choose', target: '/branches' });
  expect(decision).not.toHaveProperty('pointer');
});

it('несколько филиалов: тот, что человек выбирал последним, выбирается сам, если он ещё доступен', () => {
  const items = [branch('HOSPITALITY'), branch('BEAUTY', B2, L2)];
  expect(decideScope(items, '/today', L2)).toEqual({
    kind: 'select',
    pointer: `business=${B2};location=${L2}`,
    target: '/register/setup?entry=1',
  });
  expect(decideScope(items, null, L1)).toEqual({
    kind: 'select',
    pointer: `business=${B1};location=${L1}`,
    // стартовый экран по роли выбирает корень `/` (владелец 27.10.2026)
    target: '/',
  });
});

it('запомненный филиал, которого нет в ответе сервера, не выбирается: человек выбирает сам', () => {
  const items = [branch('HOSPITALITY'), branch('BEAUTY', B2, L2)];
  const gone = '55555555-5555-4555-8555-555555555555';
  expect(decideScope(items, '/today', gone)).toEqual({ kind: 'choose', target: '/branches' });
  expect(decideScope(items, '/today', '')).toEqual({ kind: 'choose', target: '/branches' });
});

it('next чужого направления заменяется стартовой страницей направления', () => {
  expect(decideScope([branch('HOSPITALITY')], '/calendar')).toMatchObject({ target: '/' });
  expect(decideScope([branch('FOOD_SERVICE')], '/chessboard')).toMatchObject({
    target: '/register/setup',
  });
  expect(decideScope([branch('BEAUTY')], '/floor-plan')).toMatchObject({
    target: '/register/setup?entry=1',
  });
});

it('вход без своего адреса ведёт на корень `/`: там стартовый экран по роли (владелец 27.10.2026); Beauty проверяет готовность', () => {
  expect(decideScope([branch('HOSPITALITY')], '/today')).toMatchObject({ target: '/' });
  expect(decideScope([branch('HOSPITALITY')], null)).toMatchObject({ target: '/' });
  expect(decideScope([branch('FOOD_SERVICE')], '/today')).toMatchObject({ target: '/' });
});

it('next своего направления и общие разделы сохраняются', () => {
  expect(
    decideScope([branch('FOOD_SERVICE')], '/table-reservations?date=2026-10-07'),
  ).toMatchObject({
    target: '/table-reservations?date=2026-10-07',
  });
  expect(decideScope([branch('BEAUTY')], '/journal')).toMatchObject({ target: '/journal' });
  expect(decideScope([branch('HOSPITALITY')], '/journal?page=2')).toMatchObject({
    target: '/journal?page=2',
  });
});

it('next только безопасный локальный путь', () => {
  // небезопасная строка падает в общий «/today» (safeReturnPath), а оттуда на корень: стартовый экран по роли
  for (const next of ['//evil.invalid', 'https://evil.invalid/today', '/login', '/\\evil'])
    expect(decideScope([branch('HOSPITALITY')], next)).toMatchObject({ target: '/' });
  expect(decideScope([branch('HOSPITALITY')], null)).toMatchObject({ target: '/' });
});

it('устаревший указатель: кука есть, а /auth/me не подтвердил ни Business, ни филиал', () => {
  const cookie = `business=${B1};location=${L1}`;
  const user = { id: 'u' };
  expect(scopeIsStale(cookie, { user, context: { businessId: null } })).toBe(true);
  expect(scopeIsStale(cookie, { user, context: null })).toBe(true);
  expect(scopeIsStale(cookie, { user, context: { businessId: B1 } })).toBe(false);
  expect(scopeIsStale(`business=${B1}`, { user, context: { businessId: B1 } })).toBe(false);
  // без куки и без входа сбрасывать нечего; кривую куку стойка API не пересылает вовсе
  expect(scopeIsStale(undefined, { user, context: { businessId: null } })).toBe(false);
  expect(scopeIsStale(cookie, { user: null, context: null })).toBe(false);
  expect(scopeIsStale('garbage', { user, context: { businessId: null } })).toBe(false);
});

it('Beauty default work entry checks setup before continuing, without changing explicit calendar links', () => {
  expect(decideScope([branch('BEAUTY')], '/today')).toMatchObject({
    target: '/register/setup?entry=1',
  });
  expect(decideScope([branch('BEAUTY')], '/calendar')).toMatchObject({ target: '/calendar' });
});

// «Личный кабинет» (EMPLOYEE): рабочих разделов и выбора филиала на /branches у него нет (живой аудит 21.10.2026)
it('«Личный кабинет»: филиал выбирается сам и ведёт в «Мою работу» в любом направлении', () => {
  for (const v of ['BEAUTY', 'FOOD_SERVICE', 'HOSPITALITY'] as const)
    expect(decideScope([branch(v)], '/today', null, { personal: true })).toEqual({
      kind: 'select',
      pointer: `business=${B1};location=${L1}`,
      target: '/my-work',
    });
  // своя страница кабинета из next сохраняется
  expect(decideScope([branch('BEAUTY')], '/my-work?month=2026-10', null, { personal: true })).toMatchObject({
    target: '/my-work?month=2026-10',
  });
});

it('«Личный кабинет» в нескольких филиалах: запомненный, иначе первый назначенный, но не /branches', () => {
  const two = [branch('BEAUTY'), branch('BEAUTY', B2, L2)];
  expect(decideScope(two, null, L2, { personal: true })).toMatchObject({
    pointer: `business=${B2};location=${L2}`,
    target: '/my-work',
  });
  expect(decideScope(two, null, null, { personal: true })).toMatchObject({
    kind: 'select',
    pointer: `business=${B1};location=${L1}`,
    target: '/my-work',
  });
});
