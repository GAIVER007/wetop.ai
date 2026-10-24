import { describe, expect, it, vi } from 'vitest';
import { handleMobileGateway, type MobileGatewayEnv } from './mobile-gateway';

const ENABLED: MobileGatewayEnv = {
  MOBILE_GATEWAY_ENABLED: '1',
  APP_API_URL: 'http://127.0.0.1:3001',
};
const TRUSTED: MobileGatewayEnv = { ...ENABLED, MOBILE_GATEWAY_TRUSTED_PROXY: 'cloudflare' };
const PUBLIC_HEADERS = { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.7' };
const TOKEN = 'mobile-session-token';
const B = '11111111-1111-4111-8111-111111111111';
const L = '22222222-2222-4222-8222-222222222222';

function request(
  action: string,
  init: RequestInit = {},
): Request {
  return new Request(`https://app.wetop.ai/api/mobile/v1/${action}`, init);
}

function upstream(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(body, { status, headers });
}

describe('mobile gateway boundary', () => {
  it('is unavailable until explicitly enabled', async () => {
    const fetcher = vi.fn();
    const response = await handleMobileGateway(request('me'), 'me', {}, fetcher);
    expect(response.status).toBe(404);
    expect(fetcher).not.toHaveBeenCalled();
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('allows only the declared action and method', async () => {
    const fetcher = vi.fn();
    expect((await handleMobileGateway(request('register'), 'register', ENABLED, fetcher)).status).toBe(404);
    expect((await handleMobileGateway(request('toString'), 'toString', ENABLED, fetcher)).status).toBe(404);
    expect(
      (await handleMobileGateway(request('login', { method: 'GET' }), 'login', ENABLED, fetcher)).status,
    ).toBe(405);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('requires a bearer token for protected actions and never accepts a cookie instead', async () => {
    const fetcher = vi.fn();
    const response = await handleMobileGateway(
      request('me', { headers: { cookie: 'wetop_session=cookie-secret' } }),
      'me',
      ENABLED,
      fetcher,
    );
    expect(response.status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects service credentials and malformed scope before contacting the API', async () => {
    const fetcher = vi.fn();
    const service = await handleMobileGateway(
      request('me', { headers: { authorization: `Bearer ${TOKEN}`, 'x-wetop-service-key': 'secret' } }),
      'me',
      ENABLED,
      fetcher,
    );
    const scope = await handleMobileGateway(
      request('me', { headers: { authorization: `Bearer ${TOKEN}`, 'x-wetop-scope': 'business=not-a-uuid' } }),
      'me',
      ENABLED,
      fetcher,
    );
    expect(service.status).toBe(403);
    expect(scope.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('sends only filtered login fields and returns only the mobile login DTO', async () => {
    const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
      expect(JSON.parse(String(init.body))).toEqual({ email: 'person@example.com', password: 'pass' });
      expect(new Headers(init.headers).get('cookie')).toBeNull();
      expect(new Headers(init.headers).get('authorization')).toBeNull();
      return upstream({
        token: TOKEN,
        expiresAt: '2026-10-25T00:00:00.000Z',
        internal: 'drop-me',
        user: {
          id: 'user-1', email: 'person@example.com', name: 'Person', organizationId: B,
          role: 'OWNER', platformAdmin: true, passwordHash: 'drop-me',
        },
      });
    });
    const response = await handleMobileGateway(
      request('login', {
        method: 'POST',
        headers: { ...PUBLIC_HEADERS, cookie: 'wetop_session=old' },
        body: JSON.stringify({ email: ' person@example.com ', password: 'pass', admin: true }),
      }),
      'login',
      TRUSTED,
      fetcher,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      token: TOKEN,
      expiresAt: '2026-10-25T00:00:00.000Z',
      user: {
        id: 'user-1', email: 'person@example.com', name: 'Person', organizationId: B,
        role: 'OWNER',
      },
    });
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('forwards only bearer, valid scope and user agent to protected API calls', async () => {
    const fetcher = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe('http://127.0.0.1:3001/auth/me');
      const headers = new Headers(init.headers);
      expect(headers.get('authorization')).toBe(`Bearer ${TOKEN}`);
      expect(headers.get('x-wetop-scope')).toBe(`business=${B};location=${L}`);
      expect(headers.get('user-agent')).toBe('WETOP Mobile Test');
      expect(headers.get('cookie')).toBeNull();
      expect(headers.get('x-wetop-service-key')).toBeNull();
      return upstream({
        user: { id: 'u', email: 'a@b.kz', name: null, organizationId: B, role: 'EMPLOYEE', restricted: true,
          scopes: [
            { role: 'WAITER', businessId: B, locationId: L, secret: 'drop' },
            { role: 'MANAGER', businessId: B },
          ] },
        organization: { name: 'Cafe', status: 'ACTIVE', trialEndsAt: null, secret: 'drop' },
        expiresAt: '2026-10-25T00:00:00.000Z', sessionIssuedAt: '2026-10-24T00:00:00.000Z',
        context: { scope: 'LOCATION', businessId: B, locationId: L, vertical: 'FOOD_SERVICE', secret: 'drop' },
        access: { aiSeller: { access: 'off', status: null, activeUntil: null, daysLeft: null, secret: 'drop' } },
        serverSecret: 'drop',
      });
    });
    const response = await handleMobileGateway(
      request('me', { headers: {
        authorization: `Bearer ${TOKEN}`,
        'x-wetop-scope': `business=${B};location=${L}`,
        'user-agent': 'WETOP Mobile Test',
        cookie: 'wetop_session=old',
      } }),
      'me', ENABLED, fetcher,
    );
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain('secret');
    expect(JSON.parse(text).user.scopes).toEqual([
      { role: 'WAITER', businessId: B, locationId: L },
      { role: 'MANAGER', businessId: B },
    ]);
  });

  it('fails closed for public auth when the trusted proxy contract or a valid client IP is absent', async () => {
    const fetcher = vi.fn(async () => upstream({ ok: true }));
    const init = { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'person@example.com' }) };
    const noTrust = await handleMobileGateway(request('password-reset', init), 'password-reset', ENABLED, fetcher);
    const noIp = await handleMobileGateway(request('password-reset', init), 'password-reset', TRUSTED, fetcher);
    const invalidIp = await handleMobileGateway(request('password-reset', {
      ...init, headers: { ...init.headers, 'cf-connecting-ip': '999.999.999.999' },
    }), 'password-reset', TRUSTED, fetcher);
    expect([noTrust.status, noIp.status, invalidIp.status]).toEqual([503, 503, 503]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('forwards a valid client IP only under the explicit trusted Cloudflare proxy contract', async () => {
    const seen: Array<string | null> = [];
    const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
      seen.push(new Headers(init.headers).get('cf-connecting-ip'));
      return upstream({ ok: true });
    });
    const req = request('password-reset', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.7' },
      body: JSON.stringify({ email: 'person@example.com' }),
    });
    const trustedReq = req.clone();
    await handleMobileGateway(req, 'password-reset', ENABLED, fetcher);
    await handleMobileGateway(trustedReq, 'password-reset', TRUSTED, fetcher);
    expect(seen).toEqual(['203.0.113.7']);
  });

  it('filters branch and organization payloads instead of proxying arbitrary upstream JSON', async () => {
    const fetcher = vi.fn(async (url: string) => url.endsWith('/branches')
      ? upstream({ items: [{ id: L, name: 'Center', currency: 'KZT', timezone: 'Asia/Almaty',
          vertical: 'BEAUTY', locationId: L, location: { businessId: B, hidden: true }, hidden: true }],
          personal: true, businesses: [{ hidden: true }] })
      : upstream({ organizations: [{ id: B, name: 'Org', role: 'OWNER', current: true, hidden: true }] }));
    const headers = { authorization: `Bearer ${TOKEN}` };
    const branches = await handleMobileGateway(request('branches', { headers }), 'branches', ENABLED, fetcher);
    const organizations = await handleMobileGateway(request('organizations', { headers }), 'organizations', ENABLED, fetcher);
    expect(await branches.json()).toEqual({ items: [{ id: L, name: 'Center', currency: 'KZT',
      timezone: 'Asia/Almaty', vertical: 'BEAUTY', locationId: L, location: { businessId: B } }], personal: true });
    expect(await organizations.json()).toEqual({ organizations: [{ id: B, name: 'Org', role: 'OWNER', current: true }] });
  });

  it('enforces JSON and body size limits before parsing', async () => {
    const fetcher = vi.fn();
    const wrongType = await handleMobileGateway(request('login', {
      method: 'POST', headers: { 'cf-connecting-ip': '203.0.113.7' }, body: '{}',
    }), 'login', TRUSTED, fetcher);
    const large = await handleMobileGateway(request('login', {
      method: 'POST', headers: { ...PUBLIC_HEADERS, 'content-length': '20000' }, body: '{}',
    }), 'login', TRUSTED, fetcher);
    expect(wrongType.status).toBe(415);
    expect(large.status).toBe(413);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('sanitizes upstream failures and never leaks a token from an error body', async () => {
    const fetcher = vi.fn(async () => upstream({ message: `database failed ${TOKEN}`, token: TOKEN }, 500));
    const response = await handleMobileGateway(
      request('me', { headers: { authorization: `Bearer ${TOKEN}` } }),
      'me', ENABLED, fetcher,
    );
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).not.toContain(TOKEN);
    expect(JSON.parse(text)).toEqual({ message: 'Сервис временно недоступен. Попробуйте ещё раз.' });
  });

  it('does not relay arbitrary upstream error text even when it does not contain known request secrets', async () => {
    const fetcher = vi.fn(async () => upstream({ message: 'guest private details from an internal exception' }, 400));
    const response = await handleMobileGateway(
      request('me', { headers: { authorization: `Bearer ${TOKEN}` } }),
      'me', ENABLED, fetcher,
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: 'Проверьте данные запроса' });
  });

  it('rejects an empty session token from an invalid upstream response', async () => {
    const fetcher = vi.fn(async () => upstream({
      token: '',
      expiresAt: '2026-10-25T00:00:00.000Z',
      user: { id: 'u', email: 'a@b.kz', name: null, organizationId: B, role: 'OWNER' },
    }));
    const response = await handleMobileGateway(
      request('login', {
        method: 'POST', headers: PUBLIC_HEADERS,
        body: JSON.stringify({ email: 'a@b.kz', password: 'pass' }),
      }),
      'login', TRUSTED, fetcher,
    );
    expect(response.status).toBe(502);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('times out while reading the incoming request body before contacting the API', async () => {
    const aborted = new AbortController();
    aborted.abort(new DOMException('timeout', 'TimeoutError'));
    vi.spyOn(AbortSignal, 'timeout').mockReturnValueOnce(aborted.signal);
    const fetcher = vi.fn(async () => upstream({ ok: true }));
    const response = await handleMobileGateway(
      request('password-reset', {
        method: 'POST', headers: PUBLIC_HEADERS,
        body: JSON.stringify({ email: 'a@b.kz' }),
      }),
      'password-reset', TRUSTED, fetcher,
    );
    expect(response.status).toBe(408);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
