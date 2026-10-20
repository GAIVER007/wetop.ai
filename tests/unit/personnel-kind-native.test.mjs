// Native adapter boundary tests; not HTTP/PG acceptance. DI inspects SQL and failures only.
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const root = new URL('../../', import.meta.url);
const domain = readFileSync(new URL('packages/domain/src/personnel.ts', root), 'utf8');
const source = readFileSync(new URL('apps/api/src/beauty/personnel-kind.ts', root), 'utf8');
class HttpError extends Error {}
const env = {};
const api = runInNewContext(stripTypeScriptTypes(domain.replace(/^export /gm, '') + '\n' + source.replace(/^import .*;\n/gm, '').replace(/^export /gm, '') + '\n({personnelKindEnabled,parsePersonnelKindCommand,writePersonnelKind,readPersonnelEmployeeProfiles: typeof readPersonnelEmployeeProfiles === "function" ? readPersonnelEmployeeProfiles : undefined})'), {
  process: { env }, Map, BadRequestException: HttpError, ConflictException: HttpError,
  NotFoundException: HttpError, ServiceUnavailableException: HttpError,
  employeeProfileRevision(value) { if(typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value)) throw new HttpError('revision'); return value; },
});
const scope = {organizationId:'org',businessId:'business'};
const revision = '2026-10-18T12:00:00.123456Z';
test('flag off performs no held SQL and rejects writes', async () => {
  delete env.PERSONNEL_KIND_ENABLED;
  const db = {$queryRaw(){throw Error('must not query');}};
  assert.equal(api.personnelKindEnabled(),false);
  assert.equal((await api.readPersonnelEmployeeProfiles(db,scope)).length,0);
  await assert.rejects(api.writePersonnelKind(db,scope,'id',{personnelKind:'BOTH',expectedProfileRevision:revision}),/unavailable/);
});
test('strict command whitelist rejects null arrays coercion and unrelated fields', () => {
  for(const body of [null,[],{}, {personnelKind:null,expectedProfileRevision:revision},{personnelKind:['BOTH'],expectedProfileRevision:revision},{personnelKind:'BOTH',expectedProfileRevision:1},{personnelKind:'BOTH',expectedProfileRevision:revision,name:'bad'}]) assert.throws(()=>api.parsePersonnelKindCommand(body));
  assert.equal(api.parsePersonnelKindCommand({personnelKind:'BOTH',expectedProfileRevision:revision}).personnelKind,'BOTH');
});
test('enabled read binds business organization; missing SQL fails unavailable', async () => {
  env.PERSONNEL_KIND_ENABLED='1'; let count=0;
  const db = {$queryRaw(strings,...values){count++; assert.ok(strings.join('?').includes('personnel_kind')); assert.ok(values.includes('org')); assert.ok(values.includes('business')); throw Error('missing column');}};
  await assert.rejects(api.readPersonnelEmployeeProfiles(db,scope),/unavailable/); assert.equal(count,1);
});
test('write lock binds scope and stale revision never updates', async () => {
  env.PERSONNEL_KIND_ENABLED='1'; let calls=0;
  const db = {$queryRaw(strings,...values){ calls++; assert.ok(strings.join('?').includes('FOR UPDATE')); assert.ok(values.includes('org')); assert.ok(values.includes('business')); return [{id:'id',personnelKind:null,profileRevision:'2026-10-18T12:00:00.123457Z'}]; }};
  await assert.rejects(api.writePersonnelKind(db,scope,'id',{personnelKind:'BOTH',expectedProfileRevision:revision}),/changed/); assert.equal(calls,1);
});
test('foreign or absent scoped target never updates', async () => {
  let calls=0; const db={$queryRaw(){calls++;return [];}};
  await assert.rejects(api.writePersonnelKind(db,scope,'foreign',{personnelKind:'BOTH',expectedProfileRevision:revision}),/not found/); assert.equal(calls,1);
});

for (const scenario of ['full row snapshot', 'empty still queries', 'missing held column empty', 'invalid stored enum']) test(scenario, async () => {
  env.PERSONNEL_KIND_ENABLED='1';
  assert.equal(typeof api.readPersonnelEmployeeProfiles, 'function', 'single-snapshot full-profile read must exist');
  let calls=0;
  const row={id:'id',name:'Synthetic',phone:null,email:null,status:'ACTIVE',profileRevision:revision,personnelKind:null};
  const db={$queryRaw(strings,...values){
    calls++; const sql=strings.join('?');
    for(const field of ['e.id','e.name','e.phone','e.email','e.status','e.personnel_kind','e.updated_at','SS.US']) assert.ok(sql.includes(field),field);
    assert.deepEqual(values,['business','org']); assert.ok(!sql.includes('FOR UPDATE'));
    if(scenario==='missing held column empty') throw Error('missing column');
    if(scenario==='invalid stored enum') return [{...row,personnelKind:'unknown'}];
    return scenario==='empty still queries'?[]:[row];
  }};
  if(['missing held column empty','invalid stored enum'].includes(scenario)) await assert.rejects(api.readPersonnelEmployeeProfiles(db,scope),/unavailable/);
  else { const rows=await api.readPersonnelEmployeeProfiles(db,scope); assert.equal(rows.length,scenario==='empty still queries'?0:1); if(rows.length) assert.equal(JSON.stringify(rows[0]),JSON.stringify(row)); }
  assert.equal(calls,1);
});
test('single snapshot OFF is SQL-free', async()=>{
  delete env.PERSONNEL_KIND_ENABLED;
  assert.equal(typeof api.readPersonnelEmployeeProfiles,'function','single-snapshot interface must exist');
  assert.equal((await api.readPersonnelEmployeeProfiles({$queryRaw(){throw Error('unexpected SQL');}},scope)).length,0);
});
test('microsecond CAS binds original source', async()=>{
  env.PERSONNEL_KIND_ENABLED='1'; let calls=0;
  await api.writePersonnelKind({$queryRaw(strings,...values){calls++;const sql=strings.join('?');if(calls===2){assert.ok(sql.includes("INTERVAL '1 microsecond'"));assert.ok(sql.includes('SS.US'));assert.ok(values.includes(revision));}return [{id:'id',personnelKind:null,profileRevision:revision}];}},scope,'id',{personnelKind:'BOTH',expectedProfileRevision:revision});
  assert.equal(calls,2);
});
