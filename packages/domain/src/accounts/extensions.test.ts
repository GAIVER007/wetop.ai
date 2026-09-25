import { describe, expect, it } from 'vitest';
import { EXTENSION_STATUSES, extensionDaysLeft, isExtensionActive, parseExtensionChange } from './extensions';

/** Платные расширения организации (DATA_MODEL §16.3, ADR-083, Q-183) */
describe('расширение действует или нет', () => {
  const now = new Date('2026-09-25T09:00:00.000Z');
  const day = 24 * 60 * 60 * 1000;

  it('нет строки или выключено — не действует', () => {
    expect(isExtensionActive(null, now)).toBe(false);
    expect(isExtensionActive({ status: 'OFF', activeUntil: null }, now)).toBe(false);
  });

  it('оплачено бессрочно — действует; оплачено до даты — до неё, в саму минуту окончания уже нет', () => {
    expect(isExtensionActive({ status: 'ACTIVE', activeUntil: null }, now)).toBe(true);
    expect(isExtensionActive({ status: 'ACTIVE', activeUntil: new Date(now.getTime() + day) }, now)).toBe(true);
    expect(isExtensionActive({ status: 'ACTIVE', activeUntil: now }, now)).toBe(false);
  });

  it('пробное — только со сроком: без срока не действует', () => {
    expect(isExtensionActive({ status: 'TRIAL', activeUntil: new Date(now.getTime() + day) }, now)).toBe(true);
    expect(isExtensionActive({ status: 'TRIAL', activeUntil: null }, now)).toBe(false);
  });

  it('дней до конца: для напоминания за 7 дней и в последний день; бессрочно — не считаем', () => {
    expect(extensionDaysLeft({ status: 'ACTIVE', activeUntil: null }, now)).toBeNull();
    expect(extensionDaysLeft({ status: 'ACTIVE', activeUntil: new Date(now.getTime() + 7 * day) }, now)).toBe(7);
    expect(extensionDaysLeft({ status: 'TRIAL', activeUntil: new Date(now.getTime() + 2 * 3600_000) }, now)).toBe(1);
    expect(extensionDaysLeft({ status: 'ACTIVE', activeUntil: new Date(now.getTime() - day) }, now)).toBe(0);
    expect(extensionDaysLeft({ status: 'OFF', activeUntil: new Date(now.getTime() + day) }, now)).toBeNull();
  });

  it('статусы словами стойки', () => {
    expect(EXTENSION_STATUSES).toEqual({ TRIAL: 'пробный', ACTIVE: 'оплачен', OFF: 'выключен' });
  });
});

describe('изменение расширения главным администратором', () => {
  const now = new Date('2026-09-25T09:00:00.000Z');

  it('оплачен до даты или бессрочно, с заметкой; края пробелов обрезаются', () => {
    expect(parseExtensionChange({ status: 'ACTIVE', activeUntil: '2026-10-25', note: ' счёт №12 ' }, now)).toEqual({
      ok: true,
      value: { status: 'ACTIVE', activeUntil: new Date('2026-10-25T19:00:00.000Z'), note: 'счёт №12' },
    });
    expect(parseExtensionChange({ status: 'ACTIVE', activeUntil: '' }, now)).toEqual({
      ok: true,
      value: { status: 'ACTIVE', activeUntil: null, note: null },
    });
  });

  it('дата «до» — конец этого дня по Алматы (UTC+5): «до 25 октября» включает весь день', () => {
    const r = parseExtensionChange({ status: 'TRIAL', activeUntil: '2026-10-02' }, now);
    expect(r.ok && r.value.activeUntil?.toISOString()).toBe('2026-10-02T19:00:00.000Z');
  });

  it('отказы словами: без статуса, пробный без срока, срок в прошлом, кривая дата, длинная заметка', () => {
    const errors = (raw: unknown) => {
      const r = parseExtensionChange(raw, now);
      return r.ok ? [] : r.errors;
    };
    expect(errors({ status: 'PAID' })).toEqual(['Статус: пробный, оплачен или выключен']);
    expect(errors({ status: 'TRIAL', activeUntil: '' })).toEqual(['У пробного доступа нужен срок']);
    expect(errors({ status: 'ACTIVE', activeUntil: '2026-09-01' })).toEqual(['Срок уже прошёл']);
    expect(errors({ status: 'ACTIVE', activeUntil: '25.10.2026' })).toEqual(['Срок: дата ГГГГ-ММ-ДД']);
    expect(errors({ status: 'ACTIVE', note: 'x'.repeat(301) })).toEqual(['Заметка: не длиннее 300 знаков']);
  });

  it('выключить можно без срока и заметки', () => {
    expect(parseExtensionChange({ status: 'OFF' }, now)).toEqual({
      ok: true,
      value: { status: 'OFF', activeUntil: null, note: null },
    });
  });
});
