import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertRlsAtStartup, rlsRoleProblem, type RlsProbe } from './rls-startup';

/**
 * Аудит 29.09.2026, SEC-1a: без `DATABASE_APP_URL` запросы организации молча шли служебной ролью, для которой политики
 * RLS не действуют. Теперь production без роли `wetop_app` не стартует. Соединение с базой в тестах подделано.
 */
const URL = 'postgresql://wetop_app.abcd:pw-not-real@db.example.invalid:5432/pms';
const PROD = { NODE_ENV: 'production', DATABASE_APP_URL: URL };
const GOOD: RlsProbe = { user: 'wetop_app', bypassRls: false, superuser: false };

afterEach(() => vi.restoreAllMocks());

describe('роль соединения организации', () => {
  it('wetop_app без BYPASSRLS — годится', () => {
    expect(rlsRoleProblem(GOOD)).toBeNull();
  });

  it('другая роль, BYPASSRLS и суперпользователь — не годятся, причина называет что не так', () => {
    expect(rlsRoleProblem({ ...GOOD, user: 'postgres' })).toMatch(/postgres/);
    expect(rlsRoleProblem({ ...GOOD, bypassRls: true })).toMatch(/BYPASSRLS/);
    expect(rlsRoleProblem({ ...GOOD, superuser: true })).toMatch(/суперпользовател/);
  });
});

describe('проверка при старте API', () => {
  it('не production — проверки нет, в базу не ходим (разработка и тесты)', async () => {
    const probe = vi.fn();
    await assertRlsAtStartup({}, probe);
    await assertRlsAtStartup({ NODE_ENV: 'development' }, probe);
    await assertRlsAtStartup({ NODE_ENV: 'test', DATABASE_APP_URL: '' }, probe);
    expect(probe).not.toHaveBeenCalled();
  });

  it('production без DATABASE_APP_URL — отказ, в базу не ходим', async () => {
    const probe = vi.fn();
    for (const DATABASE_APP_URL of [undefined, '', '   ']) {
      await expect(
        assertRlsAtStartup({ NODE_ENV: 'production', DATABASE_APP_URL }, probe),
      ).rejects.toThrow(/DATABASE_APP_URL/);
    }
    expect(probe).not.toHaveBeenCalled();
  });

  it('production, роль wetop_app без BYPASSRLS — старт, проверка идёт по адресу роли организации', async () => {
    const probe = vi.fn(async () => GOOD);
    await expect(assertRlsAtStartup(PROD, probe)).resolves.toBeUndefined();
    expect(probe).toHaveBeenCalledWith(URL);
  });

  it('production, в адрес попала другая роль (копия DATABASE_URL) — отказ', async () => {
    const probe = vi.fn(async () => ({ ...GOOD, user: 'postgres' }));
    await expect(assertRlsAtStartup(PROD, probe)).rejects.toThrow(/postgres/);
  });

  it('production, у роли BYPASSRLS или права суперпользователя — отказ', async () => {
    await expect(
      assertRlsAtStartup(PROD, async () => ({ ...GOOD, bypassRls: true })),
    ).rejects.toThrow(/BYPASSRLS/);
    await expect(
      assertRlsAtStartup(PROD, async () => ({ ...GOOD, superuser: true })),
    ).rejects.toThrow(/суперпользовател/);
  });

  it('production, базу проверить не удалось — отказ; в тексте нет ни адреса, ни пароля', async () => {
    const probe = vi.fn(async () => {
      throw Object.assign(new Error(`connect ECONNREFUSED ${URL}`), { code: 'ECONNREFUSED' });
    });
    const error = await assertRlsAtStartup(PROD, probe).catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/не удалось проверить/);
    expect((error as Error).message).toContain('ECONNREFUSED');
    expect((error as Error).message).not.toContain('pw-not-real');
    expect((error as Error).message).not.toContain('db.example.invalid');
  });

  it('RLS_DISABLED=1 — явный выход: старт с предупреждением, в базу не ходим', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const probe = vi.fn();
    await expect(
      assertRlsAtStartup({ NODE_ENV: 'production', RLS_DISABLED: '1' }, probe),
    ).resolves.toBeUndefined();
    expect(probe).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/RLS_DISABLED/);
  });

  it('выключает только «1»: «0», «true» и пустое значение проверку не отключают', async () => {
    const probe = vi.fn();
    for (const RLS_DISABLED of ['0', 'true', 'yes', '']) {
      await expect(
        assertRlsAtStartup({ NODE_ENV: 'production', RLS_DISABLED }, probe),
      ).rejects.toThrow(/DATABASE_APP_URL/);
    }
  });
});
