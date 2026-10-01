import { afterEach, expect, it, vi } from 'vitest';
import { GET, POST } from '../app/auth/fallback/route';
import { authApi } from './api';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
function request(origin: string, values: Record<string, string>) {
  return new Request('https://app.wetop.ai/auth/fallback', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(values),
  });
}
it('отклоняет login-CSRF до вызова API', async () => {
  const login = vi.spyOn(authApi, 'login');
  expect(
    (
      await POST(
        request('https://foreign.invalid', {
          email: 'test@example.invalid',
          password: 'synthetic',
        }),
      )
    ).status,
  ).toBe(403);
  expect(login).not.toHaveBeenCalled();
});
it('экранирует вставляемую в HTML почту', async () => {
  const response = await GET(
    new Request('https://app.wetop.ai/auth/fallback?email=%22%3E%3Cscript%3Ebad%3C%2Fscript%3E'),
  );
  const html = await response.text();
  expect(html).not.toContain('<script>');
  expect(html).toContain('&lt;script&gt;');
});
it('выдаёт HttpOnly cookie и безопасный 303 без ключа в HTML', async () => {
  vi.stubEnv('APP_URL', 'https://app.wetop.ai');
  vi.spyOn(authApi, 'login').mockResolvedValue({
    token: 'synthetic-token',
    expiresAt: '2030-01-01T00:00:00Z',
  } as never);
  const response = await POST(
    request('https://app.wetop.ai', {
      email: 'test@example.invalid',
      password: 'synthetic',
      next: '//foreign.invalid',
    }),
  );
  expect(response.status).toBe(303);
  expect(response.headers.get('location')).toBe('/today');
  expect(response.headers.get('set-cookie')).toContain('HttpOnly');
  expect(response.headers.get('set-cookie')).toContain('Secure');
  expect(await response.text()).not.toContain('synthetic-token');
});
it('ограничивает тело до отправки в API', async () => {
  const login = vi.spyOn(authApi, 'login');
  const response = await POST(request('https://app.wetop.ai', { password: 'x'.repeat(17000) }));
  expect(response.status).toBe(413);
  expect(login).not.toHaveBeenCalled();
});
