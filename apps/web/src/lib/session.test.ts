import { expect, it, vi } from 'vitest';

const jar = vi.hoisted(() => ({ delete: vi.fn(), set: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => jar, headers: async () => new Headers() }));
const { clearSessionCookie, clearScopeCookie, setScopeCookie } = await import('./session');

it('выход снимает и сессию, и указатель филиала: следующий вход на этом устройстве начинает с чистого выбора', async () => {
  await clearSessionCookie();
  expect(jar.delete).toHaveBeenCalledWith('wetop_session');
  expect(jar.delete).toHaveBeenCalledWith('wetop_scope');
  // Подсказка «последний филиал» не стирается: это не право, сервер сверяет её со своим списком при входе
  expect(jar.delete).not.toHaveBeenCalledWith('wetop_last_branch');
});

it('указатель ставится одним помощником с теми же признаками, что сессия', async () => {
  vi.stubEnv('APP_URL', 'https://app.wetop.ai');
  await setScopeCookie('business=11111111-1111-4111-8111-111111111111;location=22222222-2222-4222-8222-222222222222');
  expect(jar.set).toHaveBeenCalledWith('wetop_scope', 'business=11111111-1111-4111-8111-111111111111;location=22222222-2222-4222-8222-222222222222', {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
  });
  // Выбор запоминается на устройстве: следующий вход сам откроет этот филиал, если он ещё доступен
  expect(jar.set).toHaveBeenCalledWith(
    'wetop_last_branch',
    '22222222-2222-4222-8222-222222222222',
    expect.objectContaining({ httpOnly: true, secure: true, path: '/', maxAge: expect.any(Number) }),
  );
  jar.delete.mockClear();
  await clearScopeCookie();
  expect(jar.delete).toHaveBeenCalledWith('wetop_scope');
  vi.unstubAllEnvs();
});
