import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { closeSync, mkdirSync, openSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createServer } from 'node:net';
import pg from 'pg';
import { expect, it } from 'vitest';

export const root = resolve(import.meta.dirname, '../..');
const parent = dirname(root);
export const evidence = resolve(root, 'tests/runs/a3-runtime');
const databaseHost = process.env.A28_PG_HOST ?? '127.0.0.1';
const databasePort = Number(process.env.A28_PG_PORT ?? '55587');
const migratorRole = process.env.A28_PG_MIGRATOR_ROLE ?? 'a2_migrator';
const databaseName = process.env.A28_PG_DATABASE ?? 'pms_audit_empty';
const databaseUrl = (role: string) =>
  `postgresql://${role}@${databaseHost}:${databasePort}/${databaseName}`;
const apiBase = new URL(process.env.A28_API_URL ?? 'http://127.0.0.1:4397');
const apiPort = Number(process.env.A28_BAR_API_PORT ?? (apiBase.port || '4397'));
apiBase.port = String(apiPort);
const apiHost = apiBase.hostname;
const url = apiBase.origin;
const dbConfig = { host: databaseHost, port: databasePort, user: migratorRole, database: databaseName, options: '-c search_path=pms_test,public', connectionTimeoutMillis: 5000 };
export let db: pg.Client;
let server: ChildProcess | undefined;
export type Row = Record<string, unknown>;
export interface Reply { status: number; body: Row }
export interface Actor { org: string; business: string; location: string; property: string; user: string; token: string; currency: string }
export const observations: Row[] = [];
export const matrix: Row[] = [];
export const reconciliation: Row[] = [];
let currentCase = 'preflight';
let caseStatus = 'PASS';
export function designGap(reason: string) { caseStatus = 'DESIGN_GAP'; observations.push({ case: currentCase, designGap: reason }); }
export function note(label: string, value: unknown) { observations.push({ case: currentCase, label, value }); }
export function auditCase(id: string, source: string, fn: () => Promise<void>) {
  it(id, async () => {
    currentCase = id; caseStatus = 'PASS';
    const first = observations.length;
    try {
      await fn();
      matrix.push({ id, status: caseStatus, source, observations: [first, observations.length - 1] });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      matrix.push({ id, status: error instanceof FixtureError || error instanceof HarnessError ? 'ENV_BLOCKED' : 'FAIL_REPRODUCED', source, error: message, observations: [first, observations.length - 1] });
      throw error;
    }
  }, 30000);
}
class FixtureError extends Error {}
class HarnessError extends Error {}
export async function insert(table: string, row: Row) {
  const keys = Object.keys(row);
  try {
    await db.query(`INSERT INTO "${table}" (${keys.map(key => `"${key}"`).join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')})`, Object.values(row));
  } catch (error) { throw new FixtureError(`${table}: ${(error as Error).message}`); }
}
export async function actor(currency = 'KZT'): Promise<Actor> {
  const a: Actor = { org: randomUUID(), business: randomUUID(), location: randomUUID(), property: randomUUID(), user: randomUUID(), token: randomBytes(32).toString('base64url'), currency };
  const now = new Date().toISOString();
  await db.query('BEGIN');
  try {
    await insert('organizations', { id: a.org, name: 'A3 synthetic organization', status: 'ACTIVE' });
    await insert('businesses', { id: a.business, organization_id: a.org, name: 'A3 synthetic business', vertical: 'HOSPITALITY', updated_at: now });
    await insert('locations', { id: a.location, business_id: a.business, name: 'A3 synthetic location', currency, timezone: 'Asia/Almaty', updated_at: now });
    await insert('properties', { id: a.property, organization_id: a.org, location_id: a.location, name: 'A3 synthetic property', currency, timezone: 'Asia/Almaty', check_in_time: '14:00', check_out_time: '12:00', updated_at: now });
    await insert('users', { id: a.user, email: `a3-${a.user}@example.invalid`, name: 'A3 synthetic owner', email_verified_at: now });
    await insert('memberships', { user_id: a.user, organization_id: a.org, role: 'OWNER' });
    await insert('sessions', { id: randomUUID(), token_hash: createHash('sha256').update(a.token).digest('hex'), user_id: a.user, organization_id: a.org, expires_at: new Date(Date.now() + 3600000).toISOString() });
    await db.query('COMMIT');
  } catch (error) { await db.query('ROLLBACK'); throw error; }
  note('synthetic scope', { org: a.org, business: a.business, location: a.location, property: a.property, currency });
  return a;
}
export async function request(a: Actor, path: string, method = 'GET', body?: Row): Promise<Reply> {
  const response = await fetch(url + path, { method, headers: { authorization: `Bearer ${a.token}`, 'x-wetop-scope': `business=${a.business};location=${a.location}`, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
  const text = await response.text();
  const parsed = (text ? JSON.parse(text) : {}) as Row;
  observations.push({ case: currentCase, method, path, scope: a.property, request: body ?? null, status: response.status, response: parsed });
  return { status: response.status, body: parsed };
}
export async function ok(a: Actor, path: string, method = 'GET', body?: Row) {
  const r = await request(a, path, method, body);
  expect(r.status, `${method} ${path}: ${JSON.stringify(r.body)}`).toBe(method === 'POST' ? 201 : 200);
  return r.body;
}
export async function catalog(a: Actor, categoryMarkup = 0, productMarkup: number | null = null) {
  const category = await ok(a, '/bar/categories', 'POST', { name: `A3 ${randomUUID()}`, defaultMarkupBasis: categoryMarkup });
  const supplier = await ok(a, '/bar/suppliers', 'POST', { name: `A3 synthetic supplier ${randomUUID()}` });
  const product = await ok(a, '/bar/products', 'POST', { code: randomUUID(), name: 'A3 synthetic product', categoryId: category.id, unitsPerPackage: 12, markupBasis: productMarkup, salePriceMinor: '15000', minimumStockUnits: '0' });
  return { category: String(category.id), supplier: String(supplier.id), product: String(product.id) };
}
export async function receipt(a: Actor, c: { supplier: string; product: string }, quantity: string, cost: string, currency = a.currency, markup: unknown = 0) {
  return ok(a, '/bar/receipts', 'POST', { supplierId: c.supplier, documentNumber: randomUUID(), documentDate: '2026-10-07', receivedDate: '2026-10-07', currency, lines: [{ productId: c.product, quantityUnits: quantity, unitCostMinor: cost, markupBasis: markup }] });
}
export async function post(a: Actor, id: unknown) { return ok(a, `/bar/receipts/${id}/post`, 'POST'); }
export async function stocked(a: Actor, units = '3', cost = '10000', price = '15000') {
  const c = await catalog(a); const r = await receipt(a, c, units, cost); await post(a, r.id);
  await ok(a, `/bar/products/${c.product}/price`, 'PATCH', { salePriceMinor: price });
  return { ...c, receipt: String(r.id) };
}
export async function folio(a: Actor, currency = a.currency) {
  const type = randomUUID(), reservation = randomUUID(), item = randomUUID(), folioId = randomUUID(), rate = randomUUID(); const now = new Date().toISOString();
  await insert('accommodation_types', { id: type, property_id: a.property, code: randomUUID(), name: 'A3 synthetic room', kind: 'APARTMENT', capacity_adults: 1, updated_at: now });
  await insert('reservations', { id: reservation, property_id: a.property, confirmation_number: randomUUID(), source: 'DESK', status: 'CONFIRMED', arrival_date: '2026-10-07', departure_date: '2026-10-08', adults: 1, currency, total_amount: '0', updated_at: now });
  await insert('rate_plans', { id: rate, property_id: a.property, code: randomUUID(), name: 'A3 synthetic rate', currency, updated_at: now });
  await insert('reservation_items', { id: item, reservation_id: reservation, accommodation_type_id: type, rate_plan_id: rate, arrival_date: '2026-10-07', departure_date: '2026-10-08', price: '0', status: 'CONFIRMED', updated_at: now });
  await insert('folios', { id: folioId, reservation_item_id: item, currency });
  return folioId;
}
export async function snapshot(a: Actor, label: string) {
  const queries: Record<string, string> = {
    receipts: 'SELECT id,status,currency,total_amount,posted_at FROM bar_receipts WHERE property_id=$1 ORDER BY id',
    receiptLines: 'SELECT l.* FROM bar_receipt_lines l JOIN bar_receipts r ON r.id=l.receipt_id WHERE r.property_id=$1 ORDER BY l.id',
    products: 'SELECT id,active,category_id,units_per_package,markup_basis,sale_price FROM bar_products WHERE property_id=$1 ORDER BY id',
    lots: 'SELECT id,product_id,receipt_line_id,received_units,remaining_units,unit_cost,received_at FROM bar_stock_lots WHERE property_id=$1 ORDER BY received_at,id',
    movements: 'SELECT id,product_id,lot_id,kind,units,unit_cost,source_type,source_id,note,created_by_id FROM bar_stock_movements WHERE property_id=$1 ORDER BY id',
    sales: 'SELECT id,idempotency_key,status,currency,total_revenue,total_cost,cash_operation_id,folio_id,charge_id FROM bar_sales WHERE property_id=$1 ORDER BY id',
    saleLines: 'SELECT l.* FROM bar_sale_lines l JOIN bar_sales s ON s.id=l.sale_id WHERE s.property_id=$1 ORDER BY l.id',
    supplierPayments: 'SELECT p.id,p.receipt_id,p.amount,p.cash_operation_id,c.status AS cash_status FROM bar_supplier_payments p JOIN bar_receipts r ON r.id=p.receipt_id JOIN cash_operations c ON c.id=p.cash_operation_id WHERE r.property_id=$1 ORDER BY p.id',
    cash: 'SELECT id,kind,method,amount,status FROM cash_operations WHERE property_id=$1 ORDER BY id',
    charges: 'SELECT c.id,c.folio_id,c.amount,c.quantity,c.unit_price,c.voided_at FROM charges c JOIN folios f ON f.id=c.folio_id JOIN reservation_items i ON i.id=f.reservation_item_id JOIN reservations r ON r.id=i.reservation_id WHERE r.property_id=$1 ORDER BY c.id',
    payments: 'SELECT id,currency,status,amount FROM payments WHERE property_id=$1 ORDER BY id',
    allocations: 'SELECT a.payment_id,a.folio_id,a.amount FROM payment_allocations a JOIN payments p ON p.id=a.payment_id WHERE p.property_id=$1 ORDER BY a.payment_id,a.folio_id',
    refunds: 'SELECT r.id,r.payment_id,r.folio_id,r.amount FROM refunds r JOIN payments p ON p.id=r.payment_id WHERE p.property_id=$1 ORDER BY r.id',
  };
  const state: Record<string, Row[]> & { receipts: Row[]; receiptLines: Row[]; products: Row[]; lots: Row[]; movements: Row[]; sales: Row[]; saleLines: Row[]; supplierPayments: Row[]; cash: Row[]; charges: Row[]; payments: Row[]; allocations: Row[]; refunds: Row[]; audit: Row[] } = { receipts: [], receiptLines: [], products: [], lots: [], movements: [], sales: [], saleLines: [], supplierPayments: [], cash: [], charges: [], payments: [], allocations: [], refunds: [], audit: [] };
  for (const [name, sql] of Object.entries(queries)) state[name] = (await db.query(sql, [a.property])).rows as Row[];
  state.audit = (await db.query('SELECT entity_type,entity_id,action FROM audit_logs WHERE user_id=$1 ORDER BY id', [a.user])).rows as Row[];
  const sum = (rows: Row[], column: string) => rows.reduce((total, row) => total + BigInt(String(row[column])), 0n);
  const units = sum(state.lots, 'remaining_units');
  const stockCost = state.lots.reduce((s, lot) => s + BigInt(String(lot.remaining_units)) * BigInt(String(lot.unit_cost)), 0n);
  const movementUnits = sum(state.movements, 'units');
  const posted = state.receipts.filter(r => r.status === 'POSTED');
  const purchase = sum(posted, 'total_amount');
  const paid = sum(state.supplierPayments, 'amount');
  const settled = sum(state.supplierPayments.filter(p => p.cash_status === 'COMPLETED'), 'amount');
  const liveCash = state.cash.filter(c => c.status === 'COMPLETED');
  const cashDelta = sum(liveCash.filter(c => c.kind === 'INCOME'), 'amount') - sum(liveCash.filter(c => c.kind === 'EXPENSE'), 'amount') + sum(state.payments.filter(p => p.status === 'COMPLETED'), 'amount') - sum(state.refunds, 'amount');
  const result = { state, metrics: { units: String(units), stockCost: String(stockCost), movementUnits: String(movementUnits), purchase: String(purchase), paid: String(paid), settled: String(settled), debt: String(purchase - paid), settledDebt: String(purchase - settled), cashDelta: String(cashDelta) } };
  note(label, result);
  return result;
}
export async function blockedPair(_a: Actor, table: 'bar_receipts' | 'bar_stock_lots', id: string, calls: [() => Promise<Reply>, () => Promise<Reply>]) {
  const blocker = new pg.Client(dbConfig); await blocker.connect();
  const sql = table === 'bar_receipts' ? 'SELECT id FROM bar_receipts WHERE id=$1 FOR UPDATE' : 'SELECT id FROM bar_stock_lots WHERE product_id=$1 AND remaining_units>0 ORDER BY received_at,id FOR UPDATE';
  await blocker.query('BEGIN'); await blocker.query(sql, [id]);
  const pid = (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid as number;
  const requests = calls.map(call => call());
  let waiting = 0;
  try {
    const deadline = Date.now() + 2500;
    while (Date.now() < deadline) {
      waiting = (await db.query('WITH RECURSIVE blocked(pid) AS (SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND $1=ANY(pg_blocking_pids(pid)) UNION SELECT a.pid FROM pg_stat_activity a JOIN blocked b ON b.pid=ANY(pg_blocking_pids(a.pid)) WHERE a.datname=current_database()) SELECT count(DISTINCT pid)::int AS n FROM blocked', [pid])).rows[0].n as number;
      if (waiting >= 2) break;
      await new Promise(resolveWait => setTimeout(resolveWait, 20));
    }
    note('controlled barrier', { table, id, blockerPid: pid, queuedRequests: waiting });
  } finally { await blocker.query('ROLLBACK'); await blocker.end(); }
  const replies = await Promise.all(requests);
  if (waiting < 2) throw new HarnessError(`Controlled barrier has ${waiting} waiters; concurrency not proven`);
  return replies;
}
export async function start() {
  mkdirSync(evidence, { recursive: true, mode: 0o700 });
  db = new pg.Client(dbConfig); await db.connect();
  const identity = (await db.query("SELECT current_database() AS database,current_user AS role,current_setting('server_version') AS version,inet_server_port() AS port,current_schema() AS schema")).rows[0];
  expect(identity).toMatchObject({ database: databaseName, role: migratorRole, port: databasePort, schema: 'pms_test' });
  expect(identity.version).toBe('16.14');
  const roles = (await db.query("SELECT rolname,rolsuper,rolbypassrls FROM pg_roles WHERE rolname IN ('wetop_service','wetop_app') ORDER BY rolname")).rows;
  expect(roles).toEqual([{ rolname: 'wetop_app', rolsuper: false, rolbypassrls: false }, { rolname: 'wetop_service', rolsuper: false, rolbypassrls: true }]);
  await new Promise<void>((yes, no) => { const probe = createServer(); probe.once('error', no); probe.listen(apiPort, apiHost, () => probe.close(() => yes())); });
  const log = openSync(resolve(evidence, 'api-startup.log'), 'w', 0o600);
  server = spawn('/usr/bin/sandbox-exec', ['-f', resolve(parent, 'runtime-network.sb'), 'npm', 'run', 'start', '-w', 'apps/api'], { cwd: root, detached: true, stdio: ['ignore', log, log], env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, CI: '1', LANG: 'C', LC_ALL: 'C', NODE_ENV: 'test', NPM_CONFIG_CACHE: resolve(parent, 'npm-cache'), NPM_CONFIG_USERCONFIG: resolve(parent, 'npm-user.conf'), NPM_CONFIG_GLOBALCONFIG: resolve(parent, 'npm-global.conf'), DATABASE_URL: databaseUrl('wetop_service'), DATABASE_APP_URL: databaseUrl('wetop_app'), DATABASE_SCHEMA: 'pms_test', DATABASE_POOL_MAX: '2', DATABASE_APP_POOL_MAX: '2', API_HOST: apiHost, API_PORT: String(apiPort), AUTH_REQUIRED: '1', CHANNEX_OUTBOX_WORKER: 'off', CHANNEX_FULL_SYNC: 'off', CHANNEX_PULL: 'off', GUARD: 'off', SELLER_SYNC: 'off', SITE_GENERATION_WORKER: 'off', USER_ERRORS_RETENTION: 'off', WIZARD_RETENTION: 'off', ANALYTICS_RETENTION: 'off' } });
  closeSync(log);
  let ready = false; const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`API exited: ${server.exitCode}`);
    try { if ((await fetch(url + '/health', { signal: AbortSignal.timeout(1000) })).status === 200) { ready = true; break; } } catch { /* Listener may still be binding. */ }
    await new Promise(resolveWait => setTimeout(resolveWait, 100));
  }
  expect(ready).toBe(true);
  const listener = execFileSync('lsof', ['-nP', `-iTCP:${apiPort}`, '-sTCP:LISTEN', '-Fpcn'], { encoding: 'utf8' });
  const pid = Number(listener.match(/^p(\d+)/m)?.[1]);
  const cwd = execFileSync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], { encoding: 'utf8' }).split('\n').find(s => s.startsWith('n'))?.slice(1);
  expect(cwd).toBe(resolve(root, 'apps/api'));
  writeFileSync(resolve(evidence, 'startup.json'), JSON.stringify({ command: 'npm run start -w apps/api', pid, launcherPid: server.pid, cwd, host: apiHost, port: apiPort, fixtureConnection: identity, runtimeRoles: roles }, null, 2), { mode: 0o600 });
}
export async function stop() {
  mkdirSync(evidence, { recursive: true, mode: 0o700 });
  for (const [name, value] of Object.entries({ observations, matrix, reconciliation })) writeFileSync(resolve(evidence, `${name}.json`), JSON.stringify(value, null, 2), { mode: 0o600 });
  if (server?.pid && server.exitCode === null) {
    const stopped = new Promise<void>(yes => server!.once('exit', () => yes()));
    process.kill(-server.pid, 'SIGTERM');
    await Promise.race([stopped, new Promise<void>(yes => setTimeout(yes, 5000))]);
    writeFileSync(resolve(evidence, 'api-stop.json'), JSON.stringify({ launcherPid: server.pid, exitCode: server.exitCode, signal: 'SIGTERM' }, null, 2), { mode: 0o600 });
  }
  await db?.end();
}
