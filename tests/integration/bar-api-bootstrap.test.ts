import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { closeSync, mkdirSync, openSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createServer } from 'node:net';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const parent = dirname(root);
const evidence = resolve(root, 'tests/runs/a2-runtime');
const api = 'http://127.0.0.1:4407';
const database = process.env.A24_DATABASE ?? 'a24_probe';
const ids = Object.fromEntries(['org', 'business', 'location', 'property', 'user', 'session', 'category', 'product', 'supplier', 'receipt', 'line', 'lot'].map(key => [key, randomUUID()]));
const token = randomBytes(32).toString('base64url');
let server: ChildProcess | undefined;
let connection: pg.Client | undefined;
const observations: Array<{ route: string; status: number; body: unknown }> = [];

async function insert(table: string, row: Record<string, unknown>) {
  const keys = Object.keys(row);
  await connection!.query(`INSERT INTO "${table}" (${keys.map(key => `"${key}"`).join(',')}) VALUES (${keys.map((_, index) => `$${index + 1}`).join(',')})`, Object.values(row));
}

async function get(route: string, authorized = true) {
  const response = await fetch(api + route, {
    headers: authorized ? { authorization: `Bearer ${token}`, 'x-wetop-scope': `business=${ids.business};location=${ids.location}` } : {},
    signal: AbortSignal.timeout(10000),
  });
  const body: unknown = await response.json();
  observations.push({ route, status: response.status, body });
  return { status: response.status, body };
}

