import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import {readFileSync} from 'node:fs';
import { createPrismaClient } from '@pms/database';
import { readOwnerMoney } from '../../apps/api/src/finance/owner-money';
const url = 'postgresql://owner_home_test@127.0.0.1:55516/wetop_owner_home';
const pool = new pg.Pool({ connectionString:url,max:1,options:'-c search_path=pms_test,public' });
const db = createPrismaClient(url,'pms_test');
const locationId=randomUUID(), business=randomUUID(), order=randomUUID();
let organizationId:string;
const from=new Date('2040-01-02T19:00Z'), now=new Date('2040-01-03T03:00Z');
beforeAll(async()=>{
 const held=readFileSync('packages/database/prisma/migrations-hold/20261016000114_expense_links/migration.sql','utf8');
 await pool.query(held.slice(held.indexOf('CREATE OR REPLACE FUNCTION hotel_cash_currency_guard'),held.indexOf('CREATE TRIGGER hotel_cash_currency_guard')));
 await pool.query('ALTER FUNCTION hotel_cash_currency_guard() SET search_path TO pms_test, public, pg_temp');
 if(!(await pool.query("SELECT 1 FROM pg_trigger WHERE tgname='hotel_cash_currency_guard' AND tgrelid='cash_operations'::regclass")).rowCount) await pool.query(held.slice(held.indexOf('CREATE TRIGGER hotel_cash_currency_guard'),held.indexOf('CREATE TABLE expense_categories')));
 organizationId=(await pool.query('SELECT id FROM organizations LIMIT 1')).rows[0].id;
 await pool.query(`INSERT INTO businesses(id,organization_id,name,vertical,updated_at) VALUES($1,$2,'Synthetic owner revenue','FOOD_SERVICE',now())`,[business,organizationId]);
 await pool.query(`INSERT INTO locations(id,business_id,name,timezone,currency,updated_at) VALUES($1,$2,'Synthetic owner revenue','Asia/Almaty','EUR',now())`,[locationId,business]);
 await pool.query(`INSERT INTO restaurant_orders(id,location_id,number,status,total,currency,closed_at,updated_at) VALUES($1,$2,1,'CLOSED',9007199254740993,'KZT','2040-01-03T01:00Z',now()),($3,$2,2,'CLOSED',999,'KZT','2040-01-03T04:00Z',now()),($4,$2,3,'NEW',777,'KZT',NULL,now())`,[order,locationId,randomUUID(),randomUUID()]);
 await pool.query(`INSERT INTO restaurant_payments(id,location_id,order_id,method,amount,currency,idempotency_key,paid_at) VALUES($1::uuid,$2,$3,'CASH',40,'KZT',$1::text,'2040-01-03T02:00Z')`,[randomUUID(),locationId,order]);
 await pool.query(`INSERT INTO bar_sales(id,location_id,idempotency_key,currency,total_revenue,total_cost,created_at) VALUES($1::uuid,$2,$1::text,'USD',30,10,'2040-01-03T02:00Z')`,[randomUUID(),locationId]);
});
afterAll(async()=>{await db.$disconnect();await pool.end();});
describe('owner money actual isolated PostgreSQL queries',()=>{
 it('fresh held114 applies to transactional baseline clones and rollback leaves originals intact',async()=>{
  const c=await pool.connect();const suffix='_accept114';
  const dependencies=['cash_operations','restaurant_cash_operations','locations','businesses','users','marketing_expenses','bar_receipts','bar_supplier_payments','properties'];
  const migration=readFileSync('packages/database/prisma/migrations-hold/20261016000114_expense_links/migration.sql','utf8');
  const created=[...migration.matchAll(/CREATE TABLE (\w+)/g)].map(m=>m[1]!);
  const functions=[...migration.matchAll(/CREATE (?:OR REPLACE )?FUNCTION (\w+)/g)].map(m=>m[1]!);
  try {
   await c.query('BEGIN');
   for(const table of dependencies) await c.query(`CREATE TABLE ${table+suffix} (LIKE ${table} INCLUDING ALL)`);
   await c.query(`ALTER TABLE cash_operations${suffix} DROP COLUMN currency_snapshot`);
   let sql=migration;
   const indexes=[...migration.matchAll(/CREATE INDEX (\w+)/g)].map(m=>m[1]!);
   for(const name of [...dependencies,...created,...functions,...indexes].sort((a,b)=>b.length-a.length)) sql=sql.replace(new RegExp('\\b'+name+'\\b','g'),name+suffix);
   await c.query(sql);
   expect((await c.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='pms_test' AND table_name='cash_operations_accept114' AND column_name='currency_snapshot'`)).rowCount).toBe(1);
   expect((await c.query(`SELECT count(*) AS n FROM pg_policies WHERE schemaname='pms_test' AND tablename LIKE '%_accept114'`)).rows[0].n).toBe('4');
  } finally {await c.query('ROLLBACK');c.release();}
  expect((await pool.query("SELECT to_regclass('pms_test.cash_operations_accept114') AS t")).rows[0].t).toBeNull();
 });
 it('feature OFF uses only legacy adapter without querying held currency column',async()=>{
  const {createHotelCash}=await import('../../apps/api/src/finance/hotel-cash');
  delete process.env.EXPENSE_LINKS_ENABLED;
  const data={propertyId:randomUUID(),kind:'EXPENSE' as const,method:'CASH' as const,amount:7n};
  let called=0;
  const tx={cashOperation:{create:async(args:unknown)=>{expect(args).toEqual({data,select:{id:true,occurredAt:true}});called++;return {id:'legacy',occurredAt:now};}},$queryRaw:()=>{throw new Error('No held schema query allowed');}};
  expect(await createHotelCash(tx as never,data)).toEqual({id:'legacy',occurredAt:now});expect(called).toBe(1);
 });
 it('hotel supplier repository writes snapshot and settlement as runtime role; foreign tenant sees no receipt',async()=>{
  const {PrismaBarRepository}=await import('../../apps/api/src/bar/bar.repository');
  const {vi}=await import('vitest');
  const locationId=randomUUID();
  await pool.query(`INSERT INTO locations(id,business_id,name,timezone,currency,updated_at) VALUES($1,$2,'Synthetic runtime location','Asia/Almaty','EUR',now())`,[locationId,business]);
  const property=randomUUID(), supplier=randomUUID(),receipt=randomUUID(),category=randomUUID(),document=randomUUID();
  await pool.query(`INSERT INTO properties(id,organization_id,location_id,name,timezone,currency,check_in_time,check_out_time,updated_at) VALUES($1,$2,$3,'Synthetic runtime hotel','Asia/Almaty','EUR','14:00','12:00',now())`,[property,organizationId,locationId]);
  await pool.query(`INSERT INTO bar_suppliers(id,location_id,name,updated_at) VALUES($1,$2,'Synthetic runtime supplier',now())`,[supplier,locationId]);
  await pool.query(`INSERT INTO bar_receipts(id,location_id,property_id,supplier_id,document_number,document_date,received_date,currency,total_amount,status,posted_at,updated_at) VALUES($1::uuid,$2,$3,$4,$1::text,CURRENT_DATE,CURRENT_DATE,'EUR',100,'POSTED',now(),now())`,[receipt,locationId,property,supplier]);
  await pool.query(`INSERT INTO expense_categories(id,location_id,code,name) VALUES($1::uuid,$2,$1::text,'Synthetic runtime')`,[category,locationId]);
  await pool.query(`INSERT INTO expense_documents(id,location_id,category_id,title,document_date,amount_minor,currency,state,supplier_receipt_id) VALUES($1,$2,$3,'Synthetic runtime',CURRENT_DATE,100,'EUR','ACTIVE',$4)`,[document,locationId,category,receipt]);
  let org=organizationId;
  const runtime={$transaction:async(fn:(tx:unknown)=>Promise<unknown>)=>db.$transaction(async tx=>{await tx.$executeRawUnsafe('SET LOCAL ROLE wetop_app');await tx.$queryRaw`SELECT set_config('app.org_id',${org},true)`;return fn(tx);})};
  const repo=new PrismaBarRepository({db:runtime} as never);
  const scoped=vi.spyOn(repo as unknown as {scope:()=>Promise<unknown>},'scope').mockResolvedValue({locationId,propertyId:property,vertical:'HOSPITALITY',currency:'EUR',timezone:'Asia/Almaty'} as never);
  process.env.EXPENSE_LINKS_ENABLED='1';
  try {
   const paid=await repo.payReceipt(receipt,{amountMinor:20n,method:'CASH',note:null,idempotencyKey:randomUUID()});
   expect(paid).toMatchObject({kind:'paid',dueAmount:'80'});
   expect((await pool.query(`SELECT c.currency_snapshot,c.amount FROM expense_settlements s JOIN cash_operations c ON c.id=s.cash_operation_id WHERE s.expense_document_id=$1`,[document])).rows).toEqual([{currency_snapshot:'EUR',amount:'20'}]);
   org=randomUUID();
   expect(await repo.payReceipt(receipt,{amountMinor:1n,method:'CASH',note:null,idempotencyKey:randomUUID()})).toMatchObject({kind:'not_found'});
  } finally {scoped.mockRestore();delete process.env.EXPENSE_LINKS_ENABLED;}
 });
 it('daily series reconciles actual authorized service totals across today, week and calendar month',async()=>{
  const {OwnerSummaryService}=await import('../../apps/api/src/finance/owner-summary');
  const {withSignedInUser}=await import('../../apps/api/src/auth/request-context');
  const service=new OwnerSummaryService({db} as never);
  for(const period of ['today','week','month']) {
   const result=await withSignedInUser({userId:randomUUID(),organizationId,role:'OWNER',scope:'LOCATION',locationId,businessId:business},()=>service.report(period,now));
   for(const metric of [result.current.revenue,result.current.receipts]) {
    expect(metric.daily?.days?.at(-1)?.date).toBe('2040-01-03');
    for(const c of metric.currencies??[]) expect(metric.daily?.days?.reduce((sum,d)=>sum+BigInt(d.currencies.find(v=>v.currency===c.currency)?.amountMinor??'0'),0n).toString()).toBe(c.amountMinor);
   }
   expect(result.current.revenue.daily?.days?.length).toBe(period==='today'?1:period==='week'?7:3);
   expect(result.previous?.period).toMatchObject(period==='today'?{fromDate:'2040-01-02',toDate:'2040-01-02',toUtc:'2040-01-02T03:00:00.000Z'}:period==='week'?{fromDate:'2039-12-21',toDate:'2039-12-27',toUtc:'2039-12-27T03:00:00.000Z'}:{fromDate:'2039-12-01',toDate:'2039-12-03',toUtc:'2039-12-03T03:00:00.000Z'});
   expect(result.previous?.revenue.daily?.days?.length).toBe(period==='today'?1:period==='week'?7:3);
  }
 });
 it('previous actual canonical rows stop at previous cutoff, retaining exact amounts and categories',async()=>{
  const {OwnerSummaryService}=await import('../../apps/api/src/finance/owner-summary');
  const {withSignedInUser}=await import('../../apps/api/src/auth/request-context');
  const category=randomUUID(),document=randomUUID(),cash=randomUUID();
  await pool.query(`INSERT INTO restaurant_orders(id,location_id,number,status,total,currency,closed_at,updated_at) VALUES($1,$2,41,'CLOSED',9007199254740991,'KZT','2040-01-02T02:00Z',now()),($3,$2,42,'CLOSED',777,'KZT','2040-01-02T04:00Z',now())`,[randomUUID(),locationId,randomUUID()]);
  await pool.query(`INSERT INTO expense_categories(id,location_id,code,name) VALUES($1::uuid,$2,$1::text,'Synthetic previous category')`,[category,locationId]);
  await pool.query(`INSERT INTO expense_documents(id,location_id,category_id,title,document_date,amount_minor,currency,state) VALUES($1,$2,$3,'Synthetic previous','2040-01-02',100,'USD','ACTIVE')`,[document,locationId,category]);
  await pool.query(`INSERT INTO restaurant_cash_operations(id,location_id,kind,method,amount,currency,occurred_at) VALUES($1,$2,'EXPENSE','CASH',40,'USD','2040-01-02T02:00Z'),($3,$2,'EXPENSE','CASH',999,'USD','2040-01-02T04:00Z')`,[cash,locationId,randomUUID()]);
  await pool.query(`INSERT INTO expense_settlements(id,location_id,expense_document_id,restaurant_cash_operation_id) VALUES($1,$2,$3,$4)`,[randomUUID(),locationId,document,cash]);
  process.env.EXPENSE_LINKS_ENABLED='1';
  try {
   const result=await withSignedInUser({userId:randomUUID(),organizationId,role:'OWNER',scope:'LOCATION',locationId,businessId:business},()=>new OwnerSummaryService({db} as never).report('today',now));
   expect(result.generatedAt).toBe(now.toISOString());
   expect(result.previous?.period.toUtc).toBe('2040-01-02T03:00:00.000Z');
   expect(result.previous?.revenue.currencies).toEqual([{currency:'KZT',amountMinor:'9007199254740991'}]);
   expect(result.comparisons.revenue.currencies?.find(c=>c.currency==='KZT')).toMatchObject({deltaMinor:'2'});
   expect(result.previous?.paidExpenses.currencies?.[0]).toMatchObject({paidMinor:'40',categories:[{categoryId:category,categoryName:'Synthetic previous category',paidMinor:'40'}]});
   expect(result.previous && 'daily' in result.previous.paidExpenses ? result.previous.paidExpenses.daily.currencies : null).toEqual([{currency:'USD',amountMinor:'40'}]);
  } finally {delete process.env.EXPENSE_LINKS_ENABLED;}
 });
 it('actual authorized queries preserve local midnight, DST and unequal-month bounds',async()=>{
  const {OwnerSummaryService}=await import('../../apps/api/src/finance/owner-summary');
  const {withSignedInUser}=await import('../../apps/api/src/auth/request-context');
  const report=(period:string,at:string)=>withSignedInUser({userId:randomUUID(),organizationId,role:'OWNER',scope:'LOCATION',locationId,businessId:business},()=>new OwnerSummaryService({db} as never).report(period,new Date(at)));
  const midnight=await report('today','2026-10-16T19:00Z');
  expect(midnight.previous?.period).toMatchObject({fromDate:'2026-10-16',toDate:'2026-10-16',fromUtc:'2026-10-15T19:00:00.000Z',toUtc:'2026-10-15T19:00:00.000Z'});
  await pool.query("UPDATE locations SET timezone='America/New_York' WHERE id=$1",[locationId]);
  try {
   const dst=await report('today','2026-03-08T12:15Z');
   expect(dst.previous?.period.toUtc).toBe('2026-03-07T13:15:00.000Z');
   expect((await report('today','2026-03-09T06:30Z')).comparisonReason).toBe('PREVIOUS_WALL_CLOCK_NOT_UNIQUE');
   const short=await report('month','2026-03-30T12:00Z');
   expect(short.previous).toBeNull();expect(short.comparisonReason).toBe('PREVIOUS_MONTH_DAY_NOT_AVAILABLE');
  } finally {await pool.query("UPDATE locations SET timezone='Asia/Almaty' WHERE id=$1",[locationId]);}
 });
 it('classifies real partially-paid document without changing cash totals, including void and missing links',async()=>{
  const { OwnerSummaryService } = await import('../../apps/api/src/finance/owner-summary');
  const { withSignedInUser } = await import('../../apps/api/src/auth/request-context');
  const service = new OwnerSummaryService({db} as never);
  const report = () => withSignedInUser({userId:randomUUID(),organizationId,role:'OWNER',scope:'LOCATION',locationId,businessId:business},()=>service.report('today',now));
  const category=randomUUID(), document=randomUUID(), cash=randomUUID(), unlinked=randomUUID();
  await pool.query(`INSERT INTO expense_categories(id,location_id,code,name,active) VALUES($1::uuid,$2,$1::text,'Synthetic archived category',false)`,[category,locationId]);
  await pool.query(`INSERT INTO expense_documents(id,location_id,category_id,title,document_date,amount_minor,currency,state) VALUES($1,$2,$3,'Synthetic document','2040-01-03',100000,'KZT','ACTIVE')`,[document,locationId,category]);
  await pool.query(`INSERT INTO restaurant_cash_operations(id,location_id,kind,method,amount,currency,occurred_at) VALUES($1,$2,'EXPENSE','CASH',40000,'KZT','2040-01-03T02:00Z'),($3,$2,'EXPENSE','CASH',100,'USD','2040-01-03T02:00Z')`,[cash,locationId,unlinked]);
  delete process.env.EXPENSE_LINKS_ENABLED;
  const before=await report();
  await pool.query(`INSERT INTO expense_settlements(id,location_id,expense_document_id,restaurant_cash_operation_id) VALUES($1,$2,$3,$4)`,[randomUUID(),locationId,document,cash]);
  process.env.EXPENSE_LINKS_ENABLED='1';
  const after=await report();
  expect(after.current.paidExpenses.currencies?.map(({currency,paidMinor})=>({currency,paidMinor}))).toEqual(before.current.paidExpenses.currencies?.map(({currency,paidMinor})=>({currency,paidMinor})));
  expect(after.current.paidExpenses.currencies?.[0]?.categories).toEqual([{categoryId:category,categoryName:'Synthetic archived category',paidMinor:'40000'}]);
  expect(after.current.paidExpenses.currencies?.[1]?.categories).toEqual([{categoryId:null,categoryName:'Без статьи',paidMinor:'100'}]);
  expect(after.classificationReason).toBe('UNCLASSIFIED_EXPENSE_SOURCES');
  for(const c of after.current.paidExpenses.currencies??[]) expect(c.categories.reduce((a,r)=>a+BigInt(r.paidMinor),0n).toString()).toBe(c.paidMinor);
  await pool.query(`UPDATE restaurant_cash_operations SET status='VOIDED',voided_at=now() WHERE id=$1`,[cash]);
  const voided=await report();
  expect(voided.current.paidExpenses.currencies).toEqual([{currency:'USD',paidMinor:'100',categories:[{categoryId:null,categoryName:'Без статьи',paidMinor:'100'}]}]);
  delete process.env.EXPENSE_LINKS_ENABLED;
 });
 it('keeps DONE beauty revenue separate from gross receipts in the canonical branch cash ledger',async()=>{
  const employee=randomUUID(),customer=randomUUID(),service=randomUUID(),appointment=randomUUID();
  const business=randomUUID(),locationId=randomUUID();
  await pool.query(`INSERT INTO businesses(id,organization_id,name,vertical,updated_at) VALUES($1,$2,'Synthetic beauty receipts','BEAUTY',now())`,[business,organizationId]);
  await pool.query(`INSERT INTO locations(id,business_id,name,timezone,currency,updated_at) VALUES($1,$2,'Synthetic beauty receipts','Asia/Almaty','EUR',now())`,[locationId,business]);
  await pool.query(`INSERT INTO employees(id,business_id,name,updated_at) VALUES($1,$2,'Synthetic master',now())`,[employee,business]);
  await pool.query(`INSERT INTO employee_locations(employee_id,location_id) VALUES($1,$2)`,[employee,locationId]);
  await pool.query(`INSERT INTO customers(id,organization_id,first_name,updated_at) VALUES($1,$2,'Synthetic customer',now())`,[customer,organizationId]);
  await pool.query(`INSERT INTO beauty_services(id,business_id,name,duration_minutes,price,currency,updated_at) VALUES($1,$2,'Synthetic service',30,999,'EUR',now())`,[service,business]);
  await pool.query(`INSERT INTO location_services(location_id,service_id,updated_at) VALUES($1,$2,now())`,[locationId,service]);
  await pool.query(`INSERT INTO employee_services(employee_id,service_id) VALUES($1,$2)`,[employee,service]);
  await pool.query(`INSERT INTO appointments(id,location_id,customer_id,employee_id,service_id,starts_at,ends_at,status,price,currency,updated_at) VALUES($1,$2,$3,$4,$5,'2040-01-03T01:00Z','2040-01-03T01:30Z','DONE',50,'USD',now())`,[appointment,locationId,customer,employee,service]);
  // Existing RestaurantCashOperation is the sole Beauty payment ledger. Neither
  // manual income nor refunds/voids/future payments are gross appointment receipts.
  for(const [kind,status,amount,at,linked] of [
   ['INCOME','COMPLETED',30,'2040-01-03T02:00Z',true],
   ['INCOME','COMPLETED',10,'2040-01-03T02:30Z',true],
   ['INCOME','VOIDED',999,'2040-01-03T02:00Z',true],
   ['INCOME','COMPLETED',999,'2040-01-03T04:00Z',true],
   ['INCOME','COMPLETED',999,'2040-01-02T18:59Z',true],
   ['INCOME','COMPLETED',999,'2040-01-03T02:00Z',false],
   ['EXPENSE','COMPLETED',10,'2040-01-03T02:00Z',true],
  ] as const) await pool.query(`INSERT INTO restaurant_cash_operations(id,location_id,appointment_id,kind,status,method,amount,currency,occurred_at,voided_at) VALUES($1,$2,$3,$4,$5,'CASH',$6,'USD',$7,$8)`,[randomUUID(),locationId,linked?appointment:null,kind,status,amount,at,status==='VOIDED'?at:null]);
  const r=await readOwnerMoney(db,{locationId,organizationId,vertical:'BEAUTY',propertyId:null,from,now,fromDate:'2040-01-03',toDate:'2040-01-03'});
  expect(r.revenue.currencies).toEqual([{currency:'USD',amountMinor:'50'}]);
  expect(r.receipts.state).toBe('READY');
  expect(r.receipts.reason).toBeNull();
  expect(r.receipts.currencies).toEqual([{currency:'USD',amountMinor:'40'}]);
  expect(r.receipts.daily.days).toEqual([{date:'2040-01-03',unresolvedSources:0,currencies:[{currency:'USD',amountMinor:'40'}]}]);
 });
 it('reads CLOSED snapshots and POSTED sales once, excluding future and unclosed orders',async()=>{
  const r=await readOwnerMoney(db,{locationId,organizationId,vertical:'FOOD_SERVICE',propertyId:null,from,now,fromDate:'2040-01-03',toDate:'2040-01-03'});
  expect(r.revenue.currencies).toEqual([{currency:'KZT',amountMinor:'9007199254740993'},{currency:'USD',amountMinor:'30'}]);
  expect(r.receipts.currencies).toEqual([{currency:'KZT',amountMinor:'40'},{currency:'USD',amountMinor:'30'}]);
 });
 it('does not borrow another branch or its present EUR currency',async()=>{
  const r=await readOwnerMoney(db,{locationId:randomUUID(),organizationId,vertical:'FOOD_SERVICE',propertyId:null,from,now,fromDate:'2040-01-03',toDate:'2040-01-03'});
  expect(r.revenue.currencies).toEqual([]);expect(r.receipts.currencies).toEqual([]);
 });
 it('executes hotel service-date/folio and payment scope queries against the real schema',async()=>{
  const p={id:randomUUID(),location_id:locationId,organization_id:organizationId};
  await pool.query(`INSERT INTO properties(id,organization_id,location_id,name,timezone,currency,check_in_time,check_out_time,updated_at) VALUES($1,$2,$3,'Synthetic owner hotel','Asia/Almaty','EUR','14:00','12:00',now())`,[p.id,organizationId,locationId]);
  const reservation=randomUUID(), item=randomUUID(), folio=randomUUID();
  await pool.query(`INSERT INTO reservations(id,property_id,confirmation_number,source,status,arrival_date,departure_date,adults,currency,total_amount,updated_at) VALUES($1::uuid,$2,$1::text,'DESK','CONFIRMED','2040-01-02','2040-01-05',1,'USD',300,now())`,[reservation,p.id]);
  const accommodation=(await pool.query('SELECT id FROM accommodation_types LIMIT 1')).rows[0].id;
  await pool.query(`INSERT INTO reservation_items(id,reservation_id,accommodation_type_id,arrival_date,departure_date,price,status,updated_at) VALUES($1,$2,$3,'2040-01-02','2040-01-05',300,'CONFIRMED',now())`,[item,reservation,accommodation]);
  await pool.query(`INSERT INTO folios(id,reservation_item_id,currency) VALUES($1,$2,'USD')`,[folio,item]);
  for(const [date,amount,created,voided] of [['2040-01-03',101,'2040-01-02T18:59Z',null],['2040-01-03',202,'2040-01-02T19:00Z',null],['2040-01-02',999,'2040-01-03T02:00Z',null],['2040-01-03',999,'2040-01-03T04:00Z',null],['2040-01-03',999,'2040-01-03T02:00Z','2040-01-03T02:01Z']]) await pool.query(`INSERT INTO charges(id,folio_id,kind,description,unit_price,amount,service_date,created_at,voided_at) VALUES($1,$2,'ACCOMMODATION','Synthetic DATE boundary',$3,$3,$4,$5,$6)`,[randomUUID(),folio,amount,date,created,voided]);
  const hotelMoney=await readOwnerMoney(db,{locationId,organizationId,vertical:'HOSPITALITY',propertyId:p.id,from,now,fromDate:'2040-01-03',toDate:'2040-01-03',timezone:'Asia/Almaty'});
  expect(hotelMoney.revenue.currencies).toEqual([{currency:'USD',amountMinor:'303'}]);
  for(const [amount,created] of [[333,'2040-01-02T02:00Z'],[444,'2040-01-02T04:00Z']] as const) await pool.query(`INSERT INTO charges(id,folio_id,kind,description,unit_price,amount,service_date,created_at) VALUES($1,$2,'ACCOMMODATION','Synthetic prior DATE',$3,$3,'2040-01-02',$4)`,[randomUUID(),folio,amount,created]);
  expect(hotelMoney.revenue.daily.days).toEqual([{date:'2040-01-03',unresolvedSources:0,currencies:[{currency:'USD',amountMinor:'303'}]}]);
  const payment=randomUUID();
  await pool.query(`INSERT INTO payments(id,property_id,method,amount,currency,paid_at) VALUES($1,$2,'CASH',123,'USD','2040-01-03T02:00Z')`,[payment,p.id]);
  const r=await readOwnerMoney(db,{locationId:p.location_id,organizationId:p.organization_id,vertical:'HOSPITALITY',propertyId:p.id,from,now,fromDate:'2040-01-03',toDate:'2040-01-03'});
  expect(r.receipts.currencies).toEqual([{currency:'USD',amountMinor:'123'}]);
  const foreign=await readOwnerMoney(db,{locationId:randomUUID(),organizationId:p.organization_id,vertical:'HOSPITALITY',propertyId:p.id,from,now,fromDate:'2040-01-03',toDate:'2040-01-03'});
  expect(foreign.receipts.currencies).toEqual([]);
  const cash=randomUUID(), category=randomUUID(), document=randomUUID();
  await pool.query(`INSERT INTO expense_categories(id,location_id,code,name) VALUES($1::uuid,$2,$1::text,'Synthetic hotel category')`,[category,locationId]);
  await pool.query(`INSERT INTO expense_documents(id,location_id,category_id,title,document_date,amount_minor,currency,state) VALUES($1,$2,$3,'Synthetic hotel document','2040-01-03',100000,'USD','ACTIVE')`,[document,locationId,category]);
  await pool.query(`INSERT INTO cash_operations(id,property_id,kind,method,amount,currency_snapshot,occurred_at) VALUES($1,$2,'EXPENSE','CASH',40000,'USD','2040-01-03T02:00Z')`,[cash,p.id]);
  await pool.query(`INSERT INTO expense_settlements(id,location_id,expense_document_id,cash_operation_id) VALUES($1,$2,$3,$4)`,[randomUUID(),locationId,document,cash]);
  await pool.query(`UPDATE businesses SET vertical='HOSPITALITY' WHERE id=$1`,[business]);
  const {OwnerSummaryService}=await import('../../apps/api/src/finance/owner-summary');
  const {withSignedInUser}=await import('../../apps/api/src/auth/request-context');
  const service=new OwnerSummaryService({db} as never);
  const report=(org=organizationId)=>withSignedInUser({userId:randomUUID(),organizationId:org,role:'OWNER',scope:'LOCATION',locationId,businessId:business},()=>service.report('today',now));
  process.env.EXPENSE_LINKS_ENABLED='1';
  try {
    const result=await report();
    expect(result.previous?.revenue.currencies).toEqual([{currency:'USD',amountMinor:'333'}]);
    expect(result.previous?.revenue.daily.days).toEqual([{date:'2040-01-02',unresolvedSources:0,currencies:[{currency:'USD',amountMinor:'333'}]}]);
    expect(result.classificationState).toBe('READY');
    expect(result.current.paidExpenses.reason).toBeNull();
    expect(result.current.paidExpenses.currencies?.[0]?.paidMinor).toBe('40000');
    expect(('daily' in result.current.paidExpenses ? result.current.paidExpenses.daily.currencies : null)).toEqual([{currency:'USD',amountMinor:'40000'}]);
    const {PrismaFinanceRepository}=await import('../../apps/api/src/finance/finance.repository');
    const repo=new PrismaFinanceRepository({db} as never);
    const actor={userId:(await pool.query('SELECT id FROM users LIMIT 1')).rows[0].id,organizationId,role:'OWNER' as const,scope:'LOCATION' as const,locationId,businessId:business};
    const direct=await withSignedInUser(actor,()=>repo.createCashOperation({idempotencyKey:randomUUID(),kind:'EXPENSE',method:'CASH',amountMinor:11n,categoryId:null,note:null,methodTo:null,occurredAt:'2040-01-02T18:59Z',commission:null}));
    expect((await pool.query('SELECT kind,currency_snapshot FROM cash_operations WHERE id=$1',[direct])).rows).toEqual([{kind:'EXPENSE',currency_snapshot:'EUR'}]);
    const id=await withSignedInUser(actor,()=>repo.createCashOperation({idempotencyKey:randomUUID(),kind:'INCOME',method:'CASH',amountMinor:21n,categoryId:null,note:null,methodTo:null,occurredAt:'2040-01-03T02:00Z',commission:{amountMinor:3n,categoryId:null}}));
    await expect(pool.query("UPDATE cash_operations SET currency_snapshot='USD' WHERE id=$1",[id])).rejects.toThrow('hotel cash currency immutable');
    const written=(await pool.query('SELECT kind,currency_snapshot FROM cash_operations WHERE id=$1 OR related_id=$1 ORDER BY kind::text',[id])).rows;
    expect(written).toEqual([{kind:'EXPENSE',currency_snapshot:'EUR'},{kind:'INCOME',currency_snapshot:'EUR'}]);
    await pool.query("UPDATE properties SET currency='KZT' WHERE id=$1",[p.id]);
    const mixed=await report();
    expect(mixed.current.receipts.currencies).toEqual([{currency:'EUR',amountMinor:'21'},{currency:'USD',amountMinor:'123'}]);
    expect(mixed.current.paidExpenses.currencies?.map(c=>[c.currency,c.paidMinor])).toEqual([['EUR','3'],['USD','40000']]);
    for(const metric of [mixed.current.receipts,mixed.current.paidExpenses]) for(const c of metric.currencies??[]) expect(('daily' in metric ? metric.daily?.days?.reduce((a,d)=>a+BigInt(d.currencies.find(v=>v.currency===c.currency)?.amountMinor??'0'),0n) : null)?.toString()).toBe('amountMinor' in c?c.amountMinor:c.paidMinor);
    await pool.query(`INSERT INTO cash_operations(id,property_id,kind,method,amount,occurred_at) VALUES($1,$2,'INCOME','CASH',9,'2040-01-03T02:00Z')`,[randomUUID(),p.id]);
    expect((await report()).current.receipts.state).toBe('PARTIAL');
    await pool.query("UPDATE cash_operations SET status='VOIDED' WHERE id=$1 OR related_id=$1",[id]);
    expect((await report()).current.receipts.currencies).toEqual([{currency:'USD',amountMinor:'123'}]);
    await withSignedInUser(actor,()=>repo.createCashReconciliation({idempotencyKey:randomUUID(),method:'CASH',expectedMinor:0n,countedMinor:7n,note:null,adjustment:{kind:'INCOME',amountMinor:7n,categoryName:'Synthetic adjustment'}}));
    expect((await pool.query("SELECT currency_snapshot FROM cash_operations WHERE property_id=$1 AND note='Поправка по сверке кассы'",[p.id])).rows).toEqual([{currency_snapshot:'KZT'}]);
    await expect(report(randomUUID())).rejects.toThrow();
  } finally {delete process.env.EXPENSE_LINKS_ENABLED;}
 });
});
