import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
const url = process.env.DATABASE_URL;
const ids = { org: randomUUID(), other: randomUUID(), business: randomUUID(), foreignBusiness: randomUUID(), user: randomUUID(), run: randomUUID(), second: randomUUID(), foreignRun: randomUUID(), row: randomUUID() };
describe.skipIf(!url)('M4-B2: durable tenant storage', () => {
  let db: pg.Client;
  beforeAll(async () => {
    db = new pg.Client({ connectionString: url }); await db.connect(); await db.query('SET search_path TO pms_test,public');
    for (const org of [ids.org, ids.other]) await db.query("INSERT INTO organizations(id,name,status) VALUES($1,'Synthetic import storage','ACTIVE')", [org]);
    await db.query("INSERT INTO businesses(id,organization_id,name,vertical,updated_at) VALUES($1,$2,'Synthetic salon','BEAUTY',now()),($3,$4,'Synthetic other','BEAUTY',now())", [ids.business,ids.org,ids.foreignBusiness,ids.other]);
    await db.query("INSERT INTO users(id,email,name) VALUES($1,$2,'Synthetic import owner')", [ids.user, `storage-${ids.user}@example.invalid`]);
    for (const [id,org,business] of [[ids.run,ids.org,ids.business],[ids.second,ids.org,ids.business],[ids.foreignRun,ids.other,ids.foreignBusiness]])
      await db.query("INSERT INTO customer_imports(id,organization_id,business_id,created_by,client_request_id,request_digest,total_rows,contents_expire_at) VALUES($1,$2,$3,$4,$5,$6,1,now()+interval '30 days')", [id,org,business,ids.user,randomUUID(),'a'.repeat(64)]);
    await db.query("INSERT INTO customer_import_rows(id,organization_id,import_id,ordinal,source_line,input) VALUES($1,$2,$3,0,2,$4)", [ids.row,ids.org,ids.run,{firstName:'Synthetic',lastName:null,phone:null}]);
  });
  afterAll(async () => {
    if (!db) return;
    await db.query('ROLLBACK'); await db.query('RESET ROLE');
    await db.query('DELETE FROM customer_import_rows WHERE organization_id=ANY($1::uuid[])', [[ids.org,ids.other]]);
    await db.query('DELETE FROM customer_imports WHERE organization_id=ANY($1::uuid[])', [[ids.org,ids.other]]);
    await db.query('DELETE FROM businesses WHERE id=ANY($1::uuid[])', [[ids.business,ids.foreignBusiness]]);
    await db.query('DELETE FROM users WHERE id=$1', [ids.user]);
    await db.query('DELETE FROM organizations WHERE id=ANY($1::uuid[])', [[ids.org,ids.other]]);
    await db.end();
  });
  it('has both tables with forced tenant RLS', async () => {
    const rows = (await db.query("SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class JOIN pg_namespace n ON n.oid=relnamespace WHERE n.nspname='pms_test' AND relname IN ('customer_imports','customer_import_rows') ORDER BY relname")).rows;
    expect(rows).toEqual([{relname:'customer_import_rows',relrowsecurity:true,relforcerowsecurity:true},{relname:'customer_imports',relrowsecurity:true,relforcerowsecurity:true}]);
  });
  it('retains audit journal by denying tenant DELETE', async () => {
    const result = (await db.query("SELECT has_table_privilege('wetop_app','customer_imports','DELETE') AS parent,has_table_privilege('wetop_app','customer_import_rows','DELETE') AS child")).rows[0];
    expect(result).toEqual({parent:false,child:false});
  });
  it('keeps row source identity and run immutable even to a service writer', async () => {
    for (const query of [
      ['UPDATE customer_import_rows SET source_line=3 WHERE id=$1',[ids.row]],
      ['UPDATE customer_import_rows SET import_id=$2 WHERE id=$1',[ids.row,ids.second]],
      ['UPDATE customer_imports SET id=$2 WHERE id=$1',[ids.second,randomUUID()]],
    ] as const) {
      await db.query('BEGIN');
      try { await expect(db.query(query[0], [...query[1]])).rejects.toMatchObject({code:'23514'}); }
      finally { await db.query('ROLLBACK'); }
    }
  });
  it('cannot forge tenant or use a foreign parent through wetop_app', async () => {
    await db.query('BEGIN');
    try {
      await db.query('SET LOCAL ROLE wetop_app');
      await db.query("SELECT set_config('app.org_id',$1,true)", [ids.org]);
      expect((await db.query('SELECT id FROM customer_imports ORDER BY id')).rows.map((r) => r.id).sort()).toEqual([ids.run,ids.second].sort());
      expect((await db.query('SELECT id FROM customer_import_rows WHERE organization_id=$1',[ids.other])).rows).toEqual([]);
      await expect(db.query('INSERT INTO customer_import_rows(organization_id,import_id,ordinal,source_line) VALUES($1,$2,1,3)',[ids.org,ids.foreignRun])).rejects.toMatchObject({code:'23503'});
    } finally { await db.query('ROLLBACK'); }
  });
  it('has no FK on a deletable customer and no cascade to business data', async () => {
    const refs = (await db.query("SELECT confrelid::regclass::text AS target,confdeltype FROM pg_constraint WHERE conrelid='customer_import_rows'::regclass AND contype='f'")).rows;
    expect(refs.some((r) => r.target.endsWith('customers'))).toBe(false);
    expect(refs.every((r) => r.confdeltype !== 'c')).toBe(true);
  });
});


