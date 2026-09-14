/**
 * Учения «мёртвое соединение с базой» (ADR-043). Повторяет 14.09.2026: Mac уснул, соединения пула умерли молча,
 * а новые соединения работают. Между процессом и настоящим пулером Supabase ставится прокси; в момент «сна» все уже
 * открытые через него соединения перестают доставлять байты в обе стороны (сокеты не закрываются — как после сна),
 * одно из них держит открытую транзакцию. Дальше идут запросы, как у API после пробуждения.
 *
 *   npx tsx scripts/ops/db-dead-connection-drill.ts            сроки пула из окружения (по умолчанию 30 с):
 *                                                               запросы завершаются, пул восстанавливается сам
 *   npx tsx scripts/ops/db-dead-connection-drill.ts --control  сроки выключены, как до ADR-043: запросы висят
 *                                                               (учения обрываются через 90 с)
 *
 * В базу идёт только `SELECT 1`; мест в пуле 2 (у API 5), чтобы не занимать сессии пулера. Строка подключения
 * читается программой из .env и не печатается; TLS идёт с настоящим именем пулера, как у API. TCP keepalive здесь
 * не проверяется: на пробы отвечает локальный прокси, а не пулер.
 */
import { Socket, createServer, connect as tcpConnect } from 'node:net';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { config as loadEnv } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { DATABASE_POOL_DEFAULTS, PrismaClient, databasePoolTimeouts } from '@pms/database';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });

const control = process.argv.includes('--control');
const POOL_MAX = 2;
const CONTROL_BOUND_MS = 90_000;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL не задан');
  process.exit(2);
}
let target: { host: string; port: number };
try {
  const u = new URL(connectionString);
  target = { host: u.hostname, port: Number(u.port || 5432) };
} catch {
  console.error('DATABASE_URL не разбирается как адрес'); // значение не печатаем
  process.exit(2);
}

const pool = databasePoolTimeouts(
  control
    ? { DATABASE_CONNECT_TIMEOUT_MS: '0', DATABASE_QUERY_TIMEOUT_MS: '0', DATABASE_KEEPALIVE_DELAY_MS: '0' }
    : process.env,
);
const rawQueryTimeout = process.env.DATABASE_QUERY_TIMEOUT_MS?.trim();
const queryTimeoutMs = control
  ? 0
  : rawQueryTimeout && /^\d+$/.test(rawQueryTimeout)
    ? Number(rawQueryTimeout)
    : DATABASE_POOL_DEFAULTS.queryTimeoutMs;
const connectTimeoutMs = pool.connectionTimeoutMillis;

const proxy = await startProxy(target.host, target.port);
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString, max: POOL_MAX, ...pool, stream: throughProxy(proxy.port) }),
});

console.log(
  `Режим: ${control ? 'КОНТРОЛЬ — сроки выключены (как до ADR-043)' : 'сроки пула ADR-043'}; ` +
    `подключение и место в пуле: ${seconds(connectTimeoutMs)}, ответ базы: ${seconds(queryTimeoutMs)}, ` +
    `keepalive: ${pool.keepAlive ? seconds(pool.keepAliveInitialDelayMillis ?? 0) : 'выкл'}; мест в пуле ${POOL_MAX}; ` +
    `пулер: порт ${target.port}`,
);

// 1. Прогрев: два соединения в пуле, одно из них внутри транзакции
const warmed = await Promise.race([
  Promise.all([db.$queryRaw`SELECT 1`, db.$queryRaw`SELECT 1`]).then(() => true),
  delay(60_000).then(() => false),
]);
if (!warmed) abort('база не ответила на прогрев за 60 с');
let wake!: () => void;
const woken = new Promise<void>((r) => (wake = r));
let inTransaction!: () => void;
const transactionOpen = new Promise<void>((r) => (inTransaction = r));
const tracked: Tracked[] = [];
const sleepAt = { t: 0 };
track('транзакция, открытая до «сна»', () =>
  db.$transaction(
    async (t) => {
      await t.$queryRaw`SELECT 1`;
      inTransaction();
      await woken;
      await t.$queryRaw`SELECT 1`;
    },
    { maxWait: 60_000, timeout: 600_000 },
  ),
);
const opened = await Promise.race([transactionOpen.then(() => true), delay(60_000).then(() => false)]);
if (!opened) abort('транзакция не открылась за 60 с');
console.log(`1. Прогрев: соединений через прокси ${proxy.accepted()}, одно держит открытую транзакцию`);
console.log(`   Шифрование до пулера (первые байты соединения): ${proxy.handshake()}`);

