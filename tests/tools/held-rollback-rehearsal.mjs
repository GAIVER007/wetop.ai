// Local synthetic rehearsal ONLY. No env files, source data reads, resets or promotion.
import pg from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import process from 'node:process';
import console from 'node:console';
const root='packages/database/prisma/migrations-hold';
const dirs=readdirSync(root).filter(x=>/^2026101600011[4-8]_/.test(x)).sort();
assert.equal(dirs.length,5);
const files=d=>['migration.sql',...(d.includes('116_')?['opening.sql']:[])];
const tables=d=>files(d).flatMap(f=>[...readFileSync(`${root}/${d}/${f}`,'utf8').matchAll(/CREATE TABLE (\w+)/g)].map(x=>x[1]));
const down=d=>readFileSync(`${root}/${d}/down.sql`,'utf8').replace(/^BEGIN;|^COMMIT;|^SET TRANSACTION ISOLATION LEVEL READ COMMITTED;/gm,'');
const db=new pg.Client({connectionString:'postgresql://owner_home_test@127.0.0.1:55516/wetop_owner_home'});
await db.connect();
let retained=0,wrongOrder=0;
try {
 await db.query('BEGIN ISOLATION LEVEL READ COMMITTED');
 const schema='rollback_rehearsal_'+process.pid;
 await db.query(`CREATE SCHEMA ${schema}; SET LOCAL search_path=${schema},public`);
 // Metadata-only LIKE: no original rows/triggers/FKs copied. Not a production baseline proof.
 const baseline=(await db.query("select tablename from pg_tables where schemaname='pms_test'")).rows;
 const owned=new Set(dirs.flatMap(tables));
 for(const {tablename:t} of baseline) if(!owned.has(t)) await db.query(`CREATE TABLE "${t}" (LIKE pms_test."${t}" INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES)`);
 await db.query('ALTER TABLE cash_operations DROP COLUMN IF EXISTS currency_snapshot');
 await db.query('CREATE FUNCTION app_current_org() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT null::uuid $$');
 for(const d of dirs) for(const f of files(d)) await db.query(readFileSync(`${root}/${d}/${f}`,'utf8'));
 console.log('APPLY: all six actual SQL files succeeded on synthetic metadata clones');
 // Assert the exact guard error, then rollback the failed statement before checking intact data.
 const refusal=async(d,pattern)=>{
  await db.query('SAVEPOINT refusal');
  let error;try {await db.query(down(d));}catch(e){error=e;}
  await db.query('ROLLBACK TO SAVEPOINT refusal');
  assert.match(error?.message??'',pattern);
 };
 for(const d of dirs.slice(0,-1)) {
  await refusal(d,/ROLLBACK_NEWER_RELEASE_INSTALLED/); wrongOrder++;
  for(const t of tables(d)) assert.notEqual((await db.query('select to_regclass($1) x',[`${schema}.${t}`])).rows[0].x,null);
  console.log('WRONG ORDER REFUSED:',d);
 }
 // Deliberately malformed retained history: bypass synthetic constraints ONLY in savepoint.
 // This proves ANY row refuses, not that these are valid business fixtures.
 const seed=async(t,extra={})=>{
  await db.query(`ALTER TABLE ${t} DISABLE TRIGGER ALL`);
  const checks=(await db.query("select conname from pg_constraint where conrelid=$1::regclass and contype='c'",[`${schema}.${t}`])).rows;
  for(const {conname} of checks) await db.query(`ALTER TABLE ${t} DROP CONSTRAINT "${conname}"`);
  const cols=(await db.query('select column_name,data_type,is_nullable from information_schema.columns where table_schema=$1 and table_name=$2',[schema,t])).rows;
  const values={};
  for(const c of cols) if(c.is_nullable==='NO') {
   const type=c.data_type;
   values[c.column_name]=type==='uuid'?'11111111-1111-4111-8111-111111111111':type==='date'?'2026-10-16':type.includes('timestamp')?'2026-10-16T00:00:00Z':type.startsWith('time')?'00:00:00':type==='boolean'?true:/integer|numeric|bigint|smallint|double|real/.test(type)?1:type==='jsonb'||type==='json'?{}:type==='ARRAY'?[]:type==='character'?'KZT':'synthetic';
  }
  const enums=(await db.query("select a.attname, (select enumlabel from pg_enum where enumtypid=a.atttypid order by enumsortorder limit 1) label from pg_attribute a where a.attrelid=$1::regclass and a.attnum>0",[`${schema}.${t}`])).rows;
  for(const c of enums) if(c.label) values[c.attname]=c.label;
  await db.query(`insert into ${t} OVERRIDING SYSTEM VALUE select (jsonb_populate_record(null::${t},$1::jsonb)).*`,[JSON.stringify({...values,...extra})]);
 };
 for(const d of [...dirs].reverse()) {
  for(const t of tables(d)) {
   await db.query('SAVEPOINT populated');
   await seed(t);
   const before=JSON.stringify((await db.query(`select to_jsonb(x) as row from ${t} x`)).rows);
   await refusal(d,new RegExp(`ROLLBACK_RETAINED_DATA: ${t}\\b`));
   assert.equal(JSON.stringify((await db.query(`select to_jsonb(x) as row from ${t} x`)).rows),before);
   retained++; console.log('REFUSED + history unchanged:',d,t);
   await db.query('ROLLBACK TO SAVEPOINT populated');
  }
  if(d.includes('114_')) {
   await db.query('SAVEPOINT snapshot');
   await seed('cash_operations',{currency_snapshot:'KZT'});
   assert.equal((await db.query('select count(*)::int n from expense_documents')).rows[0].n,0);
   await refusal(d,/ROLLBACK_RETAINED_DATA: currency_snapshot/);
   assert.equal((await db.query('select currency_snapshot from cash_operations')).rows[0].currency_snapshot,'KZT');
   console.log('SNAPSHOT REFUSED: nonnull with zero expense documents');
   await db.query('ROLLBACK TO SAVEPOINT snapshot');
  }
  // Run guard alone and inspect real PostgreSQL locks before teardown, all in same transaction.
  const sql=down(d), boundary=sql.indexOf('END $$;')+7;
  await db.query(sql.slice(0,boundary));
  const locked=new Set((await db.query("select c.relname from pg_locks l join pg_class c on c.oid=l.relation join pg_namespace n on n.oid=c.relnamespace where l.pid=pg_backend_pid() and l.mode='AccessExclusiveLock' and l.granted and n.nspname=$1",[schema])).rows.map(x=>x.relname));
  for(const m of sql.matchAll(/LOCK TABLE %I\.%I IN ACCESS EXCLUSIVE MODE',current_schema\(\),'(\w+)'/g)) assert(locked.has(m[1]),`missing lock ${m[1]}`);
  await db.query(sql.slice(boundary));
  for(const t of tables(d)) assert.equal((await db.query('select to_regclass($1) x',[`${schema}.${t}`])).rows[0].x,null);
  console.log('EMPTY DOWN + all source/owned locks verified:',d);
 }
 assert.equal(retained,owned.size); assert.equal(wrongOrder,4);
 await db.query('ROLLBACK');
 console.log(`PASS: ${retained}/${owned.size} owned-table retained guards, snapshot, ${wrongOrder} wrong-order refusals, 5 empty downs; all changes rolled back`);
} finally {await db.query('ROLLBACK');await db.end();}
