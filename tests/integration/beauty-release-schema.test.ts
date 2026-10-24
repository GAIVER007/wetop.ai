import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BEAUTY_PREPARATION_NAMES } from '../tools/beauty-release-preparation';
import { beautyReleaseFixtureUrl } from '../tools/beauty-release-fixture';

const root = resolve(import.meta.dirname, '../..');
const migrations = resolve(root, 'packages/database/prisma/migrations');
const names = [...BEAUTY_PREPARATION_NAMES];
let later: string[] = [];
const id = Object.fromEntries(['org', 'business', 'location', 'employee', 'customer', 'service', 'appointment'].map(k => [k, randomUUID()]));
let db: pg.Client;
let databaseUrl: string;
let baseline: unknown;
const databaseName = `salon_release_proof_${randomUUID().replaceAll('-', '')}`;

async function signature() {
  return (await db.query(`
    SELECT 'column' AS kind, c.relname||'.'||a.attname AS name,
      format_type(a.atttypid,a.atttypmod)||':'||a.attnotnull::text||':'||coalesce(pg_get_expr(d.adbin,d.adrelid),'') AS definition
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
    LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
    WHERE n.nspname='public' AND c.relkind='r'
    UNION ALL SELECT 'constraint',c.relname||'.'||k.conname,pg_get_constraintdef(k.oid)
    FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
    UNION ALL SELECT 'index',indexname,indexdef FROM pg_indexes WHERE schemaname='public'
    UNION ALL SELECT 'trigger_function',
      n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',
      json_build_object('definition',pg_get_functiondef(p.oid),'proconfig',p.proconfig)::text
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prokind='f' AND p.prorettype='pg_catalog.trigger'::regtype
    ORDER BY kind,name,definition`)).rows;
}

async function rollbackRefuses(name: string, seed: () => Promise<unknown>, message: RegExp) {
  await db.query('BEGIN');
  try {
    await seed();
    await db.query('SAVEPOINT retained');
    const down = readFileSync(resolve(migrations, name, 'down.sql'), 'utf8').replace(/^BEGIN;\s*/, '').replace(/\s*COMMIT;\s*$/, '');
    await expect(db.query(down)).rejects.toThrow(message);
    await db.query('ROLLBACK TO SAVEPOINT retained');
    expect((await db.query('SELECT count(*)::int AS count FROM appointments WHERE id=$1', [id.appointment])).rows[0].count).toBe(1);
  } finally { await db.query('ROLLBACK'); }
}