// 2. «Сон»: уже открытые соединения молча мертвы, новые работают
const killed = proxy.killExisting();
sleepAt.t = performance.now();
console.log(`2. «Сон»: ${killed} соединения перестали доставлять байты; запросы пошли`);
wake();
for (let i = 1; i <= 4; i += 1) track(`запрос ${i}`, () => db.$queryRaw`SELECT 1`);

const bound = control ? CONTROL_BOUND_MS : connectTimeoutMs + queryTimeoutMs + 30_000;
let probe = 0;
while (performance.now() - sleepAt.t < bound && !tracked.some((x) => x.ok && x.label.startsWith('проба'))) {
  await delay(3_000);
  probe += 1;
  track(`проба ${probe}`, () => db.$queryRaw`SELECT 1`);
}
// дождаться всех, но не дольше границы
while (performance.now() - sleepAt.t < bound && tracked.some((x) => x.ok === undefined)) await delay(250);

const firstOk = tracked
  .filter((x) => x.ok)
  .map((x) => x.endedAt!)
  .sort((a, b) => a - b)[0];
console.log('3. Итог запросов после «сна» (время от «сна»):');
for (const x of tracked) {
  const started = x.startedAt < sleepAt.t ? 'до «сна»' : `старт +${seconds(x.startedAt - sleepAt.t)}`;
  const result =
    x.ok === undefined
      ? `ВИСИТ уже ${seconds(performance.now() - Math.max(x.startedAt, sleepAt.t))}`
      : `${x.ok ? 'ответ' : `ошибка: ${x.error}`} на +${seconds(x.endedAt! - sleepAt.t)}`;
  console.log(`   ${x.label.padEnd(30)} ${started.padEnd(14)} ${result}`);
}

let healthy = false;
if (firstOk !== undefined) {
  const times: number[] = [];
  for (let i = 0; i < 5; i += 1) {
    const s = performance.now();
    await db.$queryRaw`SELECT 1`;
    times.push(performance.now() - s);
  }
  healthy = true;
  console.log(
    `4. После восстановления 5 запросов подряд: ${times.map((ms) => `${Math.round(ms)} мс`).join(', ')}; ` +
      `соединений через прокси всего ${proxy.accepted()}`,
  );
}

const pending = tracked.filter((x) => x.ok === undefined).length;
const recovery = firstOk === undefined ? undefined : firstOk - sleepAt.t;
const verdict = control
  ? pending > 0
    ? `КОНТРОЛЬ ПОДТВЕРДИЛ ПОЛОМКУ: через ${seconds(bound)} висят ${pending} из ${tracked.length} — так API стоял 14.09`
    : `контроль не воспроизвёл зависание (висят 0) — учения не доказательны`
  : pending === 0 && healthy && recovery !== undefined && recovery <= bound
    ? `ПУЛ ВОССТАНОВИЛСЯ САМ: первый ответ через ${seconds(recovery)} после «сна», висящих запросов 0`
    : `НЕ ВОССТАНОВИЛСЯ за ${seconds(bound)}: висят ${pending}, первый ответ ${recovery === undefined ? 'не пришёл' : `через ${seconds(recovery)}`}`;
console.log(`ИТОГ: ${verdict}`);

// уборка: рвём сокеты прокси (висящие запросы получают ошибку), закрываем клиента
proxy.closeAll();
const settleUntil = performance.now() + 10_000;
while (tracked.some((x) => x.ok === undefined) && performance.now() < settleUntil) await delay(100);
await Promise.race([db.$disconnect(), delay(10_000)]);
proxy.stop();
process.exit((control ? pending > 0 : pending === 0 && healthy) ? 0 : 1);

