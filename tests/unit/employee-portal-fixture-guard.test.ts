import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertPortalDatabase } from '../employee-portal-ui/fixture-support';

beforeEach(() => {
  vi.stubEnv('CI', '');
  vi.stubEnv('GITHUB_ACTIONS', '');
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('PMS_PORTAL_FIXTURE', '');
});
afterEach(() => vi.unstubAllEnvs());

describe('portal fixture isolation', () => {
  it('accepts the explicitly provisioned canonical integration fixture', () => {
    const url = 'postgresql://owner_home_test@127.0.0.1:55516/wetop_owner_home';
    vi.stubEnv('DATABASE_URL', url);
    vi.stubEnv('CI', 'true'); vi.stubEnv('GITHUB_ACTIONS', 'true');
    vi.stubEnv('PMS_PORTAL_FIXTURE', 'owner-home-ci');
    expect(assertPortalDatabase()).toBe(url);
  });
  it.each([
    ['postgresql://owner_home_test@127.0.0.1:55516/wetop_owner_home', ''],
    ['postgresql://postgres@127.0.0.1:55516/wetop_owner_home', 'owner-home-ci'],
    ['postgresql://owner_home_test@127.0.0.1:55517/wetop_owner_home', 'owner-home-ci'],
    ['postgresql://owner_home_test@127.0.0.1:55516/production', 'owner-home-ci'],
    ['postgresql://owner_home_test@db.supabase.co:55516/wetop_owner_home', 'owner-home-ci'],
    ['postgresql://owner_home_test@127.0.0.1:55516/wetop_owner_home?schema=public', 'owner-home-ci'],
  ])('rejects a mismatched canonical fixture %#', (url, marker) => {
    vi.stubEnv('DATABASE_URL', url);
    vi.stubEnv('CI', 'true'); vi.stubEnv('GITHUB_ACTIONS', 'true');
    vi.stubEnv('PMS_PORTAL_FIXTURE', marker);
    expect(() => assertPortalDatabase()).toThrow();
  });
  it('preserves the separate public booking local runner without granting portal access', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://postgres@127.0.0.1:55623/pmslocal');
    expect(() => assertPortalDatabase()).toThrow();
    expect(assertPortalDatabase('public-booking')).toBe(process.env.DATABASE_URL);
  });
  it.each(['', 'false'])('requires both CI markers for canonical fixtures (%s)', ci => {
    vi.stubEnv('DATABASE_URL', 'postgresql://owner_home_test@127.0.0.1:55516/wetop_owner_home');
    vi.stubEnv('CI', ci); vi.stubEnv('GITHUB_ACTIONS', 'true');
    vi.stubEnv('PMS_PORTAL_FIXTURE', 'owner-home-ci');
    expect(() => assertPortalDatabase()).toThrow();
  });
  it.each(['55603', '55613'])('accepts the explicitly owned portal cluster %s', port => {
    const url = `postgresql://postgres@127.0.0.1:${port}/pmslocal`;
    vi.stubEnv('DATABASE_URL', url);
    expect(assertPortalDatabase()).toBe(url);
  });
  it.each([
    '', 'not-a-url',
    'postgresql://postgres@db.example.invalid:55603/pmslocal',
    'postgresql://postgres@127.0.0.1:55599/pmslocal',
    'postgresql://postgres@127.0.0.1:55605/pmslocal',
    'postgresql://postgres@127.0.0.1:5432/pms_dev',
    'postgresql://postgres@127.0.0.1:55603/production',
    'postgresql://postgres@127.0.0.1:55603/pmslocal?options=search_path%3Dpublic',
    'postgresql://postgres@127.0.0.1:55603/pmslocal#production',
  ])('rejects non-owned, implicit or overridden targets %#', url => {
    vi.stubEnv('DATABASE_URL', url);
    expect(() => assertPortalDatabase()).toThrow();
  });
  it('accepts the dedicated GitHub job database only in GitHub CI', () => {
    const url = 'postgresql://postgres@127.0.0.1:5432/pms_dev';
    vi.stubEnv('DATABASE_URL', url); vi.stubEnv('CI', 'true'); vi.stubEnv('GITHUB_ACTIONS', 'true');
    expect(assertPortalDatabase()).toBe(url);
  });
  it.each([['true', ''], ['', 'true']])('does not accept a partial CI marker', (ci, github) => {
    vi.stubEnv('DATABASE_URL', 'postgresql://postgres@127.0.0.1:5432/pms_dev');
    vi.stubEnv('CI', ci); vi.stubEnv('GITHUB_ACTIONS', github);
    expect(() => assertPortalDatabase()).toThrow();
  });
  it('does not grant CI access to a remote database', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://postgres@db.example.invalid:5432/pms_dev');
    vi.stubEnv('CI', 'true'); vi.stubEnv('GITHUB_ACTIONS', 'true');
    expect(() => assertPortalDatabase()).toThrow();
  });
  it('cannot run fixtures in a production process', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://postgres@127.0.0.1:55603/pmslocal');
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => assertPortalDatabase()).toThrow();
  });
});
