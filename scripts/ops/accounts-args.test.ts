import { describe, expect, it } from 'vitest';
import { parseAccountsArgs } from './accounts-args';

describe('parseAccountsArgs', () => {
  it('список сотрудников', () => {
    expect(parseAccountsArgs(['list'])).toEqual({ ok: true, command: { kind: 'list' } });
  });

  it('создание: почта приводится к нижнему регистру', () => {
    expect(parseAccountsArgs(['create', '--email=Aigul@Luxx.KZ', '--name=Айгуль Сеитова'])).toEqual({
      ok: true,
      command: { kind: 'create', email: 'aigul@luxx.kz', name: 'Айгуль Сеитова' },
    });
  });

  it('роли не принимаются: их нет в модели (ADR-023 в силе, Q-140)', () => {
    expect(parseAccountsArgs(['create', '--email=a@b.kz', '--name=Имя', '--role=owner'])).toEqual({
      ok: true,
      command: { kind: 'create', email: 'a@b.kz', name: 'Имя' },
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

  it('приглашение: как create, но пароль не задаётся — человек задаст его сам по ссылке', () => {
    expect(parseAccountsArgs(['invite', '--email=Nova@Luxx.KZ', '--name=Нова Сеитова'])).toEqual({
      ok: true,
      command: { kind: 'invite', email: 'nova@luxx.kz', name: 'Нова Сеитова' },
    });
  });

  it('приглашение без имени или с непохожей почтой не отправляем', () => {
    expect(parseAccountsArgs(['invite', '--email=a@b.kz'])).toMatchObject({ ok: false });
    expect(parseAccountsArgs(['invite', '--name=Имя'])).toMatchObject({ ok: false });
  });

  it('без команды показываем, что умеем', () => {
    expect(parseAccountsArgs([])).toMatchObject({ ok: false });
    expect(parseAccountsArgs(['выдумка'])).toMatchObject({ ok: false });
  });
});
