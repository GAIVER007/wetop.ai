import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRuntime } from './worker';
import type { Env, RuntimeCurrent, SiteSpec } from './types';

/**
 * Локальный просмотр рантайма на Node без Cloudflare: тот же `createRuntime`, что у Worker. Режимы:
 * - по умолчанию ходит в API по `SITES_API_URL` с ключом `SITES_RUNTIME_KEY` из окружения (ключ в код не пишется);
 * - `--fixture` отвечает контрактом из `docs/marketing/sitespec-v0.example.json` без API (снимки и проверки UI); адрес
 *   API в контракте это тот же сервер по `127.0.0.1`: он отдаёт подставной `/w/from-prices` (Q-276) с CORS и пустые
 *   скрипты виджета и счётчика. Хост `pricefail.*` получает ошибку цены, `nobooking.*` выключенную бронь.
 * Порт: `SITES_PREVIEW_PORT`, по умолчанию 8788.
 */
const fixture = process.argv.includes('--fixture');
const port = Number(process.env['SITES_PREVIEW_PORT'] ?? 8788);

function fixtureFetch(): typeof fetch {
  const spec = JSON.parse(
    readFileSync(resolve(import.meta.dirname, '../../../docs/marketing/sitespec-v0.example.json'), 'utf8'),
  ) as SiteSpec;
  return async (input) => {
    const url = new URL(String(input));
    const host = url.searchParams.get('host') ?? '';
    if (!host.endsWith('.localhost') && host !== '127.0.0.1') return new Response('{}', { status: 404 });
    const booking = !host.startsWith('nobooking.');
    const key = host.startsWith('pricefail.') ? 'pms_pricefail00' : 'pms_000000000000';
    const body: RuntimeCurrent = {
      siteId: '00000000-0000-4000-8000-000000000001',
      state: 'PUBLISHED',
      primaryHost: null,
      defaultLocale: 'ru',
      versionId: '00000000-0000-4000-8000-000000000002',
      schemaVersion: 'site-spec/0',
      specHash: 'f'.repeat(64),
      spec,
      publicKey: key,
      bookingEnabled: booking,
      publicApiUrl: `http://127.0.0.1:${port}`,
      assets: {},
      publicFacts: {
        loadedAt: new Date().toISOString(),
        checkInTime: '14:00',
        checkOutTime: '12:00',
        categories: [
          { code: 'standard-double', active: true, capacityAdults: 2 },
          { code: 'dorm-bed', active: true, capacityAdults: 1 },
        ],
      },
    };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  };
}

const env: Env = {
  SITES_API_URL: fixture ? 'http://fixture.invalid' : (process.env['SITES_API_URL'] ?? 'http://127.0.0.1:3001'),
  SITES_RUNTIME_KEY: fixture ? 'fixture' : (process.env['SITES_RUNTIME_KEY'] ?? ''),
  SITES_ENV: 'dev',
};
const runtime = createRuntime(env, fixture ? { fetchImpl: fixtureFetch() } : {});

/** Подставной API WETOP для `--fixture`: цена «от» (Q-276) и пустые скрипты, чтобы страница не ходила наружу */
function fixtureApi(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse): boolean {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  const origin = req.headers.origin;
  const cors: Record<string, string> = origin ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {};
  if (url.pathname === '/w/from-prices') {
    if (url.searchParams.get('k') === 'pms_pricefail00') {
      res.writeHead(500, { 'content-type': 'application/json', ...cors });
      res.end('{"message":"сбой"}');
      return true;
    }
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'public, max-age=60', ...cors });
    res.end(
      JSON.stringify({
        currency: 'KZT',
        window: { from: '2026-10-07', to: '2026-11-05' },
        categories: [
          { code: 'standard-double', fromMinor: '2500000' },
          { code: 'dorm-bed', fromMinor: '800000' },
        ],
      }),
    );
    return true;
  }
  if (url.pathname === '/w/widget.js' || url.pathname === '/a/pms.js') {
    res.writeHead(200, { 'content-type': 'application/javascript' });
    res.end('');
    return true;
  }
  return false;
}

createServer(async (req, res) => {
  if (fixture && (req.headers.host ?? '').startsWith('127.0.0.1') && fixtureApi(req, res)) return;
  const request = new Request(`http://${req.headers.host ?? '127.0.0.1'}${req.url ?? '/'}`, { method: req.method ?? 'GET' });
  const response = await runtime.fetch(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, '127.0.0.1', () => {
  console.log(`sites preview: http://stepnoy.localhost:${port}/ (${fixture ? 'fixture' : env.SITES_API_URL})`);
});
