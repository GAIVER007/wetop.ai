import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * Скрипт быстрого туннеля не должен работать, когда у PMS уже есть постоянный адрес.
 *
 * 15.09.2026: после посадки домена (`PUBLIC_API_URL=https://api.wetop.ai`) кто-то запустил
 * `scripts/ops/channex-tunnel.sh`; тот поднял одноразовый туннель, перерегистрировал на него webhook
 * Channex и умер — webhook снова указывал в никуда, а брони шли только опросом ленты.
 * Скрипт обязан отказаться на старте, до создания туннеля; осознанный запуск — ALLOW_QUICK_TUNNEL=1.
 */
const SCRIPT = resolve(import.meta.dirname, '../../scripts/ops/channex-tunnel.sh');
const PERMANENT = 'https://api.wetop.ai/channels/channex/webhook';

let server: Server | null = null;

/** Поддельный API PMS: отдаёт статус webhook с заданным постоянным адресом (или ошибку statusCode). */
function fakeApi(
  expectedUrl: string | null,
  callbackUrl: string | null = null,
  statusCode = 200,
): Promise<number> {
  return new Promise((done) => {
    server = createServer((req, res) => {
      const path = (req.url ?? '').split('?')[0];
      if (path === '/channels/channex/webhook/status') {
        res.writeHead(statusCode, { 'content-type': 'application/json' });
        res.end(
          statusCode === 200
            ? JSON.stringify({ registered: true, callbackUrl, expectedUrl })
            : JSON.stringify({ statusCode, message: 'Channex не ответил' }),
        );
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    server.listen(0, '127.0.0.1', () => done((server!.address() as { port: number }).port));
  });
}

/** Порт, на котором никто не слушает: API ещё не поднялся */
function closedPort(): Promise<number> {
  return new Promise((done) => {
    const probe = createServer();
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => done(port));
    });
  });
}

/** Запуск скрипта. cloudflared подменён несуществующим путём: если защита не сработает, это будет видно. */
function run(port: number, env: Record<string, string> = {}) {
  return new Promise<{ code: number | null; out: string }>((done) => {
    const p = spawn('bash', [SCRIPT], {
      env: {
        ...process.env,
        API_URL: `http://127.0.0.1:${port}`,
        CLOUDFLARED: '/nonexistent/cloudflared',
        CHECK_EVERY: '1',
        ...env,
      },
    });
    let out = '';
    p.stdout.on('data', (c) => (out += c));
    p.stderr.on('data', (c) => (out += c));
    const kill = setTimeout(() => p.kill('SIGKILL'), 20_000);
    p.on('close', (code) => {
      clearTimeout(kill);
      done({ code, out });
    });
  });
}

afterEach(() => {
  server?.close();
  server = null;
});

describe('scripts/ops/channex-tunnel.sh: постоянный адрес важнее быстрого туннеля', () => {
  it('отказывается запускаться, когда у PMS задан постоянный адрес', async () => {
    const port = await fakeApi(PERMANENT);
    const { code, out } = await run(port);
    expect(out).toMatch(/постоянный адрес/i);
    expect(out).not.toMatch(/туннель поднят/);
    expect(code).not.toBe(0);
  }, 30_000);

  /*
   * 16.09.2026: защита срабатывала только там, где задан PUBLIC_API_URL. На второй машине разработчика
   * его нет, и её сторож туннеля каждые ~90 секунд затирал постоянный адрес объекта своим одноразовым
   * (журнал перерегистраций 11:10–12:03; в той же dev-базе лежат стеки с /Users/vyacheslav/). Аккаунт
   * Channex общий, поэтому решает не локальное окружение, а то, что уже записано в Channex: постоянный
   * адрес одноразовым туннелем не затираем ни с какой машины.
   */
  it('в Channex уже записан постоянный адрес — не затираем его, даже без PUBLIC_API_URL', async () => {
    const port = await fakeApi(null, PERMANENT);
    const { code, out } = await run(port);
    expect(out).toMatch(/постоянный адрес/i);
    expect(out).not.toMatch(/туннель поднят/);
    expect(code).not.toBe(0);
  }, 30_000);

  it('в Channex записан одноразовый туннель — работаем как прежде', async () => {
    // домен настоящий по форме: скрипт узнаёт одноразовый туннель по нему, обращений к хосту нет
    const port = await fakeApi(
      null,
      'https://old-tunnel.trycloudflare.com/channels/channex/webhook',
    );
    const { out } = await run(port);
    expect(out).not.toMatch(/постоянный адрес/i);
  }, 30_000);

  it('осознанный запуск с ALLOW_QUICK_TUNNEL=1 проходит защиту', async () => {
    const port = await fakeApi(PERMANENT);
    const { out } = await run(port, { ALLOW_QUICK_TUNNEL: '1' });
    expect(out).not.toMatch(/постоянный адрес PMS.*отказ/i);
  }, 30_000);

  it('без постоянного адреса работает как прежде', async () => {
    const port = await fakeApi(null);
    const { out } = await run(port);
    expect(out).not.toMatch(/постоянный адрес/i);
  }, 30_000);

  /*
   * 16.09.2026, вечер: repo-sync.sh --relink переустановил службы, launchd поднял api и tunnel одновременно.
   * curl к API не прошёл, пустой статус сошёл за «постоянного адреса нет», и быстрый туннель второй машины
   * снова затёр api.wetop.ai в Channex. Пока статус недоступен, решать нечего: ждём API, не дождались — отказ.
   * launchd (KeepAlive) перезапустит скрипт через 15 с, и защита сработает уже по настоящему ответу.
   */
  it('API ещё не поднялся — ждёт статус, не дождавшись, отказывается, а не считает адрес свободным', async () => {
    const port = await closedPort();
    const { code, out } = await run(port, { API_WAIT: '2' });
    expect(out).toMatch(/статус webhook недоступен/i);
    expect(out).not.toMatch(/туннель поднят|cloudflared не выдал/);
    expect(code).toBe(3);
  }, 30_000);

  it('API отвечает ошибкой на статус (Channex молчит) — тоже отказ', async () => {
    const port = await fakeApi(null, null, 502);
    const { code, out } = await run(port, { API_WAIT: '2' });
    expect(out).toMatch(/статус webhook недоступен/i);
    expect(code).toBe(3);
  }, 30_000);
});
