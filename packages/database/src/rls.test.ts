import { describe, expect, it } from 'vitest';
import pg from 'pg';
import { TenantPool } from './rls';

/**
 * Пул RLS (DATA_MODEL §17.2, ADR-103): запрос организации — в пул `wetop_app` с её переменной, служебный — в служебный
 * пул с пустой. Переменная ставится при каждой выдаче соединения, если отличается: соединение не уносит чужую
 * организацию в следующий запрос.
 */
class FakeClient {
  queries: Array<{ text: string; values?: unknown[] }> = [];
  released = 0;
  wetopOrg?: string;
  constructor(readonly pool: string) {}
  async query(config: string | { text: string }, values?: unknown[]) {
    const text = typeof config === 'string' ? config : config.text;
    this.queries.push({ text, ...(values ? { values } : {}) });
    return { rows: [], fields: [], rowCount: 0 };
  }
  release() {
    this.released += 1;
  }
}

function fakePool(name: string) {
  const client = new FakeClient(name);
  const pool = { connect: async () => client, end: async () => undefined } as unknown as pg.Pool;
  return { pool, client };
}

const ORG_A = '5d2f1a9e-8c7b-4e3a-a1f0-6b9c2d4e8f00';
const ORG_B = '0b6c3c1e-4f4e-4a53-9b7e-2f1d7a9c0a11';
const setConfig = (c: FakeClient) => c.queries.filter((q) => q.text.includes("set_config('app.org_id'"));

describe('TenantPool', () => {
  it('запрос организации — в пул роли wetop_app с её переменной; служебный — в служебный с пустой', async () => {
    const app = fakePool('app');
    const service = fakePool('service');
    let tenant: string | null = ORG_A;
    const pool = new TenantPool(service.pool, app.pool, () => tenant);

    await pool.query({ text: 'SELECT 1' });
    expect(app.client.queries.map((q) => q.text)).toEqual([
      "SELECT set_config('app.org_id', $1, false)",
      'SELECT 1',
    ]);
    expect(setConfig(app.client)[0]!.values).toEqual([ORG_A]);
    expect(app.client.released).toBe(1);

    tenant = null;
    await pool.query({ text: 'SELECT 2' });
    expect(service.client.queries.map((q) => q.text)).toEqual([
      "SELECT set_config('app.org_id', $1, false)",
      'SELECT 2',
    ]);
    expect(setConfig(service.client)[0]!.values).toEqual(['']);
  });

  it('переменная ставится заново, только если организация сменилась', async () => {
    const app = fakePool('app');
    const service = fakePool('service');
    let tenant: string | null = ORG_A;
    const pool = new TenantPool(service.pool, app.pool, () => tenant);
    await pool.query({ text: 'q1' });
    await pool.query({ text: 'q2' });
    tenant = ORG_B;
    await pool.query({ text: 'q3' });
    expect(setConfig(app.client).map((q) => q.values)).toEqual([[ORG_A], [ORG_B]]);
  });

  it('транзакция: соединение выдаётся с переменной организации и остаётся за ней до release', async () => {
    const app = fakePool('app');
    const service = fakePool('service');
    const pool = new TenantPool(service.pool, app.pool, () => ORG_B);
    const client = await pool.connect();
    expect((client as unknown as FakeClient).pool).toBe('app');
    expect(setConfig(app.client)[0]!.values).toEqual([ORG_B]);
  });

  it('не uuid в контексте — пустая переменная: у wetop_app ни одной строки, а не ошибка разбора', async () => {
    const app = fakePool('app');
    const service = fakePool('service');
    const pool = new TenantPool(service.pool, app.pool, () => "x'; DROP TABLE guests; --");
    await pool.query({ text: 'SELECT 1' });
    expect(setConfig(app.client)[0]!.values).toEqual(['']);
  });

  it('один пул на обе дороги (до переключения ролей) — соединение не уносит организацию прошлого запроса', async () => {
    const shared = fakePool('shared');
    let tenant: string | null = ORG_A;
    const pool = new TenantPool(shared.pool, shared.pool, () => tenant);
    await pool.query({ text: 'desk' });
    tenant = null;
    await pool.query({ text: 'worker' });
    expect(setConfig(shared.client).map((q) => q.values)).toEqual([[ORG_A], ['']]);
  });
});
