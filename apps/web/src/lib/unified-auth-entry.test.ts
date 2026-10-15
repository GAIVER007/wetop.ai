import { afterEach, describe, expect, it, vi } from 'vitest';
import { redirect } from 'next/navigation';
import { redirectToLoginIfRequired } from './session';

vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () =>
    new Headers({ 'x-wetop-path': '/journal', 'x-wetop-return': '/journal?page=2' }),
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('единый вход с главной', () => {
  it('истёкшая сессия ведёт на главную с безопасным адресом возврата', async () => {
    vi.stubEnv('APP_AUTH_REQUIRED', '1');
    vi.stubEnv('WETOP_SITE_URL', 'https://wetop.ai');
    await redirectToLoginIfRequired();
    expect(redirect).toHaveBeenCalledWith('https://wetop.ai/?next=%2Fjournal%3Fpage%3D2#login');
  });
  it('локальная главная и приложение остаются в одном локальном окружении', async () => {
    vi.stubEnv('APP_AUTH_REQUIRED', '1');
    vi.stubEnv('WETOP_SITE_URL', 'http://127.0.0.1:3002');
    await redirectToLoginIfRequired();
    expect(redirect).toHaveBeenCalledWith(
      'http://127.0.0.1:3002/?next=%2Fjournal%3Fpage%3D2#login',
    );
  });
});
