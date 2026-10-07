import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { barOperationalFixture, type BarOperationalFixture } from '../tools/bar-operational-fixture';

describe('BAR approved replay/debt/loss contracts on real HTTP and PostgreSQL', () => {
  let f: BarOperationalFixture;
  beforeAll(async () => { f = await barOperationalFixture(); });
  afterAll(async () => { await f?.close(); });
  async function stocked() {
    const side = await f.side(), d = await f.prepare(side);
    for (const receipt of [d.r1, d.r2]) expect((await f.request(`receipts/${receipt.id}/post`, {}, d.options)).status).toBe(201);
    return { ...d, side };
  }
  async function effects(propertyId: string) {
    return {
      cash: await f.db.cashOperation.count({ where: { propertyId } }),
      movements: await f.db.barStockMovement.count({ where: { propertyId } }),
      sales: await f.db.barSale.count({ where: { propertyId } }),
      lots: await f.db.barStockLot.findMany({ where: { propertyId }, orderBy: { id: 'asc' }, select: { id: true, remainingUnits: true } }),
    };
  }
  it.each(['payment', 'write-off', 'retail', 'folio'])('T03/T06/T07 %s: lost response replay is one effect, changed payload conflicts, new intent succeeds', async kind => {
    const d = await stocked(), idempotencyKey = randomUUID();
    const path = kind === 'payment' ? `receipts/${d.r1.id}/payments` : kind === 'write-off' ? 'write-offs' : `sales/${kind}`;
    const input = kind === 'payment' ? { amountMinor: '10000', method: 'CASH', idempotencyKey }
      : { productId: d.a.id, quantityUnits: '1', reason: 'Synthetic replay', method: 'CASH', folioId: d.side.folio, idempotencyKey };
    const first = await f.request(path, input, d.options);
    expect(first.status).toBe(201);
    const before = await effects(d.side.property);
    const retry = await f.request(path, input, d.options);
    expect(retry.body.id).toBe(first.body.id);
    expect(await effects(d.side.property)).toEqual(before);
    const conflict = await f.request(path, { ...input, ...(kind === 'payment' ? { amountMinor: '20000' } : { quantityUnits: '2' }) }, d.options);
    expect(conflict.status).toBe(409);
    expect(await effects(d.side.property)).toEqual(before);
    const second = await f.request(path, { ...input, idempotencyKey: randomUUID() }, d.options);
    expect(second.status).toBe(201);
    expect(second.body.id).not.toBe(first.body.id);
  });
  it('T10 linked Finance void restores debt and replay returns VOIDED without paying again', async () => {
    const d = await stocked(), body = { amountMinor: '60000', method: 'CASH', idempotencyKey: randomUUID() };
    const payment = await f.request(`receipts/${d.r1.id}/payments`, body, d.options);
    const stored = await f.db.barSupplierPayment.findUniqueOrThrow({ where: { id: payment.body.id } });
    expect((await f.request(`/finance/cash/operations/${stored.cashOperationId}/void`, {}, d.options)).status).toBe(200);
    expect((await f.request('report', undefined, d.options)).body).toMatchObject({ supplierPaidMinor: '0', supplierDebtMinor: '280000', stockCostMinor: '280000' });
    const before = await effects(d.side.property);
    expect((await f.request(`receipts/${d.r1.id}/payments`, body, d.options)).body).toMatchObject({ id: payment.body.id, status: 'VOIDED' });
    expect(await effects(d.side.property)).toEqual(before);
    expect((await f.request(`/finance/cash/operations/${stored.cashOperationId}/void`, {}, d.options)).status).toBe(409);
  });
  it('T10 no-restock loss retains FIFO cost once without a second warehouse decrement', async () => {
    const d = await stocked();
    const sale = await f.request('sales/retail', { productId: d.a.id, quantityUnits: '12', method: 'CASH', idempotencyKey: randomUUID() }, d.options);
    expect((await f.request(`sales/${sale.body.id}/reverse`, { restock: false, reason: 'Spoiled synthetic goods' }, d.options)).status).toBe(201);
    expect((await f.request('report', undefined, d.options)).body).toMatchObject({ nonRestockedLossMinor: '132000', costMinor: '0', writeOffMinor: '0', stockCostMinor: '148000' });
    const before = await effects(d.side.property);
    expect((await f.request(`sales/${sale.body.id}/reverse`, { restock: false, reason: 'Repeat' }, d.options)).status).toBe(409);
    expect(await effects(d.side.property)).toEqual(before);
  });

  it.each(['payment', 'write-off', 'retail', 'folio'])('T05 %s same-key concurrent requests serialize to one effect, persisted replay survives a new API instance', async kind => {
    const d = await stocked(), idempotencyKey = randomUUID();
    const path = kind === 'payment' ? `receipts/${d.r1.id}/payments` : kind === 'write-off' ? 'write-offs' : `sales/${kind}`;
    const input = kind === 'payment' ? { amountMinor: '10000', method: 'CASH', idempotencyKey }
      : { productId: d.a.id, quantityUnits: '1', reason: 'Synthetic concurrent replay', method: 'CASH', folioId: d.side.folio, idempotencyKey };
    const dbKind = kind === 'payment' ? 'SUPPLIER_PAYMENT' : kind === 'write-off' ? 'WRITE_OFF' : kind.toUpperCase();
    const namespace = dbKind;
    const barrier = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await barrier.connect();
    const pending: Array<Promise<Awaited<ReturnType<typeof f.request>>>> = [];
    try {
      await barrier.query('BEGIN');
      await barrier.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`${d.side.property}:${namespace}:${idempotencyKey}`]);
      pending.push(f.request(path, input, d.options), f.request(path, input, d.options));
      let waiting = 0;
      const deadline = Date.now() + 2000;
      while (Date.now() < deadline) {
        await barrier.query('SELECT pg_stat_clear_snapshot()');
        const result = await barrier.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event='advisory' AND query LIKE '%pg_advisory_xact_lock%'");
        waiting = result.rows[0].n;
        if (waiting >= 2) break;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(waiting, 'both requests observed at the PostgreSQL advisory barrier').toBeGreaterThanOrEqual(2);
      await barrier.query('COMMIT');
      const responses = await Promise.all(pending);
      expect(responses.map(row => row.status)).toEqual([201,201]);
      expect(responses[0].body.id).toBe(responses[1].body.id);
      expect(await f.db.barOperationIntent.count({ where: { propertyId: d.side.property, kind: dbKind, key: idempotencyKey } })).toBe(1);
      const before = await effects(d.side.property);
      await f.restart();
      expect((await f.request(path, input, d.options)).body.id).toBe(responses[0].body.id);
      expect(await effects(d.side.property)).toEqual(before);
    } finally { await barrier.query('ROLLBACK'); await Promise.allSettled(pending); await barrier.end(); }
  });
  it.each(['payment', 'write-off', 'retail', 'folio'])('T02 %s registry failure rolls back all ledger effects and the original key remains retryable', async kind => {
    const d = await stocked(), idempotencyKey = randomUUID(), name = `bar_test_abort_${randomUUID().replaceAll('-', '')}`;
    const path = kind === 'payment' ? `receipts/${d.r1.id}/payments` : kind === 'write-off' ? 'write-offs' : `sales/${kind}`;
    const input = kind === 'payment' ? { amountMinor: '10000', method: 'CASH', idempotencyKey }
      : { productId: d.a.id, quantityUnits: '1', method: 'CASH', reason: 'Synthetic rollback', folioId: d.side.folio, idempotencyKey };
    const before = await effects(d.side.property);
    await f.db.$executeRawUnsafe(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql SET search_path = pms_test, public, pg_temp AS $$ BEGIN IF NEW.key='${idempotencyKey}' THEN RAISE EXCEPTION 'Synthetic atomic rollback'; END IF; RETURN NEW; END $$`);
    await f.db.$executeRawUnsafe(`CREATE TRIGGER ${name} AFTER INSERT ON bar_operation_intents FOR EACH ROW EXECUTE FUNCTION ${name}()`);
    try {
      expect((await f.request(path, input, d.options)).status).toBe(500);
      expect(await effects(d.side.property)).toEqual(before);
      expect(await f.db.barOperationIntent.count({ where: { key: idempotencyKey } })).toBe(0);
    } finally {
      await f.db.$executeRawUnsafe(`DROP TRIGGER ${name} ON bar_operation_intents`);
      await f.db.$executeRawUnsafe(`DROP FUNCTION ${name}()`);
    }
    expect((await f.request(path, input, d.options)).status).toBe(201);
    expect(await f.db.barOperationIntent.count({ where: { key: idempotencyKey } })).toBe(1);
  });
  it.each(['payment', 'write-off', 'retail', 'folio'])('T04 %s client abort before late commit preserves one retry result', async kind => {
    const d = await stocked(), idempotencyKey = randomUUID();
    const path = kind === 'payment' ? `receipts/${d.r1.id}/payments` : kind === 'write-off' ? 'write-offs' : `sales/${kind}`;
    const input = kind === 'payment' ? { amountMinor: '10000', method: 'CASH', idempotencyKey }
      : { productId: d.a.id, quantityUnits: '1', reason: 'Synthetic late commit', method: 'CASH', folioId: d.side.folio, idempotencyKey };
    const dbKind = kind === 'payment' ? 'SUPPLIER_PAYMENT' : kind === 'write-off' ? 'WRITE_OFF' : kind.toUpperCase();
    const barrier = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await barrier.connect();
    const controller = new AbortController();
    const pending: Array<Promise<unknown>> = [];
    const before = await effects(d.side.property);
    async function waitForRequests(n: number) {
      const deadline = Date.now() + 2000;
      while (Date.now() < deadline) {
        await barrier.query('SELECT pg_stat_clear_snapshot()');
        const result = await barrier.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event='advisory' AND query LIKE '%pg_advisory_xact_lock%'");
        if (result.rows[0].n >= n) return;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      throw new Error('Expected requests not observed at the real database barrier');
    }
    try {
      await barrier.query('BEGIN');
      await barrier.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`${d.side.property}:${dbKind}:${idempotencyKey}`]);
      const first = f.request(path, input, { ...d.options, signal: controller.signal }).then(() => 'response', () => 'aborted');
      pending.push(first);
      await waitForRequests(1);
      controller.abort();
      expect(await first).toBe('aborted');
      expect(await effects(d.side.property)).toEqual(before);
      const retry = f.request(path, input, d.options);
      pending.push(retry);
      await waitForRequests(2);
      await barrier.query('COMMIT');
      const result = await retry;
      expect(result.status).toBe(201);
      const intent = await f.db.barOperationIntent.findUniqueOrThrow({ where: { propertyId_kind_key: { propertyId: d.side.property, kind: dbKind, key: idempotencyKey } } });
      expect(intent.operationId).toBe(result.body.id);
      const after = await effects(d.side.property);
      expect((await f.request(path, input, d.options)).body.id).toBe(result.body.id);
      expect(await effects(d.side.property)).toEqual(after);
      expect(await f.db.barOperationIntent.count({ where: { propertyId: d.side.property, kind: dbKind, key: idempotencyKey } })).toBe(1);
    } finally { controller.abort(); await barrier.query('ROLLBACK'); await Promise.allSettled(pending); await barrier.end(); }
  });
  it('T01 operation kind scopes keys independently for RETAIL and FOLIO in one Property', async () => {
    const d = await stocked(), idempotencyKey = randomUUID();
    const retail = await f.request('sales/retail', { productId: d.a.id, quantityUnits: '1', method: 'CASH', idempotencyKey }, d.options);
    const folio = await f.request('sales/folio', { productId: d.a.id, quantityUnits: '1', folioId: d.side.folio, idempotencyKey }, d.options);
    expect(retail.status).toBe(201);
    expect(folio.status).toBe(201);
    expect(folio.body.id).not.toBe(retail.body.id);
    expect(await f.db.barOperationIntent.count({ where: { propertyId: d.side.property, key: idempotencyKey } })).toBe(2);
  });
});
