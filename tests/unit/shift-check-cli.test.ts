/**
 * cli-shift-check.ts целиком: настоящий процесс, настоящий `serviceFetch`, подставной API WETOP на локальном порту
 * (двойная смена, plans/double-shift-2026-10-06.md). Держится то, на что опирается обёртка scripts/ops/shift-check.sh:
 * вход «таблица + разделитель + журнал», строки журнала в stdout, сводка в stderr, коды выхода; служебный ключ уходит
 * в заголовке; без ключа Channex брони канала и остатки честно «не сверено», а не «в ноль».
 */
import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CLI = resolve(import.meta.dirname, '../../scripts/reconciliation/src/cli-shift-check.ts');
const KEY = 'test-service-key';
const A = '20261006-AAAAAA';

const routes: Record<string, unknown> = {
  '/audit': [
    {
      at: '2026-10-06T04:10:00Z',
      entityType: 'Reservation',
      action: 'reservation.create',
      subject: A,
    },
  ],
  '/hotel/reservations': {
    total: 1,
    rows: [
      {
        confirmationNumber: A,
        status: 'CONFIRMED',
        source: 'DESK',
        channel: null,
        arrivalDate: '2026-10-06',
        departureDate: '2026-10-08',
      },
    ],
  },
  [`/reservations/${A}`]: {
    confirmationNumber: A,
    status: 'CONFIRMED',
    source: 'DESK',
    channel: null,
    externalId: null,
    arrivalDate: '2026-10-06',
    departureDate: '2026-10-08',
  },
  '/finance/operations': {
    truncated: false,
    rows: [
      {
        kind: 'PAYMENT',
        status: 'COMPLETED',
        method: 'CASH',
        amountMinor: '1200000',
        confirmationNumber: A,
        localAt: '2026-10-06 09:12',
      },
    ],
  },
  '/finance/cash': { reconciliations: [] },
  '/chessboard': {
    byCategory: { '2026-10-06': { DORM6: { units: 6, occupied: 1, blocked: 0 } } },
    unassigned: [],
  },
  '/channels/channex/outbox': { pending: 0, failed: 0, oldestPendingAt: null, ariStopped: false },
  '/channels/channex/mapping': [
    { localAccommodationTypeCode: 'DORM6', providerPropertyId: 'p', providerRoomTypeId: 'rt' },
  ],
};

let server: Server;
let api = '';
const seen: Array<{ path: string; method: string; key: string | undefined }> = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    const path = (req.url ?? '').split('?')[0]!;
    seen.push({
      path,
      method: req.method ?? '',
      key: req.headers['x-wetop-service-key'] as string | undefined,
    });
    if (req.headers['x-wetop-service-key'] !== KEY) {
      res
        .writeHead(401, { 'content-type': 'application/json' })
        .end('{"message":"Требуется вход"}');
      return;
    }
    const body = routes[path];
    if (body === undefined) res.writeHead(404).end('{}');
    else res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(body));
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  api = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((done) => server.close(() => done())));

function run(stdin: string, opts: { key?: string } = {}) {
  return new Promise<{ code: number | null; out: string; err: string }>((done) => {
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', CLI, '--date', '2026-10-06', '--to', '14:05', '--nights', '1'],
      {
        env: {
          ...process.env,
          APP_API_URL: api,
          SERVICE_API_KEY: opts.key ?? KEY,
          // пустые, но заданные: dotenv из .env разработчика их не перепишет
          CHANNEX_API_KEY: '',
          SHIFT_TZ: 'Asia/Almaty',
        },
      },
    );
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += String(d)));
    child.stderr.on('data', (d) => (err += String(d)));
    child.on('close', (code) => done({ code, out, err }));
    child.stdin.end(stdin);
  });
}

const TABLE = [
  'время\tсобытие\tбронь\tзаезд\tвыезд\tсумма\tспособ',
  `09:10\tновая бронь\t${A}\t06.10.2026\t08.10.2026\t\t`,
].join('\n');
const MARKER = '#=== журнал расхождений ===';

describe('cli-shift-check.ts', () => {
  it('расхождение по деньгам: строка журнала с заголовком в stdout, сводка в stderr, код 1, только GET со служебным ключом', async () => {
    const r = await run(`${TABLE}\n${MARKER}\n`);
    expect(r.code, r.err).toBe(1);
    expect(r.out.startsWith('\uFEFF№;когда (Алматы);список')).toBe(true);
    expect(r.out).toContain(
      `;деньги;${A} оплата;12 000 ₸, Наличные, 09:12;таблица;строки нет;в WETOP есть, в таблице нет;открыто;;`,
    );
    expect(r.err).toContain('Сверка смены 06.10.2026, окно 00:00–14:05');
    expect(r.err).toContain('Channex не сверен: нет CHANNEX_API_KEY в окружении API');
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((s) => s.method === 'GET' && s.key === KEY)).toBe(true);
  }, 30_000);

  it('то же расхождение уже открыто в журнале: stdout пуст, номер в «ещё не сошлись»', async () => {
    const first = await run(`${TABLE}\n${MARKER}\n`);
    const second = await run(`${TABLE}\n${MARKER}\n${first.out}`);
    expect(second.code).toBe(1);
    expect(second.out).toBe('');
    expect(second.err).toMatch(/Ещё не сошлись \(открыты в журнале\): Д-[0-9a-f]{6}/);
  }, 30_000);

  it('API не принял служебный ключ: код 2 и понятная причина, журнал не трогается', async () => {
    const r = await run(`${TABLE}\n${MARKER}\n`, { key: 'wrong' });
    expect(r.code).toBe(2);
    expect(r.out).toBe('');
    expect(r.err).toContain('сверка не выполнена: API не принял служебный ключ');
  }, 30_000);

  it('пустая таблица: код 2 до обращения к API', async () => {
    const before = seen.length;
    const r = await run(`\n${MARKER}\n`);
    expect(r.code).toBe(2);
    expect(r.err).toContain('таблица смены пустая');
    expect(seen.length).toBe(before);
  }, 30_000);
});
