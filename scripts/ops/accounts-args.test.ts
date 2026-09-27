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

  it('create роль не задаёт: для этого команда role (DATA_MODEL §16.1, ADR-083)', () => {
    expect(parseAccountsArgs(['create', '--email=a@b.kz', '--name=Имя', '--role=owner'])).toEqual({
      ok: true,
      command: { kind: 'create', email: 'a@b.kz', name: 'Имя' },
    });
  });

  it('роль управляющего — manager; отказ называет все три роли (ADR-098)', () => {
    expect(parseAccountsArgs(['role', '--email=a@b.kz', '--role=Manager'])).toEqual({
      ok: true,
      command: { kind: 'role', email: 'a@b.kz', role: 'MANAGER' },
    });
    expect(parseAccountsArgs(['role', '--email=a@b.kz', '--role=admin'])).toEqual({
      ok: false,
      error: '--role= owner, manager или staff',
    });
  });

  it('роль в организации: owner или staff', () => {
    expect(parseAccountsArgs(['role', '--email=Aigul@Luxx.KZ', '--role=owner'])).toEqual({
      ok: true,
      command: { kind: 'role', email: 'aigul@luxx.kz', role: 'OWNER' },
    });
    expect(parseAccountsArgs(['role', '--email=a@b.kz', '--role=STAFF'])).toEqual({
      ok: true,
      command: { kind: 'role', email: 'a@b.kz', role: 'STAFF' },
    });
    expect(parseAccountsArgs(['role', '--email=a@b.kz', '--role=admin'])).toMatchObject({ ok: false });
    expect(parseAccountsArgs(['role', '--role=owner'])).toMatchObject({ ok: false });
  });

  it('главный администратор: выдать с заметкой и снять — по почте, только командой на сервере (ADR-083)', () => {
    expect(parseAccountsArgs(['platform-admin', '--email=Owner@Wetop.AI', '--note=владелец WETOP'])).toEqual({
      ok: true,
      command: { kind: 'platform-admin', email: 'owner@wetop.ai', note: 'владелец WETOP' },
    });
    expect(parseAccountsArgs(['platform-admin', '--email=owner@wetop.ai'])).toEqual({
      ok: true,
      command: { kind: 'platform-admin', email: 'owner@wetop.ai', note: null },
    });
    expect(parseAccountsArgs(['platform-admin-revoke', '--email=owner@wetop.ai'])).toEqual({
      ok: true,
      command: { kind: 'platform-admin-revoke', email: 'owner@wetop.ai' },
    });
    expect(parseAccountsArgs(['platform-admin', '--email=не-почта'])).toMatchObject({ ok: false });
  });

  it('расширение организации человека: статус, срок и заметка — проверяет домен при выполнении', () => {
    expect(
      parseAccountsArgs(['extension', '--email=owner@wetop.ai', '--status=active', '--until=2026-12-31', '--note=счёт 1']),
    ).toEqual({
      ok: true,
      command: {
        kind: 'extension',
        email: 'owner@wetop.ai',
        status: 'ACTIVE',
        until: '2026-12-31',
        note: 'счёт 1',
      },
    });
    expect(parseAccountsArgs(['extension', '--email=owner@wetop.ai', '--status=off'])).toEqual({
      ok: true,
      command: { kind: 'extension', email: 'owner@wetop.ai', status: 'OFF', until: '', note: '' },
    });
    expect(parseAccountsArgs(['extension', '--email=owner@wetop.ai', '--status=paid'])).toMatchObject({
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
