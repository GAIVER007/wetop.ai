import { describe, expect, it, vi } from 'vitest';
import { handleSiteAuth, siteOrigins, sessionCookieHeader, type SiteAuthAction } from './site-auth';

/**
 * Окно входа и регистрации на wetop.ai (plans/site-auth-dialog-tour-2026-09-27.md, Д1): сайт статический и шлёт
 * `fetch` на стойку. Стойка обязана пускать только свои источники, ставить куку сама и не отдавать ключ сессии в теле.
 */
const PROD = { NODE_ENV: 'production', APP_URL: 'https://app.wetop.ai' };

function request(
  body: unknown,
  { origin = 'https://wetop.ai', method = 'POST', type = 'application/json' } = {},
): Request {
  const headers = new Headers();
  if (origin) headers.set('origin', origin);
  if (type) headers.set('content-type', type);
  headers.set('cf-connecting-ip', '203.0.113.7');
  headers.set('user-agent', 'test-browser');
  return new Request('https://app.wetop.ai/api/site-auth/login', {
    method,
    headers,
    body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : null,
  });
}

const ok: SiteAuthAction = async () => ({ body: { ok: true } });

describe('siteOrigins — кому стойка отвечает', () => {
  it('по умолчанию в production — только wetop.ai и www.wetop.ai', () => {
    expect(siteOrigins(PROD)).toEqual(['https://wetop.ai', 'https://www.wetop.ai']);
  });

  it('SITE_ORIGINS заменяет список, пробелы и хвостовая косая черта не мешают', () => {
    expect(siteOrigins({ ...PROD, SITE_ORIGINS: ' https://wetop.ai/ , https://preview.wetop.ai ' })).toEqual([
      'https://wetop.ai',
      'https://preview.wetop.ai',
    ]);
  });

  it('в разработке добавлен сайт на 127.0.0.1:3002 и localhost:3002', () => {
    expect(siteOrigins({ NODE_ENV: 'development' })).toEqual(
      expect.arrayContaining(['http://127.0.0.1:3002', 'http://localhost:3002']),
    );
  });
});

describe('handleSiteAuth — источник и форма запроса', () => {
  it('предварительный запрос своего сайта получает разрешение с куками', async () => {
    const res = await handleSiteAuth(request(null, { method: 'OPTIONS' }), ok, PROD);
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://wetop.ai');
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
    expect(res.headers.get('vary')).toMatch(/Origin/);
  });

  it('чужой источник — 403, действие не вызывается', async () => {
    const action = vi.fn(ok);
    const res = await handleSiteAuth(request({ email: 'a@b.kz' }, { origin: 'https://evil.example' }), action, PROD);
    expect(res.status).toBe(403);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    expect(action).not.toHaveBeenCalled();
  });

  it('без Origin — 403: простую форму с чужой страницы стойка не примет', async () => {
    const action = vi.fn(ok);
    const res = await handleSiteAuth(request({}, { origin: '' }), action, PROD);
    expect(res.status).toBe(403);
    expect(action).not.toHaveBeenCalled();
  });

  it('не JSON — 415: text/plain и form-urlencoded уходят без предварительного запроса', async () => {
    const action = vi.fn(ok);
    const res = await handleSiteAuth(request('email=a', { type: 'text/plain' }), action, PROD);
    expect(res.status).toBe(415);
    expect(action).not.toHaveBeenCalled();
  });

  it('битое тело — 400 словами', async () => {
    const res = await handleSiteAuth(request('{нет'), ok, PROD);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: 'Неверный запрос' });
  });

  it('действию уходят тело и адрес посетителя — пределы попыток считает API', async () => {
    const action = vi.fn(ok);
    await handleSiteAuth(request({ email: 'a@b.kz' }), action, PROD);
    expect(action).toHaveBeenCalledWith(
      { email: 'a@b.kz' },
      { ip: '203.0.113.7', userAgent: 'test-browser' },
    );
  });
});

describe('handleSiteAuth — ответ', () => {
  it('сессия уходит только кукой: в теле ключа нет', async () => {
    const action: SiteAuthAction = async () => ({
      body: { next: '/today' },
      session: { token: 'secret-token', expiresAt: '2026-10-27T00:00:00.000Z' },
    });
    const res = await handleSiteAuth(request({}), action, PROD);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain('secret-token');
    expect(JSON.parse(text)).toEqual({ next: '/today' });
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('wetop_session=secret-token');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Secure');
    expect(res.headers.get('access-control-allow-origin')).toBe('https://wetop.ai');
  });

  it('ошибка API с кодом — тот же код и текст для человека', async () => {
    const { ApiError } = await import('./api-error');
    const action: SiteAuthAction = async () => {
      throw new ApiError(401, 'Неверная почта или пароль');
    };
    const res = await handleSiteAuth(request({}), action, PROD);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ message: 'Неверная почта или пароль' });
    expect(res.headers.get('access-control-allow-origin')).toBe('https://wetop.ai');
  });

  it('сбой связи с API — 503 одной фразой, без подробностей', async () => {
    const action: SiteAuthAction = async () => {
      throw new TypeError('fetch failed: connect ECONNREFUSED 10.0.0.3:3001');
    };
    const res = await handleSiteAuth(request({}), action, PROD);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ message: 'Нет связи с сервером. Попробуйте ещё раз.' });
  });
});

describe('sessionCookieHeader', () => {
  it('по http без Secure — иначе браузер куку отбросит и вход зациклится', () => {
    const header = sessionCookieHeader(
      { token: 't', expiresAt: '2026-10-27T00:00:00.000Z' },
      { APP_URL: 'http://127.0.0.1:3000' },
    );
    expect(header).not.toContain('Secure');
    expect(header).toContain('Expires=Tue, 27 Oct 2026 00:00:00 GMT');
    expect(header).toContain('Path=/');
  });

  it('кривой срок — кука сессионная, без Expires', () => {
    expect(sessionCookieHeader({ token: 't', expiresAt: 'нет' }, {})).not.toContain('Expires');
  });
});
