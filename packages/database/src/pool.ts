/**
 * Сроки ожидания пула соединений с базой (ADR-043) — для каждого процесса: API, импорт, сверки.
 *
 * 14.09.2026 Mac уснул на батарее; после пробуждения API не отвечал, пока его не перезапустили. Соединение, убитое
 * во сне, само не закрывается: запрос ждёт ответа вечно, место в пуле не освобождается, следующий запрос ждёт
 * свободного места тоже вечно. В транзакции Prisma шлёт ROLLBACK в очередь за зависшим запросом — соединение
 * не возвращается никогда. Доказательство — `pool-timeouts.test.ts`.
 *
 * Переменные (миллисекунды, целое число; 0 — выключить; пусто или ошибка — значение по умолчанию):
 * - `DATABASE_CONNECT_TIMEOUT_MS` — подключение и ожидание свободного места в пуле;
 * - `DATABASE_QUERY_TIMEOUT_MS` — сколько база может молчать на отправленный запрос, потом соединение закрывается;
 * - `DATABASE_KEEPALIVE_DELAY_MS` — через сколько тишины система начинает проверять, жив ли собеседник (TCP keepalive).
 */
import type { Socket } from 'node:net';
import pg from 'pg';

/**
 * Длинные транзакции импорта (до 900 с) состоят из коротких запросов, поэтому срок — на ответ, а не на транзакцию.
 * Место в пуле ждём не меньше самого длинного maxWait в коде (30 с у импорта), чтобы не урезать его молча.
 */
export const DATABASE_POOL_DEFAULTS = {
  connectTimeoutMs: 30_000,
  queryTimeoutMs: 30_000,
  keepAliveDelayMs: 10_000,
} as const;

export interface DatabasePoolTimeouts {
  connectionTimeoutMillis: number;
  keepAlive: boolean;
  keepAliveInitialDelayMillis?: number;
  Client?: typeof pg.Client;
}

type Env = Record<string, string | undefined>;

export function databasePoolTimeouts(env: Env = process.env): DatabasePoolTimeouts {
  const connectTimeoutMs = milliseconds(env, 'DATABASE_CONNECT_TIMEOUT_MS', DATABASE_POOL_DEFAULTS.connectTimeoutMs);
  const queryTimeoutMs = milliseconds(env, 'DATABASE_QUERY_TIMEOUT_MS', DATABASE_POOL_DEFAULTS.queryTimeoutMs);
  const keepAliveDelayMs = milliseconds(env, 'DATABASE_KEEPALIVE_DELAY_MS', DATABASE_POOL_DEFAULTS.keepAliveDelayMs);
  return {
    // pg-pool: и установка соединения, и ожидание свободного места, когда пул занят
    connectionTimeoutMillis: connectTimeoutMs,
    ...(keepAliveDelayMs > 0
      ? { keepAlive: true, keepAliveInitialDelayMillis: keepAliveDelayMs }
      : { keepAlive: false }),
    ...(queryTimeoutMs > 0 ? { Client: clientWithQueryDeadline(queryTimeoutMs) } : {}),
  };
}

function milliseconds(env: Env, name: string, fallback: number): number {
  const raw = env[name]?.trim();
  return raw && /^\d+$/.test(raw) ? Number(raw) : fallback;
}

/**
 * pg.Client, который закрывает соединение, если на отправленный запрос база молчит дольше срока.
 *
 * Встроенный `query_timeout` в pg так не делает: запрос получает ошибку, а соединение остаётся открытым с зависшим
 * запросом. Транзакция Prisma отдаёт его пулу без ошибки, и пул выдаёт это соединение следующему запросу — тот
 * встаёт в очередь за зависшим, а на живом, но медленном сервере выполняется внутри чужой открытой транзакции
 * (красный тест в `pool-timeouts.test.ts`). Закрытый сокет — путь, который pg, pg-pool, адаптер и Prisma уже
 * проходят при обрыве сети: запросы получают ошибку, пул выбрасывает соединение, сервер откатывает транзакцию.
 */
function clientWithQueryDeadline(deadlineMs: number): typeof pg.Client {
  return class QueryDeadlineClient extends pg.Client {
    constructor(config?: string | pg.ClientConfig) {
      super(config);
      this.once('connect', () => {
        // при TLS здесь уже защищённый сокет; тишина считается по любым байтам в обе стороны
        const socket = this.connection.stream as Socket;
        socket.setTimeout(deadlineMs);
        socket.on('timeout', () => {
          // простой свободного соединения в пуле — не повод его закрывать
          if ((this as unknown as { readyForQuery: boolean }).readyForQuery) return;
          socket.destroy(new Error(`Database did not answer for ${deadlineMs} ms; connection closed`));
        });
      });
    }
  };
}
