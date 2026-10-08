# Synthetic restoration procedure

PostgreSQL17.6 server on own loopback55934; pg_dump/pg_restore18.3 clients. Dumped only synthetic pms_dev to a temporary custom-format archive, restored into own unified_restore_20261008. Compared sorted per-table row JSON digests, migration names, indexes, functions, policies, FORCE RLS and grants. Raw definitions of7 CHECK constraints changed parentheses/array casts after reparsing. Both definitions were independently applied to temporary LIKE tables; PostgreSQL returned identical definitions for every pair. Raw differences are retained in RESTORE-2026-10-08.json, not silently normalized away.

Full migration-chain and rollback evidence: MIGRATION-CHAIN-PG17.log, RESULT: OK for74 migrations. Production backup/restore and deployment were not performed.

Comparison script (synthetic fixture only):

```javascript
import pg from '/Users/urijzapojnov/wetop-unified-acceptance-20261007/node_modules/pg/lib/index.js';
import { writeFile } from 'node:fs/promises';
const root='/Users/urijzapojnov/wetop-unified-acceptance-20261007/reports/unified-stage-2026-10-07';
const clients=['pms_dev','unified_restore_20261008'].map(database=>new pg.Client({host:'127.0.0.1',port:55934,user:'pms',database}));
const q=s=>'"'+s.replaceAll('"','""')+'"';
async function snapshot(c){
 await c.connect();
 const tables=(await c.query("SELECT tablename FROM pg_tables WHERE schemaname='pms_test' ORDER BY tablename")).rows;
 const data=[];
 for(const {tablename} of tables){
 const {rows}=await c.query(`SELECT count(*)::text AS rows, md5(coalesce(string_agg(row_to_json(t)::text,E'\\n' ORDER BY row_to_json(t)::text),'')) AS digest FROM pms_test.${q(tablename)} t`);
 data.push({table:tablename,...rows[0]});
 }
 const catalogs={};
 for(const [name,query] of Object.entries({
 constraints:"SELECT conrelid::regclass::text AS relation, conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace='pms_test'::regnamespace ORDER BY relation,conname",
 indexes:"SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='pms_test' ORDER BY tablename,indexname",
 functions:"SELECT proname,pg_get_functiondef(oid) AS definition FROM pg_proc WHERE pronamespace='pms_test'::regnamespace AND prokind='f' ORDER BY proname,oid::regprocedure::text",
 policies:"SELECT * FROM pg_policies WHERE schemaname='pms_test' ORDER BY tablename,policyname",
 rls:"SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relnamespace='pms_test'::regnamespace AND relkind='r' ORDER BY relname",
 grants:"SELECT table_name,grantee,privilege_type FROM information_schema.role_table_grants WHERE table_schema='pms_test' ORDER BY table_name,grantee,privilege_type"
 })){catalogs[name]=(await c.query(query)).rows;}
 const migrations=(await c.query('SELECT name FROM pms_test._test_migrations ORDER BY name')).rows;
 return {data,catalogs,migrations};
}
try{
 const snapshots=[];
 for(const c of clients)snapshots.push(await snapshot(c));
 const [before,after]=snapshots;
 const results={syntheticOnly:true,serverVersion:(await clients[0].query('SHOW server_version')).rows[0].server_version,clientTools:'pg_dump/pg_restore18.3',tables:before.data.length,migrations:before.migrations.length,dataEqual:JSON.stringify(before.data)===JSON.stringify(after.data),checks:Object.fromEntries(Object.keys(before.catalogs).map(k=>[k,{equal:JSON.stringify(before.catalogs[k])===JSON.stringify(after.catalogs[k]),count:before.catalogs[k].length}])),migrationHistoryEqual:JSON.stringify(before.migrations)===JSON.stringify(after.migrations)};
 const rawConstraintEqual=results.checks.constraints.equal;
 const reparsed=[];
 for(let i=0;i<before.catalogs.constraints.length;i++){
 const a=before.catalogs.constraints[i],b=after.catalogs.constraints[i];
 if(JSON.stringify(a)===JSON.stringify(b))continue;
 if(a.relation!==b.relation||a.conname!==b.conname||!a.definition.startsWith('CHECK ')||!b.definition.startsWith('CHECK '))throw new Error('Non-CHECK constraint mismatch');
 const definitions=[];
 for(const row of [a,b]){
  await clients[0].query(`CREATE TEMP TABLE unified_constraint_probe (LIKE ${row.relation})`);
  try{
   await clients[0].query(`ALTER TABLE unified_constraint_probe ADD CONSTRAINT probe ${row.definition}`);
   definitions.push((await clients[0].query("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='pg_temp.unified_constraint_probe'::regclass AND conname='probe'")).rows[0].definition);
  } finally {await clients[0].query('DROP TABLE unified_constraint_probe');}
 }
 reparsed.push({relation:a.relation,constraint:a.conname,equal:definitions[0]===definitions[1],before:a.definition,after:b.definition});
 }
 results.rawConstraintEqual=rawConstraintEqual;
 results.reparsedCheckDifferences=reparsed;
 results.checks.constraints.equal=rawConstraintEqual||reparsed.length>0&&reparsed.every(x=>x.equal);
 results.pass=results.dataEqual&&results.migrationHistoryEqual&&Object.values(results.checks).every(x=>x.equal);
 await writeFile(root+'/RESTORE-2026-10-08.json',JSON.stringify(results,null,2)+'\n');
 console.log(JSON.stringify(results));
 if(!results.pass)process.exitCode=1;
} finally {await Promise.all(clients.map(c=>c.end()));}

```
