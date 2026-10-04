import { describe, expect, it } from 'vitest';
import { defaultLandingFor, landingPath, publicAuthUrl, safeReturnPath } from './auth-entry';

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

describe('посадочная страница после входа без явного next (ADR-146)', () => {
  it.each([
    ['OWNER', '/today'],
    ['MANAGER', '/chessboard'],
    ['STAFF', '/chessboard'],
  ] as const)('роль %s ведёт на %s', (role, expected) => {
    expect(defaultLandingFor(role)).toBe(expected);
  });
  it('роль не пришла или незнакома, считаем администратором, идёт на Календарь', () => {
    expect(defaultLandingFor(undefined)).toBe('/chessboard');
    expect(defaultLandingFor(null)).toBe('/chessboard');
    expect(defaultLandingFor('')).toBe('/chessboard');
  });
});

describe('landingPath: явный адрес побеждает, иначе роль решает (ADR-146)', () => {
  it('пустой, null или отсутствующий next решает роль', () => {
    expect(landingPath('', 'OWNER')).toBe('/today');
    expect(landingPath(null, 'MANAGER')).toBe('/chessboard');
    expect(landingPath(undefined, 'STAFF')).toBe('/chessboard');
  });
  it('явный рабочий адрес уважается независимо от роли', () => {
    expect(landingPath('/guests', 'OWNER')).toBe('/guests');
    expect(landingPath('/guests?state=inhouse', 'MANAGER')).toBe('/guests?state=inhouse');
  });
  it('явный, но недопустимый адрес падает на безопасный умолчальный, не на Главную по умолчанию', () => {
    expect(landingPath('//evil.invalid', 'MANAGER')).toBe('/today');
  });
});
