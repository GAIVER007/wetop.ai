import { describe, expect, it, vi } from 'vitest';
import { redirect } from 'next/navigation';

const me = vi.hoisted(() => ({ value: null as unknown, currentMeCalls: 0 }));
vi.mock('../lib/desk-shell', () => ({
  meOnce: async () => {
    if (me.value instanceof Error) throw me.value;
    return me.value;
  },
  // currentMe без вошедшего уводит на вход: язык стойки не должен звать его вовсе
  currentMe: async () => {
    me.currentMeCalls += 1;
    redirect('/login');
  },
}));

import { cookieLocale, currentLocale, serverT } from './server';

/**
 * KK2/KK3: серверные действия и страницы читают язык человека. Вне запроса Next (unit-тесты, служебные вызовы) куки
 * нет, и это не ошибка экрана: язык русский. Публичная страница (отзыв по ссылке, вход, регистрация) не должна уходить
 * на вход из-за того, что спросила язык.
 */
describe('язык на сервере', () => {
  it('без запроса и без ответа /auth/me язык русский, а не исключение', async () => {
    me.value = new Error('API недоступен');
    await expect(cookieLocale()).resolves.toBe('ru');
    expect((await serverT())('Помощь')).toBe('Помощь');
  });

  it('никто не вошёл: язык из куки, без перехода на вход', async () => {
    me.value = { user: null };
    await expect(currentLocale()).resolves.toBe('ru');
    expect(me.currentMeCalls).toBe(0);
  });

  it('вошедший: язык из /auth/me', async () => {
    me.value = { user: { id: 'u-1' }, locale: 'en' };
    await expect(currentLocale()).resolves.toBe('en');
  });
});