describe.skipIf(process.env.A2_RUNTIME_AUDIT !== '1')('A2 real workspace bootstrap on isolated PostgreSQL', () => {
  beforeAll(async () => {
    mkdirSync(evidence, { recursive: true, mode: 0o700 });
    connection = new pg.Client({ host: '127.0.0.1', port: 55601, user: 'a24_migrator', database, options: '-c search_path=pms_test,public', connectionTimeoutMillis: 5000 });
    await connection.connect();
    const identity = (await connection.query("SELECT current_database() AS database, current_user AS role, current_setting('server_version') AS version, inet_server_port() AS port")).rows[0];
    expect(identity).toMatchObject({ database, role: 'a24_migrator', port: 55601 });
    expect(identity.version).toMatch(/^16\./);
    const runtimeRoles = (await connection.query("SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname IN ('wetop_service','wetop_app') ORDER BY rolname")).rows;
    expect(runtimeRoles).toEqual([{ rolname: 'wetop_app', rolsuper: false, rolbypassrls: false }, { rolname: 'wetop_service', rolsuper: false, rolbypassrls: true }]);
    const now = new Date().toISOString();
    await connection.query('BEGIN');
    try {
      await insert('organizations', { id: ids.org, name: 'A2 synthetic organization', status: 'ACTIVE' });
      await insert('businesses', { id: ids.business, organization_id: ids.org, name: 'A2 synthetic hospitality', vertical: 'HOSPITALITY', updated_at: now });
      await insert('locations', { id: ids.location, business_id: ids.business, name: 'A2 synthetic location', timezone: 'Asia/Almaty', currency: 'KZT', updated_at: now });
      await insert('properties', { id: ids.property, organization_id: ids.org, location_id: ids.location, name: 'A2 synthetic property', timezone: 'Asia/Almaty', currency: 'KZT', check_in_time: '14:00', check_out_time: '12:00', updated_at: now });
      await insert('users', { id: ids.user, email: `a2-${ids.user}@example.invalid`, name: 'A2 synthetic owner', email_verified_at: now });
      await insert('memberships', { user_id: ids.user, organization_id: ids.org, role: 'OWNER' });
      await insert('sessions', { id: ids.session, token_hash: createHash('sha256').update(token).digest('hex'), user_id: ids.user, organization_id: ids.org, expires_at: new Date(Date.now() + 3600000).toISOString() });
      await insert('bar_categories', { id: ids.category, property_id: ids.property, name: 'A2 synthetic category', default_markup_basis: 0 });
      await insert('bar_suppliers', { id: ids.supplier, property_id: ids.property, name: 'A2 synthetic supplier', updated_at: now });
      await insert('bar_products', { id: ids.product, property_id: ids.property, category_id: ids.category, code: 'A2-SYNTHETIC', name: 'A2 synthetic product', sale_price: '150', updated_at: now });
      await insert('bar_receipts', { id: ids.receipt, property_id: ids.property, supplier_id: ids.supplier, document_number: 'A2-SYNTHETIC', document_date: '2026-10-07', received_date: '2026-10-07', status: 'POSTED', posted_at: now, currency: 'KZT', total_amount: '300', updated_at: now });
      await insert('bar_receipt_lines', { id: ids.line, receipt_id: ids.receipt, product_id: ids.product, quantity_units: '3', unit_cost: '100', amount: '300', markup_basis: 0, calculated_price: '150' });
      await insert('bar_stock_lots', { id: ids.lot, property_id: ids.property, product_id: ids.product, receipt_line_id: ids.line, received_units: '3', remaining_units: '3', unit_cost: '100', received_at: now });
      await connection.query('COMMIT');
    } catch (error) {
      await connection.query('ROLLBACK');
      throw error;
    }
    await new Promise<void>((resolvePort, rejectPort) => {
      const probe = createServer();
      probe.once('error', rejectPort);
      probe.listen(4407, '127.0.0.1', () => probe.close(() => resolvePort()));
    });
    const log = openSync(resolve(evidence, 'api-startup.log'), 'a', 0o600);
    const env: NodeJS.ProcessEnv = {
      PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, NODE_OPTIONS: `--require=${resolve(parent, 'api-network-proof.cjs')}`,
      LANG: 'C', LC_ALL: 'C', CI: '1', NODE_ENV: 'test',
      NPM_CONFIG_USERCONFIG: resolve(parent, 'npm-user.conf'), NPM_CONFIG_GLOBALCONFIG: resolve(parent, 'npm-global.conf'), NPM_CONFIG_CACHE: resolve(parent, 'npm-cache'),
      DATABASE_URL: `postgresql://wetop_service@127.0.0.1:55601/${database}`,
      DATABASE_APP_URL: `postgresql://wetop_app@127.0.0.1:55601/${database}`,
      DATABASE_SCHEMA: 'pms_test', DATABASE_POOL_MAX: '2', DATABASE_APP_POOL_MAX: '2',
      API_HOST: '127.0.0.1', API_PORT: '4407', AUTH_REQUIRED: '1',
      CHANNEX_OUTBOX_WORKER: 'off', CHANNEX_FULL_SYNC: 'off', CHANNEX_PULL: 'off',
      GUARD: 'off', SELLER_SYNC: 'off', SITE_GENERATION_WORKER: 'off',
      USER_ERRORS_RETENTION: 'off', WIZARD_RETENTION: 'off', ANALYTICS_RETENTION: 'off',
    };
    server = spawn('npm', ['run', 'start', '-w', 'apps/api'], { cwd: root, env, detached: true, stdio: ['ignore', log, log] });
    closeSync(log);
    const deadline = Date.now() + 45000;
    let ready = false;
    while (Date.now() < deadline) {
      if (server.exitCode !== null) throw new Error(`API exited during startup: ${server.exitCode}; see protected api-startup.log`);
      try {
        const response = await fetch(api + '/health', { signal: AbortSignal.timeout(1500) });
        if (response.status === 200) { ready = true; break; }
      } catch {
        // The process may still be binding its listener during startup.
      }
      await new Promise(resolveWait => setTimeout(resolveWait, 200));
    }
    expect(ready, 'Real workspace API must start within the recorded startup window').toBe(true);
    const listener = execFileSync('lsof', ['-nP', '-iTCP:4407', '-sTCP:LISTEN', '-Fpcn'], { encoding: 'utf8' });
    const pid = Number(listener.match(/^p(\d+)/m)?.[1]);
    expect(pid).toBeGreaterThan(0);
    const cwd = execFileSync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], { encoding: 'utf8' }).split('\n').find(line => line.startsWith('n'))?.slice(1);
    expect(cwd).toBe(resolve(root, 'apps/api'));
    writeFileSync(resolve(evidence, 'startup.json'), JSON.stringify({ command: 'npm run start -w apps/api', wrapper: 'inherited outer network.sb', pid, launcherPid: server.pid, cwd, host: '127.0.0.1', port: 4407, databaseIdentity: identity, runtimeRoles, fixtures: { organization: ids.org, business: ids.business, location: ids.location, property: ids.property, category: ids.category, product: ids.product } }, null, 2), { mode: 0o600 });
  }, 60000);

  afterAll(async () => {
    writeFileSync(resolve(evidence, 'routes.json'), JSON.stringify(observations, null, 2), { mode: 0o600 });
    if (server?.pid && server.exitCode === null) {
      const stopped = new Promise<void>(resolveStop => server!.once('exit', () => resolveStop()));
      process.kill(-server.pid, 'SIGTERM');
      await Promise.race([stopped, new Promise<void>(resolveTimeout => setTimeout(resolveTimeout, 5000))]);
      writeFileSync(resolve(evidence, 'api-stop.json'), JSON.stringify({ launcherPid: server.pid, signal: 'SIGTERM', exitCode: server.exitCode, signalCode: server.signalCode }, null, 2), { mode: 0o600 });
    }
    await connection?.end();
  });

  it('health reaches the actual isolated database', async () => {
    const response = await get('/health', false);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok', database: 'up' });
  });
  it('authenticated categories reach the real scoped Bar repository', async () => {
    const response = await get('/bar/categories');
    expect(response.status).toBe(200);
    expect(response.body).toEqual([expect.objectContaining({ id: ids.category, propertyId: ids.property, name: 'A2 synthetic category', defaultMarkupBasis: 0 })]);
  });
  it('authenticated stock returns the nonempty synthetic lot', async () => {
    const response = await get('/bar/stock');
    expect(response.status).toBe(200);
    expect(response.body).toEqual([expect.objectContaining({ id: ids.product, propertyId: ids.property, availableUnits: '3', stockCostMinor: '300' })]);
  });
  it('authenticated report reflects stored synthetic values', async () => {
    const response = await get('/bar/report');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ currency: 'KZT', purchasesMinor: '300', supplierPaidMinor: '0', revenueMinor: '0', costMinor: '0', grossProfitMinor: '0', writeOffMinor: '0', stockCostMinor: '300', supplierDebtMinor: '300' });
  });
  it('unauthenticated Bar request is rejected before the service', async () => {
    const response = await get('/bar/categories', false);
    expect(response.status).toBe(401);
  });
});
