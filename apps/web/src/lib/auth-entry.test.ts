import { describe, expect, it } from 'vitest';
import { publicAuthUrl, safeReturnPath } from './auth-entry';

describe('безопасный возврат после входа', () => {
  it('сохраняет рабочий путь и фильтры', () => {
    expect(safeReturnPath('/journal?page=2')).toBe('/journal?page=2');
  });
  it.each([
    'https://evil.invalid',
    '//evil.invalid',
    '/\\evil.invalid',
    '/%5cevil.invalid',
    '/login',
    '/login/verify?token=secret',
    '/register',
    '/api/site-auth/login',
    '/today/../login',
    '/invite/token',
    '',
    undefined,
  ])('не допускает цикл или внешний адрес: %s', (path) => {
    expect(safeReturnPath(path)).toBe('/today');
  });
  it('адрес главной берётся только из конфигурации, не из next', () => {
    expect(
      publicAuthUrl('register', '//evil.invalid', { WETOP_SITE_URL: 'https://wetop.ai' }),
    ).toBe('https://wetop.ai/?next=%2Ftoday#register');
  });
});
