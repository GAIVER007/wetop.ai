import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertPortalDatabase } from '../employee-portal-ui/fixture-support';

beforeEach(() => {
  vi.stubEnv('CI', '');
  vi.stubEnv('GITHUB_ACTIONS', '');
  vi.stubEnv('NODE_ENV', 'test');
});
afterEach(() => vi.unstubAllEnvs());

describe('portal fixture isolation', () => {
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
