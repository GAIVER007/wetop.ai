import { describe, expect, it } from 'vitest';
import { createRuntime, CSS_PATH, PRICES_PATH } from './worker';
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
      expect(tag).toMatch(
        /^<script (type="application\/ld\+json"|async src="https:\/\/api\.example\.test\/(a\/pms|w\/widget)\.js" data-site="pms_0123456789ab"|defer src="\/_wetop\/prices-[0-9a-f]{8}\.js" data-api="https:\/\/api\.example\.test" data-site="pms_0123456789ab" data-locale="ru-RU" data-label="от \{price\} \/ ночь")>$/,
      );
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

describe('цена «от» (Q-276)', () => {
  it('главная: скрипт цен в CSP через self, числа цены в HTML нет', async () => {
    const { get } = runtime({ 'stepnoy.localhost': ok() });
    const res = await get('http://stepnoy.localhost/');
    const html = await res.text();
    expect(html).toContain(`<script defer src="${PRICES_PATH}"`);
    expect(res.headers.get('content-security-policy')).toMatch(/script-src 'self' https:\/\/api\.example\.test/);
    expect(html).not.toMatch(/₸/);
  });

  it('файл цен: JavaScript, долгий кэш, без запроса к API', async () => {
    const { get, calls } = runtime({});
    const res = await get(`http://any.localhost${PRICES_PATH}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/javascript; charset=utf-8');
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(await res.text()).toContain('/w/from-prices');
    expect(calls).toEqual([]);
  });

  it('бронь сайта выключена: ни скрипта цен, ни секции цен, ни self в script-src', async () => {
    const { get } = runtime({ 'stepnoy.localhost': ok({ bookingEnabled: false }) });
    const res = await get('http://stepnoy.localhost/');
    const html = await res.text();
    expect(html).not.toContain(PRICES_PATH);
    expect(html).not.toContain('sec-pricing');
    expect(res.headers.get('content-security-policy')).not.toContain("'self' https");
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

describe('MKT7: основной хост и превью', () => {
  const PREVIEW_ENV = { ...ENV, SITES_BASE_DOMAIN: 'sites.test' };
  function previewRuntime(reply: { status: number; body?: unknown }) {
    const calls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      calls.push(`${url.pathname}?${url.searchParams.toString()}`);
      if (url.pathname === '/sites-runtime/preview')
        return new Response(reply.body === undefined ? '' : JSON.stringify(reply.body), { status: reply.status });
      return new Response('', { status: 404 });
    }) as typeof fetch;
    const rt = createRuntime(PREVIEW_ENV, { fetchImpl, log: () => undefined });
    return { get: (url: string) => rt.fetch(new Request(url)), calls };
  }
  const previewBody = () => ({
    ...current({ publicKey: null, bookingEnabled: false }),
    state: 'PREVIEW',
    expiresAt: '2026-10-07T12:00:00.000Z',
  });

  it('не основной хост: 301 на основной с тем же путём и запросом', async () => {
    const { get } = runtime({ 'old.sites.test': ok({ primaryHost: 'luxx.sites.test' }) });
    const res = await get('https://old.sites.test/privacy?utm_source=x');
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://luxx.sites.test/privacy?utm_source=x');
    const { get: same } = runtime({ 'luxx.sites.test': ok({ primaryHost: 'luxx.sites.test' }) });
    expect((await same('https://LUXX.sites.test/')).status).toBe(200);
  });

  it('превью: только версия из токена, без скриптов WETOP, noindex, private no-store, без referrer', async () => {
    const { get, calls } = previewRuntime({ status: 200, body: previewBody() });
    const res = await get('https://preview.sites.test/?token=abc.def');
    expect(res.status).toBe(200);
    expect(calls).toEqual(['/sites-runtime/preview?token=abc.def']);
    const html = await res.text();
    expect(html).not.toMatch(/<script async|<script defer/);
    expect(html).not.toContain('pms_');
    expect(html).not.toContain('rel="canonical"');
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    expect(res.headers.get('content-security-policy')).toContain("script-src 'none'");
  });

  it('превью: robots.txt запрещает всё, карты сайта нет, без токена API не спрашивается', async () => {
    const { get, calls } = previewRuntime({ status: 200, body: previewBody() });
    const robots = await get('https://preview.sites.test/robots.txt');
    expect(robots.status).toBe(200);
    expect(await robots.text()).toContain('Disallow: /');
    expect((await get('https://preview.sites.test/sitemap.xml?token=abc.def')).status).toBe(404);
    const none = await get('https://preview.sites.test/');
    expect(none.status).toBe(404);
    expect(none.headers.get('cache-control')).toBe('private, no-store');
    expect(calls).toEqual([]);
  });

  it('превью: истёкшая ссылка 410, испорченная 404, нейтрально и без имени сайта', async () => {
    const expired = await previewRuntime({ status: 410, body: { code: 'preview_expired' } }).get('https://preview.sites.test/?token=a.b');
    expect(expired.status).toBe(410);
    expect(expired.headers.get('cache-control')).toBe('private, no-store');
    const bad = await previewRuntime({ status: 404 }).get('https://preview.sites.test/?token=a.b');
    expect(bad.status).toBe(404);
    expect(await bad.text()).not.toContain('Степной');
  });

  it('превью на всех страницах версии: внутренние ссылки несут тот же токен, внешние нет', async () => {
    const { get, calls } = previewRuntime({ status: 200, body: previewBody() });
    const home = await (await get('https://preview.sites.test/?token=abc.def')).text();
    // страница политики из подвала и бренд ведут внутрь превью с токеном
    expect(home).toContain('href="/privacy?token=abc.def"');
    expect(home).toContain('class="brand" href="/?token=abc.def"');
    // секция той же страницы: только фрагмент, адрес с токеном браузер сохраняет сам
    expect(home).toContain('href="#sec-rooms"');
    expect(home).not.toMatch(/href="\/(privacy)?(#[^"]*)?"/);
    const res = await get('https://preview.sites.test/privacy?token=abc.def');
    expect(res.status).toBe(200);
    expect(calls).toEqual(['/sites-runtime/preview?token=abc.def', '/sites-runtime/preview?token=abc.def']);
    const privacy = await res.text();
    // секция другой страницы: токен до фрагмента
    expect(privacy).toContain('href="/?token=abc.def#sec-rooms"');
    expect(privacy).toContain('class="brand" href="/?token=abc.def"');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    // внешний адрес токена не получает
    expect(privacy).not.toMatch(/href="https:[^"]*token=/);
    expect(home).not.toMatch(/href="https:[^"]*token=/);
    // 404 превью: «На главную» тоже с токеном
    const missing = await get('https://preview.sites.test/nope?token=abc.def');
    expect(missing.status).toBe(404);
    expect(await missing.text()).toContain('class="btn" href="/?token=abc.def"');
  });

  it('публичный сайт: внутренние ссылки без токена, как раньше', async () => {
    const { get } = runtime({ 'stepnoy.example.test': ok() });
    const html = await (await get('https://stepnoy.example.test/privacy')).text();
    expect(html).toContain('href="/#sec-rooms"');
    expect(html).toContain('class="brand" href="/"');
    expect(html).not.toContain('token=');
  });

  it.each([
    ['wetop.ai', 'wetop.ai'],
    ['поддомен wetop.ai', 'sites.wetop.ai'],
    ['со схемой', 'https://sites.example'],
    ['с портом', 'sites.example:8443'],
    ['с путём', 'sites.example/x'],
  ])('Q-271 в Worker: SITES_BASE_DOMAIN %s, превью не включается и API не спрашивается', async (_l, base) => {
    const calls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response('', { status: 404 });
    }) as typeof fetch;
    const rt = createRuntime({ ...ENV, SITES_BASE_DOMAIN: base }, { fetchImpl, log: () => undefined });
    const bare = base.replace(/^https:\/\//, '').replace(/[:/].*$/, '');
    const res = await rt.fetch(new Request(`https://preview.${bare}/?token=abc.def`));
    expect(res.status).toBe(404);
    expect(calls.some((c) => c.includes('/sites-runtime/preview'))).toBe(false);
  });

  it('Q-271 в Worker: правильный SITES_BASE_DOMAIN включает превью на preview.<домен>', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      calls.push(url.pathname);
      return new Response(JSON.stringify(previewBody()), { status: 200 });
    }) as typeof fetch;
    const rt = createRuntime({ ...ENV, SITES_BASE_DOMAIN: 'sites.example' }, { fetchImpl, log: () => undefined });
    expect((await rt.fetch(new Request('https://preview.sites.example/?token=abc.def'))).status).toBe(200);
    expect(calls).toEqual(['/sites-runtime/preview']);
  });

  it('хост не имя (IP, одна часть): 404 без запроса к API', async () => {
    const { get, calls } = runtime({});
    expect((await get('http://127.0.0.1/')).status).toBe(404);
    expect((await get('http://localhost/')).status).toBe(404);
    expect(calls).toEqual([]);
  });
});

