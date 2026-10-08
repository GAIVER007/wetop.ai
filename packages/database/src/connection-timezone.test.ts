import { describe, expect, it } from 'vitest';
import { utcConnectionString } from './connection-timezone';
const options = (url: string) => new URL(url).searchParams.get('options');
describe('UTC startup options', () => {
  it('preserves schema before setting UTC', () =>
    expect(
      options(
        utcConnectionString('postgresql://localhost/db', '-c search_path=pms_test,public', ''),
      ),
    ).toBe('-c search_path=pms_test,public -c timezone=UTC'));
  it('preserves the effective last URL options and overrides its timezone', () =>
    expect(
      options(
        utcConnectionString(
          'postgresql://localhost/db?options=-c%20x=1&options=-c%20timezone=Asia/Dubai',
          '-c search_path=public',
          '',
        ),
      ),
    ).toBe('-c timezone=Asia/Dubai -c timezone=UTC'));
  it('keeps environment fallback for empty URL options', () =>
    expect(
      options(
        utcConnectionString(
          'postgresql://localhost/db?options=',
          '-c search_path=public',
          '-c statement_timeout=500',
        ),
      ),
    ).toBe('-c statement_timeout=500 -c timezone=UTC'));
  it('preserves SSL and other URL parameters', () =>
    expect(
      new URL(
        utcConnectionString(
          'postgresql://localhost/db?sslmode=require&application_name=a26',
          undefined,
          '',
        ),
      ).searchParams.get('sslmode'),
    ).toBe('require'));
  it('does not expose malformed input', () =>
    expect(() => utcConnectionString('invalid-secret', undefined)).toThrow(
      'Database connection must use a PostgreSQL URL',
    ));
});

import { sessionExpiry } from '../../domain/src/accounts/session';
import { checkSession } from '../../domain/src/accounts/session';
describe('absolute expiry boundary', () => {
  const expiresAt = new Date('2026-07-15T12:34:56.789Z');
  it.each([-1, 0, 1])('checks now at expiry %+i ms', (offset) => {
    expect(
      checkSession({ expiresAt, revokedAt: null }, new Date(expiresAt.getTime() + offset)).ok,
    ).toBe(offset < 0);
  });
});

it('retains the exact 12 hour password TTL', () => {
  const now = new Date('2026-01-15T12:34:56.789Z');
  expect(sessionExpiry(now).getTime() - now.getTime()).toBe(12 * 3600 * 1000);
});
