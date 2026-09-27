import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './api-error';

const me = vi.fn();
vi.mock('./api', () => ({ authApi: { me: () => me() } }));

/**
 * Что знает оболочка стойки о вошедшем (ADR-083, ADR-101). Никто не вошёл (замок выключен в разработке) — разделы по
 * ролям не прячутся, как и в API. А сбой `/auth/me` у вошедшего — не «никто не вошёл»: меню и кнопки — как у
 * администратора, иначе при тайм-ауте администратор увидел бы тарифы, каналы, «Сторно» и «Возврат».
 */
describe('оболочка стойки: кто вошёл', () => {
  // в фигурных скобках: `mockReset()` возвращает сам `me`, а функцию из `beforeEach` Vitest вызывает как уборку после
  // теста — и она «спросила бы /auth/me» ещё раз, уже вне проверки
  beforeEach(() => {
    me.mockReset();
  });

  it('никто не вошёл — роли нет, разделы не прячутся', async () => {
    me.mockResolvedValue({ user: null });
    const { deskShell } = await import('./desk-shell');
    expect((await deskShell()).access.role).toBeNull();
  });

  it('вошедший управляющий — его роль', async () => {
    me.mockResolvedValue({ user: { email: 'm@example.invalid', name: null, role: 'MANAGER' } });
    const { deskShell } = await import('./desk-shell');
    expect((await deskShell()).access.role).toBe('MANAGER');
  });

  it('`/auth/me` не ответил — меню как у администратора, «Платформы» нет, а роль помечена неизвестной', async () => {
    me.mockRejectedValue(new ApiError(504, 'API не ответил'));
    const { deskShell } = await import('./desk-shell');
    expect((await deskShell()).access).toEqual({
      aiSeller: false,
      platform: false,
      role: 'STAFF',
      unknown: true,
    });
  });
});
