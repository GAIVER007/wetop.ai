import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  afterEach(() => vi.unstubAllEnvs());
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
      context: { vertical: 'HOSPITALITY', businessId: 'business-a', locationId: 'location-a' },
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

describe('verified shell scope before domain reads', () => {
  const user = { email: 'scope@example.invalid', name: 'Тестовый владелец', role: 'OWNER' };
  it.each([
    null,
    { vertical: 'UNKNOWN', businessId: 'b', locationId: 'l' },
    { vertical: 'HOSPITALITY', businessId: 'b', locationId: null },
    { vertical: 'BEAUTY', businessId: null, locationId: 'l' },
  ])(
    'unresolved context suppresses domain reads and retains branch recovery: %j',
    async (context) => {
      me.mockResolvedValue({ user, context });
      const { deskShell } = await import('./desk-shell');
      const shell = await deskShell();
      expect(shell.access.unknown).toBe(true);
      expect(shell.person?.name).toBe(user.name);
      expect(shell.scopeKey).toBeUndefined();
    },
  );
  it('valid scope provides the Business/Location identity', async () => {
    me.mockResolvedValue({
      user,
      context: { vertical: 'FOOD_SERVICE', businessId: 'b', locationId: 'l' },
    });
    const { deskShell } = await import('./desk-shell');
    expect(await deskShell()).toMatchObject({ vertical: 'FOOD_SERVICE', scopeKey: 'b:l' });
  });
  it('anonymous production with disabled lock still suppresses Hospitality domain reads', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('APP_AUTH_REQUIRED', '0');
    me.mockResolvedValue({ user: null });
    const { deskShell } = await import('./desk-shell');
    expect((await deskShell()).access.unknown).toBe(true);
    vi.unstubAllEnvs();
  });
});
