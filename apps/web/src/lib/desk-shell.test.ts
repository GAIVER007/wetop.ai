import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './api-error';

const me = vi.fn();
vi.mock('./api', () => ({ authApi: { me: () => me() } }));

/**
 * Что знает оболочка стойки о вошедшем (ADR-083, ADR-107). Никто не вошёл (замок выключен в разработке) — разделы по
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
    me.mockResolvedValue({
      user: { email: 'm@example.invalid', name: null, role: 'MANAGER' },
      context: { vertical: 'HOSPITALITY', businessId: 'b', locationId: 'l' },
    });
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

it('MV8 invalid server context never becomes Hospitality shell', async () => {
  me.mockResolvedValue({
    user: { email: 'test@example.invalid', name: null, role: 'OWNER' },
    context: { scope: 'ORGANIZATION', vertical: null, businessId: null, locationId: null },
  });
  const { deskShell } = await import('./desk-shell');
  expect((await deskShell()).access.unknown).toBe(true);
});

it('MV8 unknown vertical cannot start Hospitality shell calls', async () => {
  me.mockResolvedValue({
    user: { email: 'test@example.invalid', name: null, role: 'OWNER' },
    context: { vertical: 'UNKNOWN', businessId: 'b', locationId: 'l' },
  });
  const { deskShell } = await import('./desk-shell');
  expect((await deskShell()).access.unknown).toBe(true);
});

it.each([{ user: null }, { user: { email: 'test@example.invalid', name: null, role: 'OWNER' } }])(
  'MV8 absent server scope cannot start domain reads: %j',
  async (response) => {
    me.mockResolvedValue(response);
    const { deskShell } = await import('./desk-shell');
    expect((await deskShell()).access.unknown).toBe(true);
  },
);

it('authenticated identity without a selected Location retains branch selection while domain access is unknown', async () => {
  me.mockResolvedValue({
    user: { email: 'test@example.invalid', name: 'Тестовый владелец', role: 'OWNER' },
    context: { vertical: null, businessId: null, locationId: null },
  });
  const { deskShell } = await import('./desk-shell');
  const shell = await deskShell();
  expect(shell.person?.name).toBe('Тестовый владелец');
  expect(shell.access.unknown).toBe(true);
});
