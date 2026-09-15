import { describe, expect, it } from 'vitest';
import { parseAccountsArgs } from './accounts-args';

describe('parseAccountsArgs', () => {
  it('список сотрудников', () => {
    expect(parseAccountsArgs(['list'])).toEqual({ ok: true, command: { kind: 'list' } });
  });

  it('создание: почта приводится к нижнему регистру, роль по умолчанию — стойка', () => {
    expect(parseAccountsArgs(['create', '--email=Aigul@Luxx.KZ', '--name=Айгуль Сеитова'])).toEqual({
      ok: true,
      command: { kind: 'create', email: 'aigul@luxx.kz', fullName: 'Айгуль Сеитова', role: 'DESK' },
    });
  });

  it('создание с ролью', () => {
    expect(parseAccountsArgs(['create', '--email=a@b.kz', '--name=Имя', '--role=owner'])).toMatchObject({
      ok: true,
      command: { role: 'OWNER' },
    });
  });

  it('незнакомая роль — ошибка, а не молчаливое умолчание', () => {
    expect(parseAccountsArgs(['create', '--email=a@b.kz', '--name=Имя', '--role=admin'])).toMatchObject({
      ok: false,
    });
  });

  it('без имени или с непохожей почтой не создаём', () => {
    expect(parseAccountsArgs(['create', '--email=a@b.kz'])).toMatchObject({ ok: false });
    expect(parseAccountsArgs(['create', '--email=не-почта', '--name=Имя'])).toMatchObject({ ok: false });
  });

  it('смена пароля, блокировка и разблокировка — по почте', () => {
    expect(parseAccountsArgs(['password', '--email=a@b.kz'])).toEqual({
      ok: true,
      command: { kind: 'password', email: 'a@b.kz' },
    });
    expect(parseAccountsArgs(['block', '--email=a@b.kz'])).toEqual({
      ok: true,
      command: { kind: 'block', email: 'a@b.kz' },
    });
    expect(parseAccountsArgs(['unblock', '--email=a@b.kz'])).toEqual({
      ok: true,
      command: { kind: 'unblock', email: 'a@b.kz' },
    });
  });

  it('пароль в аргументах не принимается: он остался бы в истории оболочки и в списке процессов', () => {
    const result = parseAccountsArgs(['create', '--email=a@b.kz', '--name=Имя', '--password=секрет']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/PMS_NEW_PASSWORD/);
  });

  it('без команды показываем, что умеем', () => {
    expect(parseAccountsArgs([])).toMatchObject({ ok: false });
    expect(parseAccountsArgs(['выдумка'])).toMatchObject({ ok: false });
  });
});
