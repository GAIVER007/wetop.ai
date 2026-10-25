import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/desk-shell', () => ({
  currentMe: async () => {
    throw new Error('API недоступен');
  },
}));

import { cookieLocale, serverT } from './server';

/**
 * KK2: серверные действия и страницы читают язык человека. Вне запроса Next (unit-тесты, служебные вызовы) куки нет,
 * и это не ошибка экрана: язык русский, как было до перевода.
 */
describe('язык на сервере вне запроса', () => {
  it('без запроса и без ответа /auth/me язык русский, а не исключение', async () => {
    await expect(cookieLocale()).resolves.toBe('ru');
    expect((await serverT())('Помощь')).toBe('Помощь');
  });
});