// ── вспомогательное ────────────────────────────────────────────────────────────────────────────────

interface Tracked {
  label: string;
  startedAt: number;
  endedAt?: number;
  ok?: boolean;
  error?: string;
}

function track(label: string, run: () => PromiseLike<unknown>): void {
  const entry: Tracked = { label, startedAt: performance.now() };
  tracked.push(entry);
  Promise.resolve(run()).then(
    () => Object.assign(entry, { ok: true, endedAt: performance.now() }),
    (e: unknown) =>
      Object.assign(entry, {
        ok: false,
        endedAt: performance.now(),
        error: (e instanceof Error ? e.message : String(e)).split('\n')[0]!.slice(0, 90),
      }),
  );
}

function abort(reason: string): never {
  console.error(`Учения прерваны: ${reason}`);
  proxy.closeAll();
  process.exit(1);
}

function seconds(ms: number): string {
  return ms === 0 ? 'выкл' : `${(ms / 1000).toFixed(1).replace('.', ',')} с`;
}

function describeClientHello(chunk: Buffer): string {
  if (chunk[0] === 0x16) return 'TLS сразу (direct)';
  if (chunk.length >= 8 && chunk.readInt32BE(4) === 80877103) return 'просит TLS (SSLRequest)';
  if (chunk.length >= 8 && chunk.readInt32BE(4) === 196608) return 'БЕЗ TLS (StartupMessage открытым текстом)';
  return 'не распознано';
}

function describeServerReply(chunk: Buffer): string {
  const first = String.fromCharCode(chunk[0] ?? 0);
  if (first === 'S') return 'согласен на TLS (S)';
  if (first === 'N') return 'отказал в TLS (N)';
  if (chunk[0] === 0x16) return 'TLS-рукопожатие';
  return `ответ «${first}» без TLS`;
}

/** pg зовёт connect(port, host) с адресом из строки подключения — ведём сокет в прокси, имя для TLS остаётся настоящим */
function throughProxy(port: number): () => Socket {
  return () => {
    const socket = new Socket();
    const connect = socket.connect.bind(socket) as (port: number, host: string) => Socket;
    Object.assign(socket, { connect: () => connect(port, '127.0.0.1') });
    return socket;
  };
}

async function startProxy(host: string, port: number) {
  const pairs = new Set<{ client: Socket; upstream: Socket; dead: boolean }>();
  let accepted = 0;
  let clientHello = 'нет данных';
  let serverReply = 'нет данных';
  const server = createServer((client) => {
    accepted += 1;
    const upstream = tcpConnect(port, host);
    const pair = { client, upstream, dead: false };
    pairs.add(pair);
    // по первым байтам видно, просит ли клиент TLS: SSLRequest (80877103), TLS сразу (0x16) или открытый StartupMessage
    if (accepted === 1) {
      client.once('data', (chunk: Buffer) => (clientHello = describeClientHello(chunk)));
      upstream.once('data', (chunk: Buffer) => (serverReply = describeServerReply(chunk)));
    }
    // мёртвое соединение байты глотает и никуда не передаёт; сокеты при этом открыты
    client.on('data', (chunk) => pair.dead || upstream.write(chunk));
    upstream.on('data', (chunk) => pair.dead || client.write(chunk));
    // клиент сам закрыл соединение — закрываем и сторону пулера, чтобы не держать его сессию
    const close = () => {
      client.destroy();
      upstream.destroy();
      pairs.delete(pair);
    };
    client.on('close', close);
    upstream.on('close', close);
    client.on('error', () => undefined);
    upstream.on('error', () => undefined);
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('proxy did not start');
  return {
    port: address.port,
    accepted: () => accepted,
    handshake: () => `клиент: ${clientHello}; пулер: ${serverReply}`,
    killExisting: () => {
      for (const pair of pairs) pair.dead = true;
      return pairs.size;
    },
    closeAll: () => {
      for (const pair of pairs) {
        pair.client.destroy();
        pair.upstream.destroy();
      }
    },
    stop: () => server.close(),
  };
}