describe('MKT7: индексация по окружению Worker', () => {
  function envRuntime(envName: string, primaryHost: string | null) {
    const fetchImpl = (async () =>
      new Response(JSON.stringify(current({ primaryHost })), { status: 200 })) as unknown as typeof fetch;
    const rt = createRuntime({ ...ENV, SITES_ENV: envName }, { fetchImpl, log: () => undefined });
    return (url: string) => rt.fetch(new Request(url));
  }

  it('production с основным хостом и robots=INDEX: index, canonical и карта сайта на основной хост', async () => {
    const get = envRuntime('production', 'luxx.sites.example');
    const res = await get('https://luxx.sites.example/');
    expect(res.status).toBe(200);
    expect(res.headers.get('x-robots-tag')).toBeNull();
    const html = await res.text();
    expect(html).toContain('<link rel="canonical" href="https://luxx.sites.example/">');
    expect(html).not.toContain('noindex');
    const sitemap = await (await get('https://luxx.sites.example/sitemap.xml')).text();
    expect(sitemap).toContain('<loc>https://luxx.sites.example/</loc>');
    const robots = await (await get('https://luxx.sites.example/robots.txt')).text();
    expect(robots).toContain('Sitemap: https://luxx.sites.example/sitemap.xml');
  });

  it('staging даже с основным хостом: noindex, без боевого canonical', async () => {
    const res = await envRuntime('staging', 'luxx.sites.example')('https://luxx.sites.example/');
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(await res.text()).not.toContain('rel="canonical"');
  });

  it('production без основного хоста: noindex', async () => {
    const res = await envRuntime('production', null)('https://luxx.sites.example/');
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(await res.text()).not.toContain('rel="canonical"');
  });
});

