import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRuntime } from './worker';
import type { Env, RuntimeCurrent, SiteSpec } from './types';

/**
 * Локальный просмотр рантайма на Node без Cloudflare: тот же `createRuntime`, что у Worker. Режимы:
 * - по умолчанию ходит в API по `SITES_API_URL` с ключом `SITES_RUNTIME_KEY` из окружения (ключ в код не пишется);
 * - `--fixture` отвечает контрактом из `docs/marketing/sitespec-v0.example.json` без API (снимки и проверки UI).
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
    const body: RuntimeCurrent = {
      siteId: '00000000-0000-4000-8000-000000000001',
      state: 'PUBLISHED',
      primaryHost: null,
      defaultLocale: 'ru',
      versionId: '00000000-0000-4000-8000-000000000002',
      schemaVersion: 'site-spec/0',
      specHash: 'f'.repeat(64),
      spec,
      publicKey: 'pms_000000000000',
      bookingEnabled: booking,
      publicApiUrl: 'http://127.0.0.1:9',
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

createServer(async (req, res) => {
  const request = new Request(`http://${req.headers.host ?? '127.0.0.1'}${req.url ?? '/'}`, { method: req.method ?? 'GET' });
  const response = await runtime.fetch(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, '127.0.0.1', () => {
  console.log(`sites preview: http://stepnoy.localhost:${port}/ (${fixture ? 'fixture' : env.SITES_API_URL})`);
});
