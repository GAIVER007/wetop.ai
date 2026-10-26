import { afterEach, expect, it, vi } from 'vitest';
import { GET, POST } from '../app/auth/fallback/route';
import { authApi } from './api';

const lang = vi.hoisted(() => ({ value: undefined as string | undefined }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (name === 'wetop_locale' && lang.value ? { name, value: lang.value } : undefined),
  }),
}));

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
  // чужой next заменён безопасным, а филиал выбирает сервер по `GET /branches`
  expect(response.headers.get('location')).toBe('/scope/resolve?next=%2Ftoday');
  const cookies = response.headers.getSetCookie();
  const session = cookies.find((c) => c.startsWith('wetop_session='));
  expect(session).toContain('HttpOnly');
  expect(session).toContain('Secure');
  expect(cookies.find((c) => c.startsWith('wetop_scope='))).toMatch(
    /^wetop_scope=;.*Max-Age=0.*Secure/,
  );
  expect(await response.text()).not.toContain('synthetic-token');
});
it('ограничивает тело до отправки в API', async () => {
  const login = vi.spyOn(authApi, 'login');
  const response = await POST(request('https://app.wetop.ai', { password: 'x'.repeat(17000) }));
  expect(response.status).toBe(413);
  expect(login).not.toHaveBeenCalled();
});

/** ORG-LOCALE-20261026: после пароля из приглашения человек входит здесь, на своём языке */
it('английский вход после сохранения пароля: всё по-английски и сказано, что пароль сохранён', async () => {
  lang.value = 'en';
  try {
    const html = await (await GET(new Request('https://app.wetop.ai/auth/fallback?password=set'))).text();
    expect(html).toContain('lang="en"');
    expect(html).toContain('Password saved. Sign in with your new password.');
    expect(html).toContain('Sign in to WETOP');
    expect(html.replace(/<style>[\s\S]*?<\/style>/, '')).not.toMatch(/[А-Яа-яЁё]/);
  } finally {
    lang.value = undefined;
  }
});
