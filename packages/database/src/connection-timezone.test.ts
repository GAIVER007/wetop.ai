import { EventEmitter } from 'node:events';
import pg from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { SchemaCheckedPool, utcConnectionString } from './connection-timezone';
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
    ).toBe('-c search_path=public -c timezone=Asia/Dubai -c timezone=UTC'));
  it('keeps schema together with environment startup options', () =>
    expect(
      options(
        utcConnectionString(
          'postgresql://localhost/db',
          '-c search_path=pms_test,public',
          '-c statement_timeout=500',
        ),
      ),
    ).toBe('-c search_path=pms_test,public -c statement_timeout=500 -c timezone=UTC'));
  it('keeps URL options ahead of environment fallback', () =>
    expect(
      options(
        utcConnectionString(
          'postgresql://localhost/db?options=-c%20statement_timeout=250',
          '-c search_path=pms_test,public',
          '-c statement_timeout=500',
        ),
      ),
    ).toBe('-c search_path=pms_test,public -c statement_timeout=250 -c timezone=UTC'));
  it('keeps environment fallback for empty URL options', () =>
    expect(
      options(
        utcConnectionString(
          'postgresql://localhost/db?options=',
          '-c search_path=public',
          '-c statement_timeout=500',
        ),
      ),
    ).toBe('-c search_path=public -c statement_timeout=500 -c timezone=UTC'));
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
  it('rejects a URL search_path that conflicts with the selected schema', () =>
    expect(() =>
      utcConnectionString(
        'postgresql://localhost/db?options=-c%20search_path=other,public',
        '-c search_path=pms_test,public',
        '',
      ),
    ).toThrow('Database startup options contain conflicting search_path values'));
  it('rejects a PGOPTIONS search_path that conflicts with the selected schema', () =>
    expect(() =>
      utcConnectionString(
        'postgresql://localhost/db',
        '-c search_path=pms_test,public',
        '-c search_path=other,public',
      ),
    ).toThrow('Database startup options contain conflicting search_path values'));
  it('rejects a conflicting long-form search-path option', () =>
    expect(() =>
      utcConnectionString(
        'postgresql://localhost/db?options=--search-path%3Dother%2Cpublic',
        '-c search_path=pms_test,public',
        '',
      ),
    ).toThrow('Database startup options contain conflicting search_path values'));
  it('rejects quoted search_path syntax unsupported by PostgreSQL startup options', () =>
    expect(() =>
      utcConnectionString(
        'postgresql://localhost/db',
        '-c search_path=pms_test,public',
        `-c "search_path=pms_test, public" -c statement_timeout=500`,
      ),
    ).toThrow('Database startup options contain an ambiguous search_path setting'));
  it('rejects ambiguous search_path syntax instead of silently choosing', () =>
    expect(() =>
      utcConnectionString(
        'postgresql://localhost/db',
        '-c search_path=pms_test,public',
        '-c search_path other,public',
      ),
    ).toThrow('Database startup options contain an ambiguous search_path setting'));
  it('does not expose malformed input', () =>
    expect(() => utcConnectionString('invalid-secret', undefined)).toThrow(
      'Database connection must use a PostgreSQL URL',
    ));
});

class FakePool extends EventEmitter {
  readonly end = vi.fn(async () => undefined);

  constructor(private readonly client: pg.PoolClient) {
    super();
  }

  async connect(): Promise<pg.PoolClient> {
    return this.client;
  }
}

const checkedClient = (query: pg.PoolClient['query'], release = vi.fn()) =>
  ({ query, release }) as unknown as pg.PoolClient;

describe('schema checked pool compatibility with pg', () => {
  it('releases the client and calls back once when callback query dispatch throws synchronously', async () => {
    const dispatchError = new Error('A29 synchronous query dispatch');
    const release = vi.fn();
    let queryCount = 0;
    const client = checkedClient(
      vi.fn(() => {
        queryCount += 1;
        if (queryCount === 1)
          return Promise.resolve({
            rows: [{ exists: true, usable: true, currentSchema: 'a29_test' }],
          });
        throw dispatchError;
      }) as unknown as pg.PoolClient['query'],
      release,
    );
    const underlying = new FakePool(client);
    const pool = new SchemaCheckedPool(underlying as unknown as pg.Pool, 'a29_test');
    const callback = vi.fn();

    pool.query('SELECT broken', callback);
    await new Promise((resolve) => setImmediate(resolve));

    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith(dispatchError, undefined);
    expect(release).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledWith(dispatchError);
    await pool.end();
  });

  it('forwards idle client errors and removes the forwarding listener on end', async () => {
    const client = checkedClient(vi.fn() as pg.PoolClient['query']);
    const underlying = new FakePool(client);
    const pool = new SchemaCheckedPool(underlying as unknown as pg.Pool, 'a29_test');
    const forwarded = vi.fn();
    const idleError = new Error('A29 idle client failure');
    pool.on('error', forwarded);

    expect(underlying.listenerCount('error')).toBe(1);
    expect(() => underlying.emit('error', idleError, client)).not.toThrow();
    expect(forwarded).toHaveBeenCalledOnce();
    expect(forwarded).toHaveBeenCalledWith(idleError, client);

    await pool.end();
    expect(underlying.listenerCount('error')).toBe(0);
  });
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
