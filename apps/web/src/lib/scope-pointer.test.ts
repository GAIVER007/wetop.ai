import { describe, expect, it } from 'vitest';
import { SCOPE_COOKIE, scopeHeader } from './scope-pointer';

/**
 * Platform P2, К1 (план P2 §4б, ADR-120): кука стойки `wetop_scope` — только указатель выбора. Стойка пересылает её
 * API заголовком `X-Wetop-Scope` как есть; проверяет указатель API, на каждом запросе. Ставит куку переключатель P3.
 */
const B = '11111111-1111-4111-8111-111111111111';
const L = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('указатель выбора: кука → заголовок', () => {
  it('имя куки своё, не кука сессии', () => {
    expect(SCOPE_COOKIE).toBe('wetop_scope');
  });

  it('куки нет — заголовка нет', () => {
    expect(scopeHeader(undefined)).toEqual({});
    expect(scopeHeader('')).toEqual({});
  });

  it('кука в URL-кодировке и без неё — один и тот же заголовок', () => {
    const plain = `business=${B};location=${L}`;
    expect(scopeHeader(encodeURIComponent(plain))).toEqual({ 'x-wetop-scope': plain });
    expect(scopeHeader(plain)).toEqual({ 'x-wetop-scope': plain });
  });

  it('битая кодировка или слишком длинное значение — заголовка нет', () => {
    expect(scopeHeader('%E0%A4%A')).toEqual({});
    expect(scopeHeader('x'.repeat(201))).toEqual({});
  });
});
