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

it('next чужого направления заменяется стартовой страницей направления', () => {
  expect(decideScope([branch('HOSPITALITY')], '/calendar')).toMatchObject({ target: '/today' });
  expect(decideScope([branch('FOOD_SERVICE')], '/today')).toMatchObject({
    target: '/register/setup',
  });
  expect(decideScope([branch('BEAUTY')], '/floor-plan')).toMatchObject({
    target: '/register/setup',
  });
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
  for (const next of ['//evil.invalid', 'https://evil.invalid/today', '/login', null, '/\\evil'])
    expect(decideScope([branch('HOSPITALITY')], next)).toMatchObject({ target: '/today' });
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
