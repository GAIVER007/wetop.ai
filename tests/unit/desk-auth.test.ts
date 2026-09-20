import { describe, expect, it } from 'vitest';
import { deskCredentials, locked } from '../../scripts/reconciliation/src/desk-auth';

/**
 * Вход в стойку для обхода экранов (ADR-053). Пароль берётся только из окружения: скрипт его не
 * придумывает и учётных записей не заводит.
 */
describe('deskCredentials', () => {
  it('обе переменные — это учётные данные', () => {
    expect(
      deskCredentials({ WALKTHROUGH_EMAIL: ' admin@wetop.ai ', WALKTHROUGH_PASSWORD: 'parol' }),
    ).toEqual({ email: 'admin@wetop.ai', password: 'parol' });
  });

  it('половина или пусто — данных нет', () => {
    expect(deskCredentials({})).toBeNull();
    expect(deskCredentials({ WALKTHROUGH_EMAIL: 'admin@wetop.ai' })).toBeNull();
    expect(deskCredentials({ WALKTHROUGH_PASSWORD: 'parol' })).toBeNull();
    expect(deskCredentials({ WALKTHROUGH_EMAIL: '  ', WALKTHROUGH_PASSWORD: 'parol' })).toBeNull();
  });
});

describe('locked', () => {
  it('стойка увела на экран входа', () => {
    expect(locked('http://127.0.0.1:3000/login')).toBe(true);
    expect(locked('https://app.wetop.ai/login?from=%2Ftoday')).toBe(true);
  });

  it('обычный экран замком не считается', () => {
    expect(locked('http://127.0.0.1:3000/today')).toBe(false);
    expect(locked('http://127.0.0.1:3000/reservations/20260913-TEST1')).toBe(false);
  });
});
