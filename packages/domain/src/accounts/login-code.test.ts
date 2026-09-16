import { describe, expect, it } from 'vitest';
import {
  CODE_LENGTH,
  CODE_REJECTED_MESSAGE,
  MAX_ATTEMPTS,
  checkCode,
  expiresAt,
  formatCode,
  isCodeShaped,
  isEmailShaped,
  normalizeEmail,
} from './login-code';

describe('normalizeEmail', () => {
  it('приводит к нижнему регистру и снимает пробелы по краям', () => {
    expect(normalizeEmail('  Юрий@Example.TEST ')).toBe('юрий@example.test');
  });
  it('один и тот же адрес в разном регистре даёт одну строку: иначе заведутся два аккаунта', () => {
    expect(normalizeEmail('ZAPOINOV@bk.ru')).toBe(normalizeEmail('zapoinov@BK.RU'));
  });
});

describe('isEmailShaped', () => {
  it.each(['a@b.co', 'zapoinov@bk.ru', 'first.last+tag@sub.domain.kz'])('годится: %s', (e) => {
    expect(isEmailShaped(e)).toBe(true);
  });
  it.each([
    ['без собаки', 'zapoinov.bk.ru'],
    ['две собаки', 'a@b@c.ru'],
    ['пусто до собаки', '@bk.ru'],
    ['домен без точки', 'a@localhost'],
    ['пробел внутри', 'a b@bk.ru'],
    ['точка в конце домена', 'a@bk.ru.'],
  ])('не годится, %s', (_, e) => {
    expect(isEmailShaped(e)).toBe(false);
  });
});

describe('formatCode', () => {
  it('ведущие нули не теряются: 4217 это 004217, а не 4217', () => {
    expect(formatCode(4217)).toBe('004217');
    expect(formatCode(4217)).toHaveLength(CODE_LENGTH);
  });
  it('обрезает лишние разряды, длина всегда шесть', () => {
    expect(formatCode(1234567)).toHaveLength(CODE_LENGTH);
  });
  it('ноль остаётся кодом, а не пустотой', () => {
    expect(formatCode(0)).toBe('000000');
  });
});

describe('isCodeShaped', () => {
  it.each(['000000', '123456', ' 123456 '])('годится: %s', (c) => {
    expect(isCodeShaped(c)).toBe(true);
  });
  it.each(['12345', '1234567', '12345a', ''])('не годится: %s', (c) => {
    expect(isCodeShaped(c)).toBe(false);
  });
});

describe('checkCode', () => {
  const t = (iso: string) => new Date(iso);
  const live = { expiresAt: t('2026-09-15T12:10:00Z'), attempts: 0, usedAt: null };
  const now = t('2026-09-15T12:05:00Z');

  it('живой код с совпадением проходит', () => {
    expect(checkCode(live, true, now)).toEqual({ ok: true });
  });
  it('не совпал — mismatch', () => {
    expect(checkCode(live, false, now)).toEqual({ ok: false, reason: 'mismatch' });
  });
  it('истёк срок — expired, даже если цифры угаданы', () => {
    expect(checkCode(live, true, t('2026-09-15T12:10:01Z'))).toEqual({
      ok: false,
      reason: 'expired',
    });
  });
  it('уже использован — used, повторить нельзя', () => {
    expect(checkCode({ ...live, usedAt: t('2026-09-15T12:06:00Z') }, true, now)).toEqual({
      ok: false,
      reason: 'used',
    });
  });
  it('исчерпаны попытки — too_many_attempts', () => {
    expect(checkCode({ ...live, attempts: MAX_ATTEMPTS }, true, now)).toEqual({
      ok: false,
      reason: 'too_many_attempts',
    });
  });
  it('использованный код важнее истёкшего: причина не должна выдавать, что код вообще был', () => {
    const dead = { expiresAt: t('2026-09-15T12:00:00Z'), attempts: 3, usedAt: t('2026-09-15T11:59:00Z') };
    expect(checkCode(dead, false, now)).toEqual({ ok: false, reason: 'used' });
  });
  it('человеку показывается один текст на все отказы', () => {
    expect(CODE_REJECTED_MESSAGE).toBe('Код не подошёл. Запросите новый.');
  });
});

describe('expiresAt', () => {
  it('десять минут от выдачи', () => {
    expect(expiresAt(new Date('2026-09-15T12:00:00Z')).toISOString()).toBe(
      '2026-09-15T12:10:00.000Z',
    );
  });
});