describe('Beauty schema release on a separate owned canonical database', () => {
  beforeAll(async () => {
    const url = beautyReleaseFixtureUrl(process.env.DATABASE_URL, process.env.CI === 'true', process.env.PMS_PORTAL_FIXTURE);
    const local = url.port === '55983';
    const admin = new pg.Client({ connectionString: url.toString() });
    await admin.connect();
    try {
      if (local) expect((await admin.query('SHOW data_directory')).rows[0].data_directory)
        .toBe('/opt/data/workspace/wetop-browser-readonly-check/salon-implementation/core-db/data');
      await admin.query(`CREATE DATABASE "${databaseName}" TEMPLATE template0 ENCODING 'UTF8'`);
    } finally { await admin.end(); }
    url.pathname = `/${databaseName}`; url.search = '';
    databaseUrl = url.toString();
    db = new pg.Client({ connectionString: databaseUrl }); await db.connect();
    await db.query('CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public');
    const dirs = readdirSync(migrations, { withFileTypes: true }).filter(x => x.isDirectory()).map(x => x.name).sort();
    // пять салонных миграций идут подряд; более поздние (с 138, «Персонал») вне этой проверки отката
    const first = dirs.indexOf(names[0]!);
    expect(dirs.slice(first, first + names.length)).toEqual(names);
    for (const name of dirs.slice(0, first)) await db.query(readFileSync(resolve(migrations, name, 'migration.sql'), 'utf8'));
    baseline = await signature();
    await db.query("INSERT INTO organizations(id,name,status) VALUES($1,'Synthetic release organization','ACTIVE')", [id.org]);
    await db.query("INSERT INTO businesses(id,organization_id,name,vertical,updated_at) VALUES($1,$2,'Synthetic salon','BEAUTY',now())", [id.business,id.org]);
    await db.query("INSERT INTO locations(id,business_id,name,timezone,currency,updated_at) VALUES($1,$2,'Synthetic branch','Asia/Almaty','KZT',now())", [id.location,id.business]);
    await db.query("INSERT INTO customers(id,organization_id,first_name,updated_at) VALUES($1,$2,'Synthetic customer',now())", [id.customer,id.org]);
    await db.query("INSERT INTO employees(id,business_id,name,updated_at) VALUES($1,$2,'Synthetic master',now())", [id.employee,id.business]);
    await db.query("INSERT INTO beauty_services(id,business_id,name,duration_minutes,price,currency,updated_at) VALUES($1,$2,'Synthetic service',30,123400,'KZT',now())", [id.service,id.business]);
    await db.query('INSERT INTO employee_locations(employee_id,location_id) VALUES($1,$2)', [id.employee,id.location]);
    await db.query('INSERT INTO employee_services(employee_id,service_id) VALUES($1,$2)', [id.employee,id.service]);
    await db.query('INSERT INTO location_services(location_id,service_id,updated_at) VALUES($1,$2,now())', [id.location,id.service]);
    await db.query("INSERT INTO appointments(id,location_id,customer_id,employee_id,service_id,starts_at,ends_at,price,currency,updated_at) VALUES($1,$2,$3,$4,$5,'2036-10-06T05:00Z','2036-10-06T05:30Z',123400,'KZT',now())", [id.appointment,id.location,id.customer,id.employee,id.service]);
    for (const name of names) await db.query(readFileSync(resolve(migrations, name, 'migration.sql'), 'utf8'));
    // более поздние миграции обычной цепочки (с 138): применены, чтобы схема совпала с Prisma
    later = dirs.slice(first + names.length);
    for (const name of later) await db.query(readFileSync(resolve(migrations, name, 'migration.sql'), 'utf8'));
    console.log(`Owned release proof ${databaseName}: ${dirs.length} canonical migrations, one populated legacy appointment`);
  });
  afterAll(async () => { if (db) await db.end(); }); // Preserve the owned proof database, never delete a donor/shared database.

  it('backfills one position-zero line with the exact legacy money and interval snapshots', async () => {
    const rows = await db.query(`SELECT l.position,l.price_minor::text,l.base_price_minor::text,l.discount_minor::text,l.surcharge_minor::text,
      l.starts_at=a.starts_at AS same_start,l.ends_at=a.ends_at AS same_end,l.employee_id=a.employee_id AS same_employee,l.service_id=a.service_id AS same_service
      FROM appointment_lines l JOIN appointments a ON a.id=l.appointment_id WHERE a.id=$1`, [id.appointment]);
    expect(rows.rows).toEqual([{position:0,price_minor:'123400',base_price_minor:'123400',discount_minor:'0',surcharge_minor:'0',same_start:true,same_end:true,same_employee:true,same_service:true}]);
  });

  it('matches Prisma declarations exactly on the real ordinary-chain public schema', () => {
    const evidence = resolve(process.env.SALON_RELEASE_EVIDENCE_DIR || resolve(root,'test-results','beauty-schema-release'), databaseName);
    mkdirSync(evidence,{recursive:true});
    const config = resolve(evidence,'prisma.config.mjs');
    writeFileSync(config,`export default { schema: ${JSON.stringify(resolve(root,'packages/database/prisma/schema.prisma'))}, datasource: { url: process.env.BEAUTY_SCHEMA_DIFF_URL } };\n`);
    const cli = process.env.BEAUTY_PRISMA_CLI || (() => {
      const requireFromDatabase = createRequire(resolve(root, 'packages/database/prisma.config.ts'));
      const manifestPath = requireFromDatabase.resolve('prisma/package.json');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { bin?: string | { prisma?: string } };
      const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.prisma;
      if (!bin) throw new Error('Installed prisma package does not declare its CLI binary');
      return resolve(dirname(manifestPath), bin);
    })();
    const result = spawnSync(process.execPath,[cli,'migrate','diff','--config',config,'--from-config-datasource','--to-schema',resolve(root,'packages/database/prisma/schema.prisma'),'--exit-code','--script'],
      {encoding:'utf8',env:{...process.env,BEAUTY_SCHEMA_DIFF_URL:databaseUrl},timeout:30000});
    writeFileSync(resolve(evidence,'prisma-diff.log'),result.stdout+result.stderr);
    expect(result.error).toBeUndefined();
    expect(result.status,result.stdout+result.stderr).toBe(0);
  });

  it('keeps all ten new tables under FORCE RLS and hides a foreign tenant line', async () => {
    const tables=['appointment_lines','employee_service_prices','beauty_appointment_reviews','beauty_review_invitations','beauty_service_materials','beauty_service_material_revisions','beauty_positions','beauty_position_permissions','beauty_position_assignments','beauty_location_hours'];
    const flags=await db.query('SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND relname=ANY($2::text[])',['public',tables]);
    expect(flags.rowCount).toBe(10);for(const row of flags.rows) expect(row).toMatchObject({relrowsecurity:true,relforcerowsecurity:true});
    await db.query('BEGIN');
    try {
      await db.query('SET LOCAL ROLE wetop_app'); await db.query("SELECT set_config('app.org_id',$1,true)",[randomUUID()]);
      expect((await db.query('SELECT count(*)::int AS count FROM appointment_lines')).rows[0].count).toBe(0);
      await db.query("SELECT set_config('app.org_id',$1,true)",[id.org]);
      expect((await db.query('SELECT count(*)::int AS count FROM appointment_lines')).rows[0].count).toBe(1);
    } finally { await db.query('ROLLBACK'); }
  });

  it('refuses location-hours down when saved configuration exists', () => rollbackRefuses(names[4]!, () =>
    db.query("INSERT INTO beauty_location_hours(location_id,intervals) VALUES($1,'[]')",[id.location]),/Export salon opening hours/));
  it('refuses positions down when a position exists', () => rollbackRefuses(names[3]!, () =>
    db.query("INSERT INTO beauty_positions(id,business_id,name) VALUES($1,$2,'Synthetic position')",[randomUUID(),id.business]),/Export Beauty positions/));
  it('refuses materials down when a retained card revision exists', () => rollbackRefuses(names[2]!, () =>
    db.query('INSERT INTO beauty_service_material_revisions(service_id) VALUES($1)',[id.service]),/Beauty material cards exist/));
  it('refuses reviews down when a retained invitation exists', () => rollbackRefuses(names[1]!, () =>
    db.query("INSERT INTO beauty_review_invitations(appointment_id,token_hash,expires_at) VALUES($1,$2,now()+interval '1 day')",[id.appointment,'a'.repeat(64)]),/review invitations exist/));
  it('refuses lines down when a retained employee price exists', () => rollbackRefuses(names[0]!, () =>
    db.query("INSERT INTO employee_service_prices(employee_id,service_id,location_id,price_type,price_min_minor,price_max_minor,currency) VALUES($1,$2,$3,'FIXED',123400,123400,'KZT')",[id.employee,id.service,id.location]),/employee service prices exist/));

  it('reverses the unused new models in dependency order without losing the legacy appointment', async () => {
    // строго обратный порядок применения: сначала поздние (с 138), потом салонные 137..133. `[...later,...names].reverse()`
    // откатывал салонные раньше поздних, и откат 157 не находил CHECK, который уже снял откат 135
    for(const name of [...names,...later].reverse()) await db.query(readFileSync(resolve(migrations,name,'down.sql'),'utf8'));
    expect(await signature()).toEqual(baseline);
    expect((await db.query('SELECT id,price::text FROM appointments WHERE id=$1',[id.appointment])).rows)
      .toEqual([{id:id.appointment,price:'123400'}]);
  });
});
