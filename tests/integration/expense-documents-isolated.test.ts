import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { createPrismaClient } from '@pms/database';
import { PrismaBarRepository, type BarSupplierPaymentInput } from '../../apps/api/src/bar/bar.repository';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import pg from 'pg';
import { PrismaMarketingBudgetRepository } from '../../apps/api/src/marketing-budget/marketing-budget.repository';
import { ExpenseStore } from '../../apps/api/src/finance/expense-store';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

// Deliberately fixed dedicated local target; never falls back to DATABASE_URL or .env.
const pool = new pg.Pool({ connectionString: 'postgresql://owner_home_test@127.0.0.1:55516/wetop_owner_home', max: 2, options: '-c search_path=pms_test,public' });
const migration = 'packages/database/prisma/migrations-hold/20261016000114_expense_links/migration.sql';
let location: string, category: string, document: string;
async function source(amount = '40000', currency = 'KZT', loc = location) {
  const id = randomUUID();
  await pool.query(`INSERT INTO restaurant_cash_operations(id,location_id,kind,method,amount,currency) VALUES($1,$2,'EXPENSE','CASH',$3,$4)`, [id, loc, amount, currency]);
  return id;
}
async function link(id: string, doc = document) {
  return pool.query(`INSERT INTO expense_settlements(id,location_id,expense_document_id,restaurant_cash_operation_id) VALUES($1,$2,$3,$4)`, [randomUUID(),location,doc,id]);
}
beforeAll(async () => {
  const business = randomUUID(); location = randomUUID();
  await pool.query(`INSERT INTO businesses(id,organization_id,name,vertical,updated_at) SELECT $1,organization_id,'Synthetic','FOOD_SERVICE',now() FROM businesses LIMIT 1`,[business]);
  await pool.query(`INSERT INTO locations(id,business_id,name,timezone,currency,updated_at) VALUES($1,$2,'Synthetic','Asia/Almaty','KZT',now())`,[location,business]);
});
afterAll(async () => { await pool.end(); });
describe('expense persistence, isolated PostgreSQL', () => {
  it('applies held migration and persists document without cash debit', async () => {
    if (!(await pool.query("SELECT to_regclass('expense_documents') AS t")).rows[0].t) await pool.query(readFileSync(migration, 'utf8'));
    category = randomUUID(); document = randomUUID();
    await pool.query(`INSERT INTO expense_categories(id,location_id,code,name) VALUES($1::uuid,$2,$1::text,'Synthetic')`, [category,location]);
    const before = (await pool.query('SELECT count(*) FROM restaurant_cash_operations')).rows[0].count;
    await pool.query(`INSERT INTO expense_documents(id,location_id,category_id,title,document_date,amount_minor,currency,state) VALUES($1,$2,$3,'Synthetic',CURRENT_DATE,100000,'KZT','ACTIVE')`, [document,location,category]);
    expect((await pool.query('SELECT count(*) FROM restaurant_cash_operations')).rows[0].count).toBe(before);
  });
  it('links existing partial cash once, rejects duplicate and overpayment', async () => {
    const id = await source(); await link(id);
    await expect(link(id)).rejects.toThrow();
    await expect(link(await source('70000'))).rejects.toThrow(/overpayment/);
    expect((await pool.query('SELECT expense_paid_minor($1) AS paid',[document])).rows[0].paid).toBe('40000');
  });
  it('rejects wrong currency and non-completed sources', async () => {
    await expect(link(await source('1','USD'))).rejects.toThrow();
    const id = await source('1'); await pool.query(`UPDATE restaurant_cash_operations SET status='VOIDED',voided_at=now() WHERE id=$1`,[id]);
    await expect(link(id)).rejects.toThrow();
  });
  it('serializes concurrent links and rejects overpayment', async () => {
    const ids = await Promise.all([source('40000'),source('40000')]);
    const results = await Promise.allSettled(ids.map(id => link(id)));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect((await pool.query('SELECT expense_paid_minor($1) AS paid',[document])).rows[0].paid).toBe('80000');
  });
  it('void retains link/history, freezes amount, permits recomputed balance', async () => {
    const id = (await pool.query('SELECT restaurant_cash_operation_id AS id FROM expense_settlements WHERE expense_document_id=$1 LIMIT 1',[document])).rows[0].id;
    await pool.query(`UPDATE restaurant_cash_operations SET status='VOIDED',voided_at=now() WHERE id=$1`,[id]);
    expect((await pool.query('SELECT expense_paid_minor($1) AS paid',[document])).rows[0].paid).toBe('40000');
    await expect(pool.query('UPDATE expense_documents SET amount_minor=200000 WHERE id=$1',[document])).rejects.toThrow();
    await expect(pool.query('UPDATE restaurant_cash_operations SET amount=1 WHERE id=$1',[id])).rejects.toThrow();
    await expect(pool.query('DELETE FROM expense_settlements WHERE expense_document_id=$1',[document])).rejects.toThrow();
  });
  it('backfills supplier cash and atomically follows later legacy payments without a second debit', async () => {
    // Procurement-specific documents cannot accept generic cash without a matching supplier payment.
    const supplier = randomUUID(), receipt = randomUUID(), doc = randomUUID();
    await pool.query(`INSERT INTO bar_suppliers(id,location_id,name,updated_at) VALUES($1,$2,'Synthetic supplier',now())`,[supplier,location]);
    await pool.query(`INSERT INTO bar_receipts(id,location_id,supplier_id,document_number,document_date,received_date,currency,total_amount,updated_at) VALUES($1::uuid,$2,$3,$1::text,CURRENT_DATE,CURRENT_DATE,'KZT',100000,now())`,[receipt,location,supplier]);
    const cash = await source('40000');
    await pool.query(`INSERT INTO bar_supplier_payments(id,receipt_id,restaurant_cash_operation_id,amount,paid_at) VALUES($1,$2,$3,40000,now())`,[randomUUID(),receipt,cash]);
    const before = (await pool.query('SELECT sum(amount) AS n FROM restaurant_cash_operations')).rows[0].n;
    await pool.query(`INSERT INTO expense_documents(id,location_id,category_id,title,document_date,amount_minor,currency,state,supplier_receipt_id) VALUES($1,$2,$3,'Supplier',CURRENT_DATE,100000,'KZT','ACTIVE',$4)`,[doc,location,category,receipt]);
    expect((await pool.query('SELECT expense_paid_minor($1) AS paid',[doc])).rows[0].paid).toBe('40000');
    expect((await pool.query('SELECT sum(amount) AS n FROM restaurant_cash_operations')).rows[0].n).toBe(before);
    await pool.query(`UPDATE bar_receipts SET status='POSTED',posted_at=now() WHERE id=$1`,[receipt]);
    await pool.query(`INSERT INTO restaurant_cash_operations(id,location_id,kind,method,amount,currency) VALUES($1,$2,'INCOME','CASH',1000000,'KZT')`,[randomUUID(),location]);
    const db = createPrismaClient('postgresql://owner_home_test@127.0.0.1:55516/wetop_owner_home','pms_test');
    const repo = new PrismaBarRepository({db} as PrismaService);
    const scope=vi.spyOn(repo as unknown as {scope:()=>Promise<unknown>},'scope').mockResolvedValue({locationId:location,propertyId:null,vertical:'FOOD_SERVICE',timezone:'Asia/Almaty',currency:'KZT'});
    try {
      expect(await repo.payReceipt(receipt,{amountMinor:20000n,method:'CASH',note:null,idempotencyKey:randomUUID()})).toMatchObject({kind:'paid',dueAmount:'40000'});
      expect((await pool.query('SELECT count(*) FROM bar_supplier_payments WHERE receipt_id=$1',[receipt])).rows[0].count).toBe('2');
      const nextReceipt=randomUUID();
      await pool.query(`INSERT INTO bar_receipts(id,location_id,supplier_id,document_number,document_date,received_date,currency,total_amount,status,posted_at,updated_at) VALUES($1::uuid,$2,$3,$1::text,CURRENT_DATE,CURRENT_DATE,'KZT',100000,'POSTED',now(),now())`,[nextReceipt,location,supplier]);
      const store=new ExpenseStore({transaction:async fn=>{
        const c=await pool.connect();
        try {await c.query('BEGIN');const r=await fn(async(sql,values=[]) => (await c.query(sql,values)).rows);await c.query('COMMIT');return r;}
        catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
      }});
      const payload={categoryId:category,title:'Concurrent supplier',documentDate:'2026-10-16',amountMinor:'100000',currency:'KZT',supplierReceiptId:nextReceipt};
      const key=randomUUID();
      const [created,paid]=await Promise.all([store.create(location,null,key,payload),repo.payReceipt(nextReceipt,{amountMinor:40000n,method:'CASH',note:null,idempotencyKey:randomUUID()})]);
      expect(paid).toMatchObject({kind:'paid',dueAmount:'60000'});
      expect(await store.create(location,null,key,payload)).toEqual(created);
      expect((await pool.query('SELECT expense_paid_minor($1) AS paid',[created.id])).rows[0].paid).toBe('40000');
      expect((await pool.query('SELECT count(*) FROM expense_settlements WHERE expense_document_id=$1',[created.id])).rows[0].count).toBe('1');
      await expect(store.create(location,null,randomUUID(),{...payload,amountMinor:'99999'})).rejects.toThrow(/mismatch/);
      await expect(store.create(location,null,randomUUID(),{...payload,currency:'USD'})).rejects.toThrow(/mismatch/);
    } finally { scope.mockRestore(); await db.$disconnect(); }
    expect((await pool.query('SELECT expense_paid_minor($1) AS paid',[doc])).rows[0].paid).toBe('60000');
    await pool.query(`UPDATE restaurant_cash_operations SET status='VOIDED',voided_at=now() WHERE id=$1`,[cash]);
    expect((await pool.query('SELECT expense_paid_minor($1) AS paid',[doc])).rows[0].paid).toBe('20000');
    expect((await pool.query('SELECT count(*) FROM expense_settlements WHERE expense_document_id=$1',[doc])).rows[0].count).toBe('2');
  });
  it('supplier retries use persistent intents across connections, conflicts and pending claims', async () => {
    const supplier=randomUUID(), receipt=randomUUID();
    await pool.query(`INSERT INTO bar_suppliers(id,location_id,name,updated_at) VALUES($1,$2,'Retry synthetic',now())`,[supplier,location]);
    await pool.query(`INSERT INTO bar_receipts(id,location_id,supplier_id,document_number,document_date,received_date,currency,total_amount,status,posted_at,updated_at) VALUES($1::uuid,$2,$3,$1::text,CURRENT_DATE,CURRENT_DATE,'KZT',1000000,'POSTED',now(),now())`,[receipt,location,supplier]);
    const clients=[createPrismaClient('postgresql://owner_home_test@127.0.0.1:55516/wetop_owner_home','pms_test'),createPrismaClient('postgresql://owner_home_test@127.0.0.1:55516/wetop_owner_home','pms_test')];
    const repos=clients.map(db=>new PrismaBarRepository({db} as PrismaService));
    repos.forEach(repo=>vi.spyOn(repo as unknown as {scope:()=>Promise<unknown>},'scope').mockResolvedValue({locationId:location,propertyId:null,vertical:'FOOD_SERVICE',timezone:'Asia/Almaty',currency:'KZT'}));
    const input={amountMinor:1000n,method:'CASH',note:null,idempotencyKey:randomUUID()};
    vi.stubEnv('EXPENSE_LINKS_ENABLED','1');
    try {
      const first=await repos[0]!.payReceipt(receipt,input);
      expect(await repos[1]!.payReceipt(receipt,input)).toEqual(first);
      await expect(repos[0]!.payReceipt(receipt,{...input,amountMinor:1001n})).rejects.toMatchObject({status:409});
      // Deliberately bypass the static contract to check runtime rejection of a missing key.
      const missingKey={amountMinor:input.amountMinor,method:input.method,note:input.note} as BarSupplierPaymentInput;
      await expect(repos[0]!.payReceipt(receipt,missingKey)).rejects.toMatchObject({status:400});
      const concurrent={...input,idempotencyKey:randomUUID()};
      const results=await Promise.allSettled(repos.map(repo=>repo.payReceipt(receipt,concurrent)));
      const success=results.find(r=>r.status==='fulfilled');
      expect(success?.status).toBe('fulfilled');
      if(success?.status==='fulfilled') expect(await repos[0]!.payReceipt(receipt,concurrent)).toEqual(success.value);
      expect((await pool.query('SELECT count(*) FROM bar_supplier_payments WHERE receipt_id=$1',[receipt])).rows[0].count).toBe('2');
      const blocker=await pool.connect();
      try {
        const pending={...input,idempotencyKey:randomUUID()};
        await blocker.query('BEGIN');
        await blocker.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[location+':'+pending.idempotencyKey]);
        await expect(repos[1]!.payReceipt(receipt,pending)).rejects.toMatchObject({status:409});
      } finally {await blocker.query('ROLLBACK');blocker.release();}
      vi.stubEnv('EXPENSE_LINKS_ENABLED','0');
      await expect(repos[0]!.payReceipt(receipt,missingKey)).rejects.toMatchObject({status:400});
      const offInput={...input,idempotencyKey:randomUUID()};
      const offFirst=await repos[0]!.payReceipt(receipt,offInput);
      expect(offFirst).toMatchObject({kind:'paid',paidAmount:'1000',dueAmount:'997000'});
      const cashAfterOff=(await pool.query("SELECT count(*) AS n,sum(amount)::text AS total FROM restaurant_cash_operations WHERE location_id=$1 AND kind='EXPENSE'",[location])).rows[0];
      expect(await repos[1]!.payReceipt(receipt,offInput)).toEqual(offFirst);
      await expect(repos[0]!.payReceipt(receipt,{...offInput,amountMinor:1001n})).rejects.toMatchObject({status:409});
      expect((await pool.query('SELECT count(*) FROM bar_supplier_payments WHERE receipt_id=$1',[receipt])).rows[0].count).toBe('3');
      expect((await pool.query('SELECT idempotency_key FROM bar_supplier_payments WHERE receipt_id=$1 AND idempotency_key=$2',[receipt,offInput.idempotencyKey])).rows).toEqual([{idempotency_key:offInput.idempotencyKey}]);
      expect((await pool.query("SELECT count(*) AS n,sum(amount)::text AS total FROM restaurant_cash_operations WHERE location_id=$1 AND kind='EXPENSE'",[location])).rows[0]).toEqual(cashAfterOff);
    } finally {vi.unstubAllEnvs();await Promise.all(clients.map(db=>db.$disconnect()));}
  });
  it('replays identical intents, rejects changed payload, never creates cash', async () => {
    const db = { transaction: async <T>(fn: (q: (sql: string, values?: unknown[]) => Promise<unknown[]>) => Promise<T>) => {
      const c = await pool.connect();
      try { await c.query('BEGIN'); const result = await fn(async (sql,values=[]) => (await c.query(sql,values)).rows); await c.query('COMMIT'); return result; }
      catch(e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
    } };
    const store = new ExpenseStore(db);
    const payload = { categoryId: category, title: 'API synthetic', documentDate: '2026-10-16', amountMinor: '9007199254740993', currency: 'KZT' };
    const a = await store.create(location,null,'synthetic-intent',payload);
    expect(await store.create(location,null,'synthetic-intent',payload)).toEqual(a);
    await expect(store.create(location,null,'synthetic-intent',{...payload,title:'Changed'})).rejects.toThrow(/intent/);
  });
  it('links proven hotel cash without inferring unknown historical currency', async () => {
    const property = randomUUID(), hotelLocation = randomUUID(), cat = randomUUID(), doc = randomUUID();
    const business = (await pool.query('SELECT business_id FROM locations WHERE id=$1',[location])).rows[0].business_id;
    const org = (await pool.query('SELECT organization_id FROM businesses WHERE id=$1',[business])).rows[0].organization_id;
    await pool.query(`INSERT INTO locations(id,business_id,name,timezone,currency,updated_at) VALUES($1,$2,'Synthetic hotel','Asia/Almaty','KZT',now())`,[hotelLocation,business]);
    await pool.query(`INSERT INTO properties(id,organization_id,location_id,name,timezone,currency,check_in_time,check_out_time,updated_at) VALUES($1,$2,$3,'Synthetic hotel','Asia/Almaty','KZT','14:00','12:00',now())`,[property,org,hotelLocation]);
    await pool.query(`INSERT INTO expense_categories(id,location_id,code,name) VALUES($1,$2,'hotel-test','Synthetic')`,[cat,hotelLocation]);
    await pool.query(`INSERT INTO expense_documents(id,location_id,category_id,title,document_date,amount_minor,currency,state) VALUES($1,$2,$3,'Synthetic hotel',CURRENT_DATE,100000,'KZT','ACTIVE')`,[doc,hotelLocation,cat]);
    const cash = randomUUID(), unknown = randomUUID();
    await pool.query(`INSERT INTO cash_operations(id,property_id,kind,method,amount,currency_snapshot) VALUES($1,$3,'EXPENSE','CASH',40000,'KZT'),($2,$3,'EXPENSE','CASH',100,NULL)`,[cash,unknown,property]);
    const insert = (id:string) => pool.query(`INSERT INTO expense_settlements(id,location_id,expense_document_id,cash_operation_id) VALUES($1,$2,$3,$4)`,[randomUUID(),hotelLocation,doc,id]);
    const a=await pool.connect(), b=await pool.connect();
    let move: Promise<{error?: Error}> | undefined;
    try {
      await a.query('BEGIN'); await b.query('BEGIN');
      await a.query(`INSERT INTO expense_settlements(id,location_id,expense_document_id,cash_operation_id) VALUES($1,$2,$3,$4)`,[randomUUID(),hotelLocation,doc,cash]);
      const pid=(await b.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      move=b.query('UPDATE properties SET location_id=$1 WHERE id=$2',[location,property]).then(()=>({}),error=>({error}));
      let blocked=false;
      for(let i=0;i<50;i++) {
        blocked=(await a.query('SELECT cardinality(pg_blocking_pids($1))>0 AS blocked',[pid])).rows[0].blocked;
        if(blocked) break;
        await new Promise(resolve=>setTimeout(resolve,10));
      }
      await a.query('COMMIT');
      const result=await move;
      expect(blocked,'property move must wait for uncommitted settlement').toBe(true);
      expect(result.error?.message).toMatch(/linked property scope immutable/);
    } finally {
      await a.query('ROLLBACK'); await b.query('ROLLBACK'); a.release(); b.release();
    }
    expect((await pool.query('SELECT expense_paid_minor($1) AS paid',[doc])).rows[0].paid).toBe('40000');
    await expect(insert(unknown)).rejects.toThrow(/invalid canonical/);
  });
  it('binds real legacy marketing, syncs unpaid edits, links cash once and preserves voided history', async () => {
    const db=createPrismaClient('postgresql://owner_home_test@127.0.0.1:55516/wetop_owner_home','pms_test');
    const repo=new PrismaMarketingBudgetRepository({db} as PrismaService);
    const store=new ExpenseStore({transaction:async fn=>{
      const c=await pool.connect();
      try {await c.query('BEGIN');const r=await fn(async(sql,values=[]) => (await c.query(sql,values)).rows);await c.query('COMMIT');return r;}
      catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
    }});
    const input={date:'2026-10-16',platform:'OTHER' as const,campaign:null,campaignId:null,category:'Synthetic marketing',description:null,amount:100000n,currency:'KZT',fxRate:'1',baseAmount:100000n,countedInBudget:true};
    const audit={entityType:'MarketingExpense',action:'CREATE',after:{synthetic:true}};
    try {
      const m=await repo.createExpense(location,input,audit);
      const cat=randomUUID();
      await pool.query(`INSERT INTO expense_categories(id,location_id,code,name) VALUES($1,$2,'MARKETING','Marketing')`,[cat,location]);
      const key=randomUUID(), payload={categoryId:cat,title:'Marketing',documentDate:input.date,amountMinor:'100000',currency:'KZT',marketingExpenseId:m.id};
      const d=await store.create(location,null,key,payload);
      expect((await pool.query('SELECT marketing_expense_id FROM expense_documents WHERE id=$1',[d.id])).rows[0].marketing_expense_id).toBe(m.id);
      expect(await store.create(location,null,key,payload)).toEqual(d);
      await expect(store.create(location,null,randomUUID(),payload)).rejects.toThrow();
      await expect(store.create(location,null,key,{...payload,amountMinor:'1'})).rejects.toThrow();
      await repo.updateExpense(location,m.id,{...input,amount:120000n,baseAmount:120000n},{...audit,action:'UPDATE',entityId:m.id});
      expect((await pool.query('SELECT amount_minor FROM expense_documents WHERE id=$1',[d.id])).rows[0].amount_minor).toBe('120000');
      await pool.query('UPDATE expense_documents SET amount_minor=130000 WHERE id=$1',[d.id]);
      expect((await pool.query('SELECT amount FROM marketing_expenses WHERE id=$1',[m.id])).rows[0].amount).toBe('130000');
      const other=await repo.createExpense(location,{...input,currency:'USD',fxRate:'500',baseAmount:50000000n},audit);
      await expect(store.create(location,null,randomUUID(),{...payload,marketingExpenseId:other.id,currency:'USD'})).rejects.toThrow(/FX conflict/);
      const wrong=await repo.createExpense(location,input,audit);
      await expect(store.create(location,null,randomUUID(),{...payload,marketingExpenseId:wrong.id,amountMinor:'1'})).rejects.toThrow(/source mismatch/);
      const org=(await pool.query('SELECT b.organization_id FROM businesses b JOIN locations l ON l.business_id=b.id WHERE l.id=$1',[location])).rows[0].organization_id;
      const c=await pool.connect();
      try {
        await c.query('BEGIN');await c.query('SET LOCAL ROLE wetop_app');
        await c.query("SELECT set_config('app.org_id',$1,true)",[randomUUID()]);
        expect((await c.query('SELECT id FROM marketing_expenses WHERE id=$1',[m.id])).rows).toHaveLength(0);
        expect((await c.query('UPDATE marketing_expenses SET amount=1 WHERE id=$1 RETURNING id',[m.id])).rows).toHaveLength(0);
        await c.query("SELECT set_config('app.org_id',$1,true)",[org]);
        expect((await c.query('SELECT id FROM marketing_expenses WHERE id=$1',[m.id])).rows).toHaveLength(1);
      } finally {await c.query('ROLLBACK');c.release();}
      const cash=await source('40000');
      const total=(await pool.query("SELECT sum(amount) AS n FROM restaurant_cash_operations WHERE location_id=$1 AND kind='EXPENSE' AND status='COMPLETED'",[location])).rows[0].n;
      const linkKey=randomUUID();
      const settled=await store.link(location,null,linkKey,d.id,'RESTAURANT_CASH',cash);
      expect(await store.link(location,null,linkKey,d.id,'RESTAURANT_CASH',cash)).toEqual(settled);
      expect((await pool.query('SELECT expense_paid_minor($1) AS n',[d.id])).rows[0].n).toBe('40000');
      expect((await pool.query(`SELECT cat.code,sum(c.amount)::text AS n FROM expense_settlements s JOIN expense_documents d ON d.id=s.expense_document_id JOIN expense_categories cat ON cat.id=d.category_id JOIN restaurant_cash_operations c ON c.id=s.restaurant_cash_operation_id WHERE d.id=$1 AND c.status='COMPLETED' GROUP BY cat.code`,[d.id])).rows).toEqual([{code:'MARKETING',n:'40000'}]);
      expect((await pool.query("SELECT sum(amount) AS n FROM restaurant_cash_operations WHERE location_id=$1 AND kind='EXPENSE' AND status='COMPLETED'",[location])).rows[0].n).toBe(total);
      expect((await repo.monthData(location,'2026-10-01','2026-11-01','2026-09-01')).expenses.find(x=>x.id===m.id)?.baseAmount).toBe(130000n);
      await expect(store.link(location,null,randomUUID(),d.id,'RESTAURANT_CASH',await source('1','USD'))).rejects.toThrow(/canonical/);
      await pool.query("UPDATE restaurant_cash_operations SET status='VOIDED',voided_at=now() WHERE id=$1",[cash]);
      expect((await pool.query('SELECT expense_paid_minor($1) AS n',[d.id])).rows[0].n).toBe('0');
      await expect(repo.updateExpense(location,m.id,input,{...audit,action:'UPDATE',entityId:m.id})).rejects.toThrow();
      await expect(pool.query('UPDATE expense_documents SET amount_minor=1 WHERE id=$1',[d.id])).rejects.toThrow(/immutable/);
      await expect(pool.query("UPDATE marketing_expenses SET currency='USD' WHERE id=$1",[m.id])).rejects.toThrow(/immutable/);
      await expect(pool.query('UPDATE marketing_expenses SET location_id=$1 WHERE id=$2',[randomUUID(),m.id])).rejects.toThrow();
      expect((await pool.query('SELECT amount FROM marketing_expenses WHERE id=$1',[m.id])).rows[0].amount).toBe('130000');
      await expect(repo.deleteExpense(location,m.id,{...audit,action:'DELETE',entityId:m.id})).rejects.toThrow();
      expect((await pool.query("SELECT count(*) AS n FROM audit_logs WHERE entity_id=$1 AND action='MARKETING_DOCUMENT_SYNC'",[d.id])).rows[0].n).not.toBe('0');
    } finally {await db.$disconnect();}
  });
  it('enforces tenant isolation under the actual runtime role', async () => {
    const client = await pool.connect();
    const org = (await pool.query('SELECT b.organization_id FROM businesses b JOIN locations l ON l.business_id=b.id WHERE l.id=$1',[location])).rows[0].organization_id;
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE wetop_app');
      await client.query("SELECT set_config('app.org_id',$1,true)",[org]);
      expect((await client.query('SELECT id FROM expense_documents WHERE id=$1',[document])).rows).toHaveLength(1);
      await client.query("SELECT set_config('app.org_id',$1,true)",[randomUUID()]);
      expect((await client.query('SELECT id FROM expense_documents WHERE id=$1',[document])).rows).toHaveLength(0);
      await expect(client.query(`INSERT INTO expense_categories(id,location_id,code,name) VALUES($1,$2,'cross-tenant','Synthetic')`,[randomUUID(),location])).rejects.toThrow(/row-level security/);
    } finally { await client.query('ROLLBACK'); client.release(); }
  });
  it('enables FORCE RLS and both policy predicates', async () => {
    const rows = (await pool.query(`SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid IN ('expense_documents'::regclass,'expense_settlements'::regclass,'expense_categories'::regclass)`)).rows;
    expect(rows).toHaveLength(3); expect(rows.every(r=>r.relrowsecurity && r.relforcerowsecurity)).toBe(true);
    expect((await pool.query(`SELECT count(*) FROM pg_policies WHERE schemaname='pms_test' AND tablename LIKE 'expense_%' AND qual IS NOT NULL AND with_check IS NOT NULL`)).rows[0].count).toBe('3');
  });
});
