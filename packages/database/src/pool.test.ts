import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { DATABASE_POOL_DEFAULTS, databasePoolTimeouts } from './pool';

/**
 * Сроки пула читаются из окружения каждого процесса (ADR-043). Поведение на мёртвом соединении —
 * в `pool-timeouts.test.ts`; здесь — что значат переменные и что будет, если их нет или они с ошибкой.
 */
describe('databasePoolTimeouts', () => {
  it('без переменных — безопасные значения по умолчанию, все три защиты включены', () => {
    const t = databasePoolTimeouts({});
    expect(t.connectionTimeoutMillis).toBe(DATABASE_POOL_DEFAULTS.connectTimeoutMs);
    expect(t.keepAlive).toBe(true);
    expect(t.keepAliveInitialDelayMillis).toBe(DATABASE_POOL_DEFAULTS.keepAliveDelayMs);
    expect(t.Client).toBeDefined();
    expect(t.Client!.prototype).toBeInstanceOf(pg.Client);
  });

  it('значения из переменных', () => {
    const t = databasePoolTimeouts({
      DATABASE_CONNECT_TIMEOUT_MS: '5000',
      DATABASE_QUERY_TIMEOUT_MS: '120000',
      DATABASE_KEEPALIVE_DELAY_MS: ' 2000 ',
    });
    expect(t.connectionTimeoutMillis).toBe(5000);
    expect(t.keepAliveInitialDelayMillis).toBe(2000);
    expect(t.Client).toBeDefined();
  });

  it('0 выключает защиту явно: для разовой долгой операции, не по умолчанию', () => {
    const t = databasePoolTimeouts({
      DATABASE_CONNECT_TIMEOUT_MS: '0',
      DATABASE_QUERY_TIMEOUT_MS: '0',
      DATABASE_KEEPALIVE_DELAY_MS: '0',
    });
    expect(t.connectionTimeoutMillis).toBe(0);
    expect(t.Client).toBeUndefined();
    expect(t.keepAlive).toBe(false);
    expect(t.keepAliveInitialDelayMillis).toBeUndefined();
  });

  it('пусто, дробь, минус, единицы измерения — значение по умолчанию, а не выключенная защита', () => {
    for (const bad of ['', '   ', '30s', '-1', '1.5', 'abc', '1e4']) {
      const t = databasePoolTimeouts({
        DATABASE_CONNECT_TIMEOUT_MS: bad,
        DATABASE_QUERY_TIMEOUT_MS: bad,
        DATABASE_KEEPALIVE_DELAY_MS: bad,
      });
      expect(t.connectionTimeoutMillis, bad).toBe(DATABASE_POOL_DEFAULTS.connectTimeoutMs);
      expect(t.Client, bad).toBeDefined();
      expect(t.keepAliveInitialDelayMillis, bad).toBe(DATABASE_POOL_DEFAULTS.keepAliveDelayMs);
    }
  });
});
