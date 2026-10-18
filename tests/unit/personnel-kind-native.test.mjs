// Native adapter boundary tests; not HTTP/PG acceptance. DI inspects SQL and failures only.
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const root = new URL('../../', import.meta.url);
const domain = readFileSync(new URL('packages/domain/src/personnel.ts', root), 'utf8');
const source = readFileSync(new URL('apps/api/src/beauty/personnel-kind.ts', root), 'utf8');
class HttpError extends Error {}
const env = {};
const api = runInNewContext(stripTypeScriptTypes(domain.replace(/^export /gm, '') + '\n' + source.replace(/^import .*;\n/gm, '').replace(/^export /gm, '') + '\n({personnelKindEnabled,parsePersonnelKindCommand,readPersonnelKinds,writePersonnelKind})'), {
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
  assert.equal((await api.readPersonnelKinds(db,scope,['id'])).size,0);
  await assert.rejects(api.writePersonnelKind(db,scope,'id',{personnelKind:'BOTH',expectedProfileRevision:revision}),/unavailable/);
});
test('strict command whitelist rejects null arrays coercion and unrelated fields', () => {
  for(const body of [null,[],{}, {personnelKind:null,expectedProfileRevision:revision},{personnelKind:['BOTH'],expectedProfileRevision:revision},{personnelKind:'BOTH',expectedProfileRevision:1},{personnelKind:'BOTH',expectedProfileRevision:revision,name:'bad'}]) assert.throws(()=>api.parsePersonnelKindCommand(body));
  assert.equal(api.parsePersonnelKindCommand({personnelKind:'BOTH',expectedProfileRevision:revision}).personnelKind,'BOTH');
});
test('enabled batch binds business organization and authorized ids; missing SQL fails unavailable', async () => {
  env.PERSONNEL_KIND_ENABLED='1'; let count=0;
  const db = {$queryRaw(strings,...values){count++; assert.ok(strings.join('?').includes('personnel_kind')); assert.ok(values.includes('org')); assert.ok(values.includes('business')); assert.ok(values.some(v=>Array.isArray(v)&&v[0]==='id')); throw Error('missing column');}};
  await assert.rejects(api.readPersonnelKinds(db,scope,['id']),/unavailable/); assert.equal(count,1);
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