describe.skipIf(!url)('M4-B2 migration rollback in an isolated synthetic schema', () => {
  it('preserves old customers, refuses nonempty rollback, removes only empty journal', async () => {
    const client = new pg.Client({ connectionString: url }); await client.connect();
    const schema = 'import_rollback_' + randomUUID().replace(/-/g, '');
    const folder = resolve(import.meta.dirname, '../../packages/database/prisma/migrations/20261018000132_customer_imports');
    const org = randomUUID(), business = randomUUID(), user = randomUUID(), run = randomUUID(), customer = randomUUID();
    try {
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET search_path TO "${schema}",public`);
      await client.query('CREATE TABLE organizations(id uuid PRIMARY KEY); CREATE TABLE businesses(id uuid PRIMARY KEY,organization_id uuid,vertical text); CREATE TABLE users(id uuid PRIMARY KEY); CREATE TABLE customers(id uuid PRIMARY KEY,first_name text,phone text)');
      await client.query('INSERT INTO organizations VALUES($1)',[org]);
      await client.query("INSERT INTO businesses VALUES($1,$2,'BEAUTY')",[business,org]);
      await client.query('INSERT INTO users VALUES($1)',[user]);
      await client.query("INSERT INTO customers VALUES($1,'Initial synthetic customer',NULL)",[customer]);
      await client.query(readFileSync(resolve(folder,'migration.sql'),'utf8'));
      const before = (await client.query('SELECT * FROM customers')).rows;
      await client.query("INSERT INTO customer_imports(id,organization_id,business_id,created_by,client_request_id,request_digest,total_rows,contents_expire_at) VALUES($1,$2,$3,$4,$5,$6,1,now()+interval '30 days')",[run,org,business,user,randomUUID(),'a'.repeat(64)]);
      await expect(client.query(readFileSync(resolve(folder,'down.sql'),'utf8'))).rejects.toThrow('contains history');
      await client.query('ROLLBACK');
      expect((await client.query('SELECT * FROM customers')).rows).toEqual(before);
      expect((await client.query('SELECT count(*)::int AS n FROM customer_imports')).rows[0].n).toBe(1);
      await client.query('DELETE FROM customer_imports WHERE id=$1',[run]);
      await client.query(readFileSync(resolve(folder,'down.sql'),'utf8'));
      expect((await client.query('SELECT * FROM customers')).rows).toEqual(before);
      expect((await client.query("SELECT to_regclass('customer_imports') AS id")).rows[0].id).toBeNull();
    } finally {
      await client.query('ROLLBACK');
      await client.query('SET search_path TO public');
      await client.query(`DROP SCHEMA "${schema}" CASCADE`); await client.end();
    }
  });
});
