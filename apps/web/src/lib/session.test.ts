import { expect, it, vi } from 'vitest';

const jar = vi.hoisted(() => ({ delete: vi.fn(), set: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => jar, headers: async () => new Headers() }));
const { clearSessionCookie, clearScopeCookie, setScopeCookie } = await import('./session');

it('выход снимает и сессию, и указатель филиала: следующий вход на этом устройстве начинает с чистого выбора', async () => {
  await clearSessionCookie();
  expect(jar.delete).toHaveBeenCalledWith('wetop_session');
  expect(jar.delete).toHaveBeenCalledWith('wetop_scope');
});

it('указатель ставится одним помощником с теми же признаками, что сессия', async () => {
  vi.stubEnv('APP_URL', 'https://app.wetop.ai');
  await setScopeCookie('business=b;location=l');
  expect(jar.set).toHaveBeenCalledWith('wetop_scope', 'business=b;location=l', {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
  });
  jar.delete.mockClear();
  await clearScopeCookie();
  expect(jar.delete).toHaveBeenCalledWith('wetop_scope');
  vi.unstubAllEnvs();
});
