import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { barOperationalFixture, type BarOperationalFixture } from '../tools/bar-operational-fixture';

const tables = ['bar_operation_intents','bar_supplier_payment_reversals','bar_cost_losses'] as const;
describe('BAR financial records: populated FORCE RLS and ownership under app/service', () => {
  let f: BarOperationalFixture, client: pg.Client;
  let a: Awaited<ReturnType<BarOperationalFixture['side']>>, b: typeof a;
  beforeAll(async () => {
    f = await barOperationalFixture();
    client = new pg.Client({ connectionString: process.env.DATABASE_URL, options: '-c search_path=pms_test,public' });
    await client.connect();
    a = await f.side(); b = await f.side();
    for (const side of [a,b]) {
      const d = await f.prepare(side);
      expect((await f.request(`receipts/${d.r1.id}/post`, {}, d.options)).status).toBe(201);
      const sale = await f.request('sales/retail', { productId: d.a.id, quantityUnits: '1', method: 'CASH', idempotencyKey: randomUUID() }, d.options);
      expect((await f.request(`sales/${sale.body.id}/reverse`, { restock: false, reason: 'Synthetic RLS loss' }, d.options)).status).toBe(201);
      const payment = await f.request(`receipts/${d.r1.id}/payments`, { amountMinor: '100', method: 'CASH', idempotencyKey: randomUUID() }, d.options);
      const original = await f.db.barSupplierPayment.findUniqueOrThrow({ where: { id: payment.body.id } });
      expect((await f.request(`/finance/cash/operations/${original.cashOperationId}/void`, {}, d.options)).status).toBe(200);
    }
  });
  afterAll(async () => { await client?.end(); await f?.close(); });
  it.each(['A','B','unset','empty','service'])('populated profile %s returns the expected complete record set', async profile => {
    await client.query('BEGIN');
    try {
      await client.query(`SET LOCAL ROLE ${profile === 'service' ? 'wetop_service' : 'wetop_app'}`);
      if (profile !== 'unset') await client.query("SELECT set_config('app.org_id',$1,true)", [profile === 'A' ? a.org : profile === 'B' ? b.org : '']);
      else await client.query('RESET app.org_id');
      const expected = profile === 'A' ? [a.property] : profile === 'B' ? [b.property] : profile === 'service' ? [a.property,b.property].sort() : [];
      for (const table of tables) {
        const rows = await client.query(`SELECT DISTINCT property_id::text FROM ${table} WHERE property_id=ANY($1::uuid[]) ORDER BY property_id::text`, [[a.property,b.property]]);
        expect(rows.rows.map(row => row.property_id), `${profile}/${table}`).toEqual(expected);
        const flags = await client.query('SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid=$1::regclass', [table]);
        expect(flags.rows[0]).toEqual({ relrowsecurity: true, relforcerowsecurity: true });
      }
    } finally { await client.query('ROLLBACK'); }
  });
  it.each(['wetop_app','wetop_service'])('%s cannot delete durable financial evidence', async role => {
    for (const table of tables) {
      await client.query('BEGIN');
      try {
        await client.query(`SET LOCAL ROLE ${role}`);
        await client.query("SELECT set_config('app.org_id',$1,true)", [a.org]);
        await expect(client.query(`DELETE FROM ${table} WHERE property_id=$1`, [a.property])).rejects.toThrow(/permission denied/);
      } finally { await client.query('ROLLBACK'); }
    }
  });
  it.each(['wetop_app','wetop_service'])('%s accepts own links, rejects foreign links and immutable record updates without uniqueness masking', async role => {
    for (const table of tables) {
      const own = (await client.query(`SELECT * FROM ${table} WHERE property_id=$1 ORDER BY id LIMIT 1`, [a.property])).rows[0];
      const foreign = (await client.query(`SELECT * FROM ${table} WHERE property_id=$1 ORDER BY id LIMIT 1`, [b.property])).rows[0];
      expect(own).toBeDefined(); expect(foreign).toBeDefined();
      for (const source of [own,foreign]) {
        await client.query('BEGIN');
        try {
          // Delete the derived fixture row only inside this rollback transaction,
          // so the test reaches ownership validation rather than a unique constraint.
          if (table !== 'bar_operation_intents') await client.query(`DELETE FROM ${table} WHERE id=$1`, [source.id]);
          await client.query(`SET LOCAL ROLE ${role}`);
          await client.query("SELECT set_config('app.org_id',$1,true)", [a.org]);
          let insert: Promise<pg.QueryResult>;
          if (table === 'bar_operation_intents') insert = client.query(`INSERT INTO ${table}(property_id,kind,key,request,result,operation_id) VALUES($1,$2,$3,$4,$5,$6)`, [a.property,source.kind,randomUUID(),source.request,source.result,source.operation_id]);
          else if (table === 'bar_cost_losses') insert = client.query(`INSERT INTO ${table}(property_id,sale_id,amount_minor,reason) VALUES($1,$2,$3,$4)`, [a.property,source.sale_id,source.amount_minor,'Synthetic ownership proof']);
          else insert = client.query(`INSERT INTO ${table}(property_id,payment_id,amount_minor) VALUES($1,$2,$3)`, [a.property,source.payment_id,source.amount_minor]);
          if (source === own) {
            await insert;
            await expect(client.query(`UPDATE ${table} SET property_id=property_id WHERE property_id=$1`, [a.property])).rejects.toThrow('immutable');
          } else await expect(insert).rejects.toThrow(/ownership/);
        } finally { await client.query('ROLLBACK'); }
      }
    }
  });
});
