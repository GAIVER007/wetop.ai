import { describe, expect, it } from 'vitest';
import { createRuntime, CSS_PATH } from './worker';
import { current } from './test/fixtures';
import type { RuntimeCurrent } from './types';

const ENV = { SITES_API_URL: 'https://api.example.test', SITES_RUNTIME_KEY: 'k', SITES_ENV: 'dev' };

function runtime(byHost: Record<string, { status: number; body?: unknown }>) {
  const logs: Array<Record<string, unknown>> = [];
  const calls: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    calls.push(url.pathname);
    const reply = byHost[url.searchParams.get('host') ?? ''] ?? { status: 404 };
    return new Response(reply.body === undefined ? '' : JSON.stringify(reply.body), { status: reply.status });
  }) as typeof fetch;
  const rt = createRuntime(ENV, { fetchImpl, log: (e) => logs.push(e) });
  const get = (url: string, method = 'GET') => rt.fetch(new Request(url, { method }));
  return { get, logs, calls };
}

const ok = (patch: Partial<RuntimeCurrent> = {}) => ({ status: 200, body: current(patch) });

describe('страница сайта', () => {
  it('главная: 200, HTML с lang, H1, заголовки безопасности, короткий кэш, noindex в dev', async () => {
    const { get } = runtime({ 'stepnoy.localhost': ok() });
    const res = await get('http://stepnoy.localhost/');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html.startsWith('<!doctype html><html lang="ru">')).toBe(true);
    expect(html).toContain('<h1 id="sec-hero-title">');
    expect(res.headers.get('cache-control')).toBe('public, max-age=60');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('permissions-policy')).toContain('camera=()');
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
  });

  it('скрипты только WETOP: счётчик и виджет с ключом связанного сайта, своих встроенных скриптов нет', async () => {
    const { get } = runtime({ 'stepnoy.localhost': ok() });
    const html = await (await get('http://stepnoy.localhost/')).text();
    const scripts = html.match(/<script[^>]*>/g) ?? [];
    for (const tag of scripts)
      expect(tag).toMatch(/^<script (type="application\/ld\+json"|async src="https:\/\/api\.example\.test\/(a\/pms|w\/widget)\.js" data-site="pms_0123456789ab")>$/);
    expect(html).toContain('<script async src="https://api.example.test/a/pms.js" data-site="pms_0123456789ab"></script>');
    expect(html).toContain('<script async src="https://api.example.test/w/widget.js" data-site="pms_0123456789ab"></script>');
  });

  it('согласие на счётчик: data-consent="wait"', async () => {
    const spec = current().spec!;
    spec.integrations.analytics = { mode: 'WETOP_TRACKER', consent: 'WAIT_FOR_CONSENT' };
    const { get } = runtime({ 'stepnoy.localhost': ok({ spec }) });
    expect(await (await get('http://stepnoy.localhost/')).text()).toContain('data-consent="wait"');
  });

  it('бронь выключена у сайта счётчика: ни виджета, ни Turnstile в CSP', async () => {
    const { get } = runtime({ 'stepnoy.localhost': ok({ bookingEnabled: false }) });
    const res = await get('http://stepnoy.localhost/');
    const html = await res.text();
    expect(html).not.toContain('widget.js');
    expect(html).not.toContain('pms-booking');
    expect(res.headers.get('content-security-policy')).not.toContain('challenges.cloudflare.com');
  });

  it('связанного сайта счётчика нет: ни одного внешнего скрипта, script-src none', async () => {
    const { get } = runtime({ 'stepnoy.localhost': ok({ publicKey: null, bookingEnabled: false }) });
    const res = await get('http://stepnoy.localhost/');
    const html = await res.text();
    expect(html).not.toMatch(/<script async/);
    expect(res.headers.get('content-security-policy')).toContain("script-src 'none'");
  });

  it('вторая страница по адресу, хвостовая косая черта 301, неизвестный путь 404 в оболочке сайта', async () => {
    const { get } = runtime({ 'stepnoy.localhost': ok() });
    expect((await get('http://stepnoy.localhost/privacy')).status).toBe(200);
    const moved = await get('http://stepnoy.localhost/privacy/');
    expect(moved.status).toBe(301);
    expect(moved.headers.get('location')).toBe('/privacy');
    const missing = await get('http://stepnoy.localhost/nope');
    expect(missing.status).toBe(404);
    expect(missing.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(await missing.text()).toContain('Страница не найдена');
    expect((await get('http://stepnoy.localhost/%E0%A4%A')).status).toBe(404);
  });

  it('HEAD без тела; POST 405', async () => {
    const { get } = runtime({ 'stepnoy.localhost': ok() });
    const head = await get('http://stepnoy.localhost/', 'HEAD');
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
    const post = await get('http://stepnoy.localhost/', 'POST');
    expect(post.status).toBe(405);
    expect(post.headers.get('allow')).toBe('GET, HEAD');
  });

  it('robots.txt и sitemap.xml по хосту', async () => {
    const { get } = runtime({ 'stepnoy.localhost': ok() });
    const robots = await get('http://stepnoy.localhost/robots.txt');
    expect(robots.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(await robots.text()).toBe('User-agent: *\nDisallow: /\n');
    const sitemap = await get('http://stepnoy.localhost/sitemap.xml');
    expect(sitemap.headers.get('content-type')).toBe('application/xml; charset=utf-8');
    expect(await sitemap.text()).toContain('<urlset');
  });

  it('стили: файл с хэшем, долгий неизменяемый кэш, без запроса к API', async () => {
    const { get, calls } = runtime({});
    const res = await get(`http://any.localhost${CSS_PATH}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(res.headers.get('content-type')).toBe('text/css; charset=utf-8');
    expect(calls).toEqual([]);
  });
});

describe('отказы без имени сайта', () => {
  it('неизвестный хост 404: нейтральная страница, имени нет', async () => {
    const { get } = runtime({});
    const res = await get('http://nobody.example.kz/');
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toContain('Сайт не найден');
    expect(html).not.toContain('Степной');
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });

  it('неверный документ: 503, не кэшируется', async () => {
    const { get } = runtime({ 'broken.localhost': { status: 503, body: { code: 'spec_invalid' } } });
    const res = await get('http://broken.localhost/');
    expect(res.status).toBe(503);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.text()).not.toContain('Степной');
  });

  it('незнакомая секция в документе: 503 и запись в лог, а не частичная страница', async () => {
    const spec = current().spec!;
    spec.pages[0]!.sections.push({ id: 'evil', type: 'html', variant: 'RAW', heading: { ru: 'x' } });
    const { get, logs } = runtime({ 'stepnoy.localhost': ok({ spec }) });
    const res = await get('http://stepnoy.localhost/');
    expect(res.status).toBe(503);
    expect(logs.some((l) => l['event'] === 'sites.render_failed' && l['renderError'] === true)).toBe(true);
  });

  it('сайт не запрашивает API за favicon.ico', async () => {
    const { get, calls } = runtime({});
    expect((await get('http://stepnoy.localhost/favicon.ico')).status).toBe(404);
    expect(calls).toEqual([]);
  });
});
