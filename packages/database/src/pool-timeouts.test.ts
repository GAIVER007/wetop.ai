import net from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPrismaClient, type PrismaClient } from './index';

/**
 * 14.09.2026 Mac уснул на батарее; после пробуждения API не отвечал, пока его не перезапустили (ADR-043).
 * Соединение, убитое во сне, само не закрывается: запрос ждёт ответа вечно, место в пуле не освобождается,
 * а следующий запрос ждёт свободного места тоже вечно. Вместо базы здесь сервер, который принимает соединение
 * и молчит, — проверяется, что каждое ожидание ограничено сроком и пул после него снова работает.
 */

const DEADLINE_MS = '300';
/** С запасом на медленную машину: без сроков запрос не завершается вовсе, со сроком — за ~0,3 с */
const BOUND_MS = 3_000;
const TEST_TIMEOUT_MS = 20_000;

describe('пул соединений: мёртвое соединение не вешает процесс', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    // сначала рвём соединения сервера: зависшие запросы получают ошибку, и $disconnect не ждёт их вечно
    for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
    vi.unstubAllEnvs();
  });

  async function setup(
    server: FakeServerOptions,
    env: Record<string, string>,
  ): Promise<{ db: PrismaClient; fake: FakePostgres }> {
    vi.stubEnv('DATABASE_SCHEMA', '');
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    const fake = await startFakePostgres(server);
    const db = createPrismaClient(fake.url);
    cleanups.push(async () => {
      await settleWithin(db.$disconnect(), 5_000);
    });
    cleanups.push(() => fake.close());
    return { db, fake };
  }

  it(
    'запрос без ответа завершается ошибкой в срок, а следующий идёт по новому соединению',
    async () => {
      const { db, fake } = await setup(
        {},
        { DATABASE_POOL_MAX: '1', DATABASE_QUERY_TIMEOUT_MS: DEADLINE_MS },
      );

      const first = await settleWithin(db.$queryRaw`SELECT 1`, BOUND_MS);
      expect(first.state).toBe('rejected');
      expect(reason(first)).toMatch(/did not answer for 300 ms/);

      const second = await settleWithin(db.$queryRaw`SELECT 1`, BOUND_MS);
      expect(second.state).toBe('rejected');
      expect(fake.connections()).toBe(2);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'запрос без ответа внутри транзакции: транзакция падает в срок, соединение не возвращается в пул',
    async () => {
      const { db, fake } = await setup(
        {},
        { DATABASE_POOL_MAX: '1', DATABASE_QUERY_TIMEOUT_MS: DEADLINE_MS },
      );

      const tx = await settleWithin(
        db.$transaction(async (t) => t.$queryRaw`SELECT 1`, { maxWait: 5_000, timeout: 10_000 }),
        BOUND_MS,
      );
      expect(tx.state).toBe('rejected');
      expect(reason(tx)).toMatch(/did not answer for 300 ms/);

      // соединение с зависшим запросом и открытой транзакцией на сервере должно быть закрыто:
      // иначе следующий запрос встанет за зависшим или выполнится внутри чужой транзакции
      const next = await settleWithin(db.$queryRaw`SELECT 1`, BOUND_MS);
      expect(next.state).toBe('rejected');
      expect(fake.connections()).toBe(2);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'все места пула заняты зависшими запросами — ожидание места ограничено сроком',
    async () => {
      const { db, fake } = await setup(
        {},
        {
          DATABASE_POOL_MAX: '1',
          DATABASE_QUERY_TIMEOUT_MS: '60000',
          DATABASE_CONNECT_TIMEOUT_MS: DEADLINE_MS,
        },
      );

      // первый запрос дошёл до сервера и держит единственное место; завершится при уборке
      void db.$queryRaw`SELECT 1`.catch(() => undefined);
      await waitFor(() => fake.queries() === 1);

      const waiting = await settleWithin(db.$queryRaw`SELECT 1`, BOUND_MS);
      expect(waiting.state).toBe('rejected');
      expect(reason(waiting)).toMatch(/timeout/i);
      expect(fake.connections()).toBe(1);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'сервер принял TCP-соединение и молчит — подключение завершается ошибкой в срок',
    async () => {
      const { db } = await setup(
        { silentStartup: true },
        { DATABASE_CONNECT_TIMEOUT_MS: DEADLINE_MS },
      );

      const result = await settleWithin(db.$queryRaw`SELECT 1`, BOUND_MS);
      expect(result.state).toBe('rejected');
      expect(reason(result)).toMatch(/timeout/i);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'срок не трогает живое соединение: ответ до срока приходит, простой в пуле дольше срока соединение не закрывает',
    async () => {
      const { db, fake } = await setup(
        { answerSelectAfterMs: 100 },
        { DATABASE_POOL_MAX: '1', DATABASE_QUERY_TIMEOUT_MS: DEADLINE_MS },
      );

      expect(await db.$queryRaw`SELECT 1`).toEqual([{ '?column?': 1 }]);
      await new Promise((resolve) => setTimeout(resolve, 3 * Number(DEADLINE_MS)));
      expect(await db.$queryRaw`SELECT 1`).toEqual([{ '?column?': 1 }]);
      expect(fake.connections()).toBe(1);
    },
    TEST_TIMEOUT_MS,
  );
});

// ── вспомогательное ────────────────────────────────────────────────────────────────────────────────

type Settled =
  | { state: 'fulfilled'; value: unknown }
  | { state: 'rejected'; error: unknown }
  | { state: 'pending' };

/** Итог обещания, если оно завершилось за `ms`; отказ перехватывается, чтобы не стать «необработанным» */
async function settleWithin(promise: PromiseLike<unknown>, ms: number): Promise<Settled> {
  let timer: NodeJS.Timeout | undefined;
  const outcome = Promise.resolve(promise).then(
    (value): Settled => ({ state: 'fulfilled', value }),
    (error: unknown): Settled => ({ state: 'rejected', error }),
  );
  const pending = new Promise<Settled>((resolve) => {
    timer = setTimeout(() => resolve({ state: 'pending' }), ms);
  });
  try {
    return await Promise.race([outcome, pending]);
  } finally {
    clearTimeout(timer);
  }
}

function reason(settled: Settled): string {
  if (settled.state !== 'rejected') return `not rejected: ${settled.state}`;
  return settled.error instanceof Error ? settled.error.message : String(settled.error);
}

async function waitFor(condition: () => boolean, ms = BOUND_MS): Promise<void> {
  const until = Date.now() + ms;
  while (!condition()) {
    if (Date.now() > until) throw new Error('condition not reached');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

interface FakeServerOptions {
  /** Принять TCP-соединение и не отвечать даже на приветствие */
  silentStartup?: boolean;
  /** Отвечать на SELECT 1 через столько миллисекунд; без значения SELECT остаётся без ответа */
  answerSelectAfterMs?: number;
}

interface FakePostgres {
  url: string;
  /** Сколько TCP-соединений принял сервер */
  connections: () => number;
  /** Сколько простых запросов (Query) дошло до сервера */
  queries: () => number;
  close: () => Promise<void>;
}

/**
 * Минимальный сервер протокола PostgreSQL 3.0: приветствие без пароля, BEGIN/COMMIT/ROLLBACK — сразу,
 * SELECT 1 — по настройке, всё остальное — без ответа (так ведёт себя соединение, убитое во сне).
 */
async function startFakePostgres(options: FakeServerOptions): Promise<FakePostgres> {
  const sockets = new Set<net.Socket>();
  let accepted = 0;
  let received = 0;

  const server = net.createServer((socket) => {
    accepted += 1;
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => undefined);
    if (options.silentStartup) return;

    let buffer: Buffer = Buffer.alloc(0);
    let started = false;
    let inTransaction = false;

    socket.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      for (;;) {
        if (!started) {
          if (buffer.length < 8) return;
          const length = buffer.readInt32BE(0);
          if (buffer.length < length) return;
          const code = buffer.readInt32BE(4);
          buffer = buffer.subarray(length);
          if (code === SSL_REQUEST || code === GSSENC_REQUEST) {
            socket.write('N');
            continue;
          }
          started = true;
          socket.write(Buffer.concat([message('R', int32(0)), readyForQuery('I')]));
          continue;
        }
        if (buffer.length < 5) return;
        const type = String.fromCharCode(buffer[0]!);
        const total = 1 + buffer.readInt32BE(1);
        if (buffer.length < total) return;
        const payload = buffer.subarray(5, total);
        buffer = buffer.subarray(total);

        if (type === 'X') {
          socket.end();
          return;
        }
        if (type !== 'Q') continue; // расширенный протокол — без ответа
        received += 1;
        const sql = payload.toString('utf8', 0, payload.length - 1).trim();
        if (/^BEGIN/i.test(sql)) {
          inTransaction = true;
          socket.write(Buffer.concat([commandComplete('BEGIN'), readyForQuery('T')]));
        } else if (/^(COMMIT|ROLLBACK)/i.test(sql)) {
          inTransaction = false;
          socket.write(Buffer.concat([commandComplete(sql.toUpperCase()), readyForQuery('I')]));
        } else if (/^SELECT 1$/i.test(sql) && options.answerSelectAfterMs !== undefined) {
          const status = inTransaction ? 'T' : 'I';
          setTimeout(() => {
            if (socket.destroyed) return;
            socket.write(
              Buffer.concat([
                rowDescriptionInt4('?column?'),
                dataRow('1'),
                commandComplete('SELECT 1'),
                readyForQuery(status),
              ]),
            );
          }, options.answerSelectAfterMs);
        }
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as net.AddressInfo;

  return {
    url: `postgresql://pms_fake:pms_fake@127.0.0.1:${port}/pms_fake?sslmode=disable`,
    connections: () => accepted,
    queries: () => received,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

const SSL_REQUEST = 80877103;
const GSSENC_REQUEST = 80877104;

function int16(value: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeInt16BE(value);
  return b;
}

function int32(value: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeInt32BE(value);
  return b;
}

function message(type: string, payload: Buffer): Buffer {
  return Buffer.concat([Buffer.from(type, 'latin1'), int32(payload.length + 4), payload]);
}

function cstring(value: string): Buffer {
  return Buffer.from(`${value}\0`, 'utf8');
}

function readyForQuery(status: 'I' | 'T'): Buffer {
  return message('Z', Buffer.from(status, 'latin1'));
}

function commandComplete(tag: string): Buffer {
  return message('C', cstring(tag));
}

function rowDescriptionInt4(name: string): Buffer {
  // поле: имя, oid таблицы, номер колонки, oid типа (23 = int4), размер, модификатор, формат (0 = текст)
  const field = Buffer.concat([cstring(name), int32(0), int16(0), int32(23), int16(4), int32(-1), int16(0)]);
  return message('T', Buffer.concat([int16(1), field]));
}

function dataRow(value: string): Buffer {
  const bytes = Buffer.from(value, 'utf8');
  return message('D', Buffer.concat([int16(1), int32(bytes.length), bytes]));
}