describe('MKT8: картинки из библиотеки', () => {
  // ссылки примера SiteSpec: логотип, фавиконка, герой и картинка og главной, «о нас», карточки номеров, галерея
  const LOGO = '6f1c2a90-3b4d-4e5f-8a6b-7c8d9e0f1a2b';
  const FAVICON = '7a2d3b01-4c5e-4f60-9b7c-8d9e0f1a2b3c';
  const HERO = '8b3e4c12-5d6f-4071-8c8d-9e0f1a2b3c4d';
  const GALLERY = ['c3d4e5f6-2031-4c4d-8e5f-6a7b8c9d0e1f', 'd4e5f607-3142-4d5e-9f60-7b8c9d0e1f20', 'e5f60718-4253-4e6f-8071-8c9d0e1f2031'];
  const signed = (id: string, origin = 'https://object.storage.example.kz') =>
    `${origin}/wetop-site-assets/site-assets/loc/${id}/${'a'.repeat(64)}.webp?X-Amz-Expires=3600&X-Amz-Signature=${'b'.repeat(64)}`;
  const assets = Object.fromEntries([LOGO, FAVICON, HERO, ...GALLERY].map((id) => [id, signed(id)]));
  const directive = (csp: string, name: string) => csp.split('; ').find((d) => d.startsWith(`${name} `)) ?? '';

  it('§50, §55: подписанные адреса в разметке; img-src ровно с origin хранилища, без https: и *', async () => {
    const { get } = runtime({ 'stepnoy.localhost': ok({ assets }) });
    const res = await get('http://stepnoy.localhost/');
    const html = await res.text();
    expect(html).toContain(`<img src="${signed(HERO).replace(/&/g, '&amp;')}"`);
    expect(html).toContain('class="brand__logo"');
    expect(html).toContain(`<link rel="icon" href="${signed(FAVICON).replace(/&/g, '&amp;')}">`);
    expect(html).toContain(`<meta property="og:image" content="${signed(HERO).replace(/&/g, '&amp;')}">`);
    for (const id of GALLERY) expect(html).toContain(signed(id).replace(/&/g, '&amp;'));
    const csp = res.headers.get('content-security-policy')!;
    expect(directive(csp, 'img-src')).toBe("img-src 'self' data: https://object.storage.example.kz");
    expect(csp).not.toMatch(/img-src[^;]*(https:(?!\/\/)|\*)/);
    // origin картинок не попадает ни в скрипты, ни в соединения, ни во фреймы
    for (const name of ['script-src', 'connect-src', 'frame-src', 'default-src']) expect(directive(csp, name)).not.toContain('object.storage');
  });

  it('§93: без картинок CSP прежний', async () => {
    const before = (await runtime({ 'stepnoy.localhost': ok() }).get('http://stepnoy.localhost/')).headers.get('content-security-policy')!;
    expect(directive(before, 'img-src')).toBe("img-src 'self' data:");
    const html = await (await runtime({ 'stepnoy.localhost': ok() }).get('http://stepnoy.localhost/')).text();
    expect(html).not.toContain('<img');
    expect(html).not.toContain('og:image');
  });

  it('§54: адрес картинки не https, с логином, на localhost или IP, javascript и data: не выводится и в CSP не попадает', async () => {
    const bad: Record<string, string> = {
      [HERO]: 'http://object.storage.example.kz/x.webp',
      [LOGO]: 'https://user:pass@object.storage.example.kz/x.webp',
      [FAVICON]: 'javascript:alert(1)',
      [GALLERY[0]!]: 'data:image/png;base64,AAAA',
      [GALLERY[1]!]: 'https://127.0.0.1/x.webp',
      [GALLERY[2]!]: 'https://localhost/x.webp',
    };
    const { get, logs } = runtime({ 'stepnoy.localhost': ok({ assets: bad }) });
    const res = await get('http://stepnoy.localhost/');
    const html = await res.text();
    expect(html).not.toContain('<img');
    expect(html).not.toMatch(/javascript:|data:image|127\.0\.0\.1|user:pass/);
    expect(directive(res.headers.get('content-security-policy')!, 'img-src')).toBe("img-src 'self' data:");
    expect(logs.filter((l) => l['event'] === 'sites.asset_url_rejected')).toHaveLength(6);
    expect(JSON.stringify(logs)).not.toContain('user:pass');
  });

  it('§95: превью с картинкой: картинка есть, но ни брони, ни счётчика, noindex и no-store', async () => {
    const fetchImpl = (async (input: RequestInfo | URL) =>
      new URL(String(input)).pathname === '/sites-runtime/preview'
        ? new Response(JSON.stringify({ ...current({ publicKey: null, bookingEnabled: false, assets }), state: 'PREVIEW', expiresAt: '2026-10-07T12:00:00.000Z' }), { status: 200 })
        : new Response('', { status: 404 })) as typeof fetch;
    const rt = createRuntime({ ...ENV, SITES_BASE_DOMAIN: 'sites.test' }, { fetchImpl, log: () => undefined });
    const res = await rt.fetch(new Request('https://preview.sites.test/?token=abc.def'));
    const html = await res.text();
    expect(html).toContain(signed(HERO).replace(/&/g, '&amp;'));
    expect(html).not.toMatch(/<script async|<script defer|pms-booking/);
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(directive(res.headers.get('content-security-policy')!, 'img-src')).toBe("img-src 'self' data: https://object.storage.example.kz");
  });
});
